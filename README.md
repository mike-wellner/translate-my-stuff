# translate-my-stuff

A single-page editor for gettext `.po` files (e.g. from a Godot project), with optional DeepL suggestions.
No build step, no dependencies. Needs Node 18+ only for DeepL.

## Usage

1. Start the local server: `node server.js`, then open **http://localhost:8080** in **Chrome or Edge**.
   (Without DeepL you can also just double-click `index.html`.)
2. Click **Open folder…** and pick the folder with your `.po` files (e.g. your Godot project's `locale/` folder).
   Subfolders are scanned too; only `.po` files are picked up. Allow edit access when the browser asks.
3. Translate. Changes are written straight back into the files (autosave, or <kbd>Ctrl</kbd>+<kbd>S</kbd>).

Next time, use **Reopen "…"** on the start screen to jump back into the same folder.

| Shortcut | Action |
| --- | --- |
| <kbd>Ctrl</kbd>+<kbd>Enter</kbd> | Done & next (clears "needs review") |
| <kbd>Alt</kbd>+<kbd>↓</kbd> / <kbd>Alt</kbd>+<kbd>↑</kbd> | Skip / previous |
| <kbd>Alt</kbd>+<kbd>T</kbd> | Translate this entry with DeepL |
| <kbd>Alt</kbd>+<kbd>C</kbd> | Copy source into the translation |
| <kbd>Alt</kbd>+<kbd>R</kbd> | Toggle "needs review" (`#, fuzzy` — Godot ignores fuzzy entries) |
| <kbd>Ctrl</kbd>+<kbd>K</kbd> | Search |

Clicking a placeholder like `{0}`, `%s` or a BBCode tag in the source inserts it at the cursor. A warning shows
when the translation is missing placeholders or has whitespace at the start or end that the source doesn't (or the reverse).

## DeepL

1. Copy `.env.example` to `.env` and set `DEEPL_API_KEY=` to your key
   (https://www.deepl.com/your-account/keys). `.env` is git-ignored. Free keys end in `:fx` and use `api-free.deepl.com`.
2. Click the **DeepL** chip in the header to check the connection and remaining quota. `.env` is re-read on every
   request, so no restart is needed after editing it.

- **One entry:** the **DeepL** button (<kbd>Alt</kbd>+<kbd>T</kbd>) fills in the current entry for you to review.
  The entry's `msgctxt` and developer notes are sent as context.
- **Whole set:** **Translate untranslated with DeepL…** fills every *empty* translation in the current file or all files
  and shows the character cost against your remaining quota first. By default results are marked “needs review”, so Godot
  won't use them until you approve each one in the **Review** tab with <kbd>Ctrl</kbd>+<kbd>Enter</kbd>.
- **Settings** (in the DeepL chip): source language (default `EN`), formality (du/Sie), and a context text sent with every request.
- Placeholders (`{0}`, `%s`, BBCode tags) are protected from translation, and leading/trailing whitespace is kept as-is.

The target language comes from the `Language:` header of each `.po` file.

`server.js` only listens on `127.0.0.1` and serves nothing but `index.html` and the `/api/*` relay. The key never reaches the browser.

## How files are written

Untouched entries are written back byte for byte (line endings, BOM, comments, wrapping all preserved).
For edited entries, only the `#,` flags line and the `msgstr` lines are regenerated.

Firefox/Safari can't write to local folders; there the page falls back to a folder upload and saving
**downloads** the edited files instead.
