# Bookmark API

An Obsidian plugin that exposes global functions for programmatically managing bookmarks. Designed for use with Templater, Dataview, or any script that runs inside Obsidian.

## Building

```bash
npm install
npm run build
```

This produces `main.js` in the project root.

## Installation

Copy `main.js` and `manifest.json` into your vault's plugin directory:

```
VAULT/.obsidian/plugins/bookmark-api/
├── main.js
└── manifest.json
```

Then enable **Bookmark API** in Obsidian's Community Plugins settings.

## API

All functions are registered on `window` when the plugin loads. Every `filePath` parameter is optional — if omitted, the currently active file is used. Paths without a `.md` extension are normalized automatically.

### `addBookmark(groupName, filePath?, title?)`

Add a file to a bookmark group. Creates the group if it doesn't exist. Duplicates are skipped.

The optional `title` parameter sets a custom display name for the bookmark (instead of showing the filename).

```javascript
await addBookmark("Research", "Notes/Quantum Computing.md");

// Bookmark the active file
await addBookmark("Research");

// Bookmark with a custom display title
await addBookmark("Reading List", "Books/Deep Work.md", "Deep Work by Cal Newport");
```

### `removeBookmark(groupName, filePath?)`

Remove a file from a bookmark group.

```javascript
await removeBookmark("Research", "Notes/Quantum Computing.md");

// Remove the active file
await removeBookmark("Research");
```

### `moveBookmark(fromGroup, toGroup, filePath?)`

Move a file from one bookmark group to another. The destination group is created if it doesn't exist. The bookmark entry (including any custom title) is preserved.

```javascript
await moveBookmark("Research", "Archive", "Notes/Quantum Computing.md");

// Move the active file
await moveBookmark("Research", "Archive");
```

### `removeBookmarkGroup(groupName, deleteFiles?)`

Delete an entire bookmark group and all its entries. If `deleteFiles` is `true`, the actual files are also sent to Obsidian's trash (`.trash/` folder), so they remain recoverable. Defaults to `false`.

```javascript
// Remove the group, keep the files
await removeBookmarkGroup("Old Notes");

// Remove the group AND trash all the files in it
await removeBookmarkGroup("Old Notes", true);
```

## Commands

Two commands are available from the command palette:

- **Add file to bookmark group** — opens a searchable modal of existing groups (or type a new name) and adds the active file.
- **Remove file from bookmark group** — opens a searchable modal and removes the active file from the selected group.
