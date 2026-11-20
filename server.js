#!/usr/bin/env node
// Local server for translate-my-stuff.
//
// DeepL refuses requests made directly from a browser, and the API key must not live in the page,
// so this tiny server (no dependencies, Node 18+) serves index.html and relays DeepL calls.
//
//   node server.js            -> http://localhost:8080
//
// Configuration lives in .env next to this file (re-read on every request, no restart needed):
//   DEEPL_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
//   PORT=8080                 (optional, read at startup)
//   DEEPL_API_URL=...         (optional; default picks api-free.deepl.com for ":fx" keys)

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MAX_BODY = 1024 * 1024;
const MAX_TEXTS = 50;

function readEnvFile() {
  const env = {};
  let text = '';
  try { text = fs.readFileSync(path.join(ROOT, '.env'), 'utf8'); } catch { return env; }
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(line)) continue;
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

function config() {
  const env = readEnvFile();
  const get = name => (process.env[name] || env[name] || '').trim();
  const key = get('DEEPL_API_KEY');
  const base = (get('DEEPL_API_URL') || (key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com')).replace(/\/+$/, '');
  return { key, base, plan: !key ? null : key.endsWith(':fx') ? 'free' : 'pro', port: +get('PORT') || 8080 };
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const DEEPL_ERRORS = {
  403: 'DeepL rejected the API key (403). Check DEEPL_API_KEY in .env.',
  429: 'Too many requests to DeepL (429). Slow down and try again.',
  456: 'DeepL character quota for this billing period is used up (456).',
};

async function deepl(endpoint, body) {
  const { key, base } = config();
  if (!key) throw new HttpError(400, 'No DeepL API key configured. Add DEEPL_API_KEY=… to .env.');
  let res;
  try {
    res = await fetch(base + endpoint, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `DeepL-Auth-Key ${key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new HttpError(502, `Could not reach DeepL: ${err.cause?.message || err.message}`);
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { message: text }; }
  if (!res.ok) throw new HttpError(res.status, DEEPL_ERRORS[res.status] || data.message || `DeepL error ${res.status}`);
  return data;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, 'Request too large')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const isStr = v => typeof v === 'string';

async function handleTranslate(req) {
  // Requiring a JSON content type forces a CORS preflight, which this server never answers,
  // so other websites can't spend your quota through it.
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Expected application/json');
  const b = await readJson(req);
  if (!Array.isArray(b.texts) || !b.texts.length || b.texts.length > MAX_TEXTS || !b.texts.every(isStr)) {
    throw new HttpError(400, `texts must be an array of 1–${MAX_TEXTS} strings`);
  }
  if (!isStr(b.target_lang) || !b.target_lang) throw new HttpError(400, 'target_lang is required');

  const body = {
    text: b.texts,
    target_lang: b.target_lang,
    tag_handling: 'xml',
    ignore_tags: ['x'],          // the page wraps placeholders like {0} in <x>…</x>
    preserve_formatting: true,
    show_billed_characters: true,
  };
  if (isStr(b.source_lang) && b.source_lang) body.source_lang = b.source_lang;
  if (isStr(b.context) && b.context) body.context = b.context;
  if (['prefer_more', 'prefer_less'].includes(b.formality)) body.formality = b.formality;

  const data = await deepl('/v2/translate', body);
  const billed = data.translations.reduce((n, t) => n + (t.billed_characters || 0), 0);
  console.log(`  translate ${b.texts.length} text(s) -> ${b.target_lang}, ${billed} chars billed`);
  return { translations: data.translations.map(t => t.text), billed };
}

const routes = {
  'GET /api/status': () => { const c = config(); return { configured: !!c.key, plan: c.plan }; },
  'GET /api/usage': () => deepl('/v2/usage'),
  'POST /api/translate': handleTranslate,
};

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

const port = config().port;
const ALLOWED_HOSTS = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);

const server = http.createServer(async (req, res) => {
  // Reject DNS-rebinding attempts: only answer requests addressed to localhost.
  if (!ALLOWED_HOSTS.has(req.headers.host)) return send(res, 403, 'text/plain', 'Forbidden host');
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    // Only index.html is served — never .env or anything else from this folder.
    return fs.readFile(path.join(ROOT, 'index.html'), (err, buf) =>
      err ? send(res, 500, 'text/plain', 'index.html missing') : send(res, 200, 'text/html; charset=utf-8', buf));
  }

  const route = routes[`${req.method} ${url.pathname}`];
  if (!route) return send(res, 404, 'text/plain', 'Not found');
  try {
    send(res, 200, 'application/json', JSON.stringify(await route(req)));
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) console.error(err);
    send(res, status, 'application/json', JSON.stringify({ error: err.message }));
  }
});

server.listen(port, '127.0.0.1', () => {
  const c = config();
  console.log(`translate-my-stuff running at http://localhost:${port}`);
  console.log(c.key ? `DeepL: ${c.plan} API key configured (${c.base})` :'DeepL: no key yet. Add DEEPL_API_KEY=... to .env (no restart needed).');
});
