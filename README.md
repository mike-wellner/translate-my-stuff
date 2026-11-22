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

## Screenshots

Put a folder named `screenshots` next to a `.po` file, with one picture per entry, and the editor shows the picture of
the current entry above its source text (click it to enlarge, <kbd>Alt</kbd>+<kbd>P</kbd> to hide or show it).
A second row of tabs under the status tabs then lists only the strings **with screenshot** or **without** one; it
combines with the status tabs and the search, and each row counts what the other one leaves.

```
projects/project-name/
  de.po
  screenshots/
    some-kind-of-description-3f2a9c1e7b04.webp
    screenshots.json          (optional)
```

A picture is matched to its entry by the 12 hex digits before the extension (`.webp`, `.png` or `.jpg`): the start of
the 64-bit FNV-1a hash of the UTF-8 bytes of the entry's gettext key, which is the `msgid`, or `msgctxt` + `\u0004` +
`msgid` when the entry has a context. Everything before the last dash is only there for people and is ignored.

The optional `screenshots.json` says how the text appears in each picture, shown as a caption:

```json
{ "shots": { "some-kind-of-description-3f2a9c1e7b04.webp": { "kind": "whole", "width": 1280, "height": 720 } } }
```

`kind` is `whole` (the outlined text is this entry), `part` (the entry is part of the outlined text) or `tooltip` (the entry is the tooltip of the outlined element). 

## Merge

When you translate a copy of a `.po` file (for example `projects/my-game/de.po`, next to its screenshots), the original
in the game's project keeps changing: new strings come in, old ones go away. **Merge…** in the header keeps the open
file and the original in step.

1. Open the copy, click **Merge…** and pick the other file (for example `locale/de.po` in the game's project). The page
   remembers your choice per file, so next time it's **Use “de.po” again**.
2. The dialog shows what each option would change, with the strings involved under **Show them**:
   - **Add new strings** that the selected file has and the open file doesn't. They come with the selected file's
     translation if it has one, and are placed where they stand in the selected file.
   - **Remove strings** that the selected file no longer has. The dialog says how many of them are translated here.
   - **Write translations back** into the selected file: every entry translated here whose text or “needs review”
     state differs. A translation that exists only in the selected file is never erased.
   - **Update “Used in” places and notes** (`#:` and `#.` lines) from the selected file. Translator comments, flags and
     translations stay.
3. **Merge** writes both files. Strings are matched by `msgctxt` + `msgid`. Entries that don't change keep their
   lines byte for byte, and unsaved edits in the open file are included. If the selected file changed since it was
   read, the dialog updates its numbers instead of merging.

A `.pot` template can be selected too, to add and remove strings; it has no translations to write back to. Without the
File System Access API (Firefox, Safari), the selected file is written back as a download.

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
