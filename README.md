# Bookmark API

An Obsidian plugin that exposes global functions for programmatically managing bookmarks. Designed for use with Templater, Dataview, or any script that runs inside Obsidian.

## Requirements

- Obsidian's built-in **Bookmarks** core plugin must be enabled (Settings → Core Plugins → Bookmarks)

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

All functions are registered on `window` when the plugin loads and can be called directly by name. Every `filePath` parameter is optional — if omitted, the currently active file is used. Paths without a `.md` extension are normalized automatically.

| Function | Description |
|---|---|
| `addBookmark(groupName, filePath?, title?)` | Add a file to a group (creates group if needed) |
| `removeBookmark(groupName, filePath?)` | Remove a file from a group |
| `moveBookmark(fromGroup, toGroup, filePath?)` | Move a file between groups |
| `removeBookmarkGroup(groupName, deleteFiles?)` | Delete a group and optionally trash its files |

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

## Usage with Templater

[Templater](https://github.com/SilentVoid13/Templater) lets you run JavaScript inside `<%* %>` blocks. Because the Bookmark API functions are registered on `window`, you can call them directly.

### Bookmark the current file when the template runs

```markdown
<%* await addBookmark("Inbox") %>
```

### Prompt for a group name, then bookmark

```markdown
<%*
const group = await tp.system.prompt("Bookmark group:");
if (group) await addBookmark(group);
%>
```

### Add with a custom display title

```markdown
<%*
const title = await tp.system.prompt("Display title:");
await addBookmark("Reading List", tp.file.path(true), title);
%>
```

### Move the current file between groups

```markdown
<%* await moveBookmark("Inbox", "Reviewed") %>
```

### Remove the current file from a group

```markdown
<%* await removeBookmark("Inbox") %>
```

> **Tip:** Templater's `tp.file.path(true)` returns the full vault-relative path of the current file. You only need to pass it explicitly when calling the API from a different context than the active file.

## Usage with DataviewJS

[Dataview](https://github.com/blacksmithgu/obsidian-dataview) provides `dataviewjs` code blocks for inline scripting. The Bookmark API functions are available on `window` just like in Templater, and top-level `await` works inside `dataviewjs` blocks.

### Bookmark the current file

~~~markdown
```dataviewjs
await addBookmark("Favorites", dv.current().file.path);
```
~~~

### List files in a folder, then bookmark all of them

~~~markdown
```dataviewjs
const pages = dv.pages('"Projects/Active"');
for (const page of pages) {
    await addBookmark("Active Projects", page.file.path, page.file.name);
}
```
~~~

### Remove a specific file from a group

~~~markdown
```dataviewjs
await removeBookmark("Archive", "Notes/Old Note.md");
```
~~~

### Conditionally bookmark based on tags

~~~markdown
```dataviewjs
const page = dv.current();
if (page.tags?.includes("important")) {
    await addBookmark("Important", page.file.path);
}
```
~~~

> **Note:** In DataviewJS, use `dv.current().file.path` to reference the file containing the code block. If `filePath` is omitted, the API falls back to the active file, which may differ from the file the code block lives in.

### Key differences

| | Templater | DataviewJS |
|---|---|---|
| **Syntax** | `<%* await addBookmark("Group") %>` | `` `dataviewjs` `` code block |
| **Current file** | Omit `filePath` (uses active file) or use `tp.file.path(true)` | Use `dv.current().file.path` for the note containing the block |
| **When it runs** | On template insertion or Templater command | Every time the note is opened/rendered |
| **Best for** | One-time actions (bookmark on creation, move on review) | Dynamic/conditional logic tied to note metadata |

## Commands

Two commands are available from the command palette:

- **Add file to bookmark group** -- opens a searchable modal of existing groups (or type a new name) and adds the active file.
- **Remove file from bookmark group** -- opens a searchable modal and removes the active file from the selected group.
