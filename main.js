var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => BookmarkAPI
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var GroupSuggestModal = class extends import_obsidian.SuggestModal {
  constructor(app, groups, onSelect) {
    super(app);
    this.groups = groups;
    this.onSelect = onSelect;
    this.setPlaceholder("Type a bookmark group name...");
  }
  getSuggestions(query) {
    const lower = query.toLowerCase();
    const matches = this.groups.filter(
      (g) => g.toLowerCase().includes(lower)
    );
    if (query && !this.groups.some((g) => g.toLowerCase() === lower)) {
      matches.push(query);
    }
    return matches;
  }
  renderSuggestion(group, el) {
    const isNew = !this.groups.includes(group);
    el.createEl("div", { text: isNew ? `${group} (new group)` : group });
  }
  onChooseSuggestion(group) {
    this.onSelect(group);
  }
};
var BookmarkAPI = class extends import_obsidian.Plugin {
  get bookmarksPath() {
    return (0, import_obsidian.normalizePath)(`${this.app.vault.configDir}/bookmarks.json`);
  }
  onload() {
    const api = {
      addBookmark: (groupName, filePath, title) => this.addBookmark(groupName, filePath, title),
      removeBookmark: (groupName, filePath) => this.removeBookmark(groupName, filePath),
      moveBookmark: (fromGroup, toGroup, filePath) => this.moveBookmark(fromGroup, toGroup, filePath),
      removeBookmarkGroup: (groupName, deleteFiles) => this.removeBookmarkGroup(groupName, deleteFiles)
    };
    const win = window;
    for (const [name, fn] of Object.entries(api)) {
      win[name] = fn;
    }
    this.addCommand({
      id: "add-to-bookmark-group",
      name: "Add file to bookmark group",
      checkCallback: (checking) => {
        if (!this.app.workspace.getActiveFile()) return false;
        if (!checking) {
          new GroupSuggestModal(this.app, this.getGroupNames(), (group) => {
            void this.addBookmark(group);
          }).open();
        }
        return true;
      }
    });
    this.addCommand({
      id: "remove-from-bookmark-group",
      name: "Remove file from bookmark group",
      checkCallback: (checking) => {
        if (!this.app.workspace.getActiveFile()) return false;
        if (!checking) {
          new GroupSuggestModal(this.app, this.getGroupNames(), (group) => {
            void this.removeBookmark(group);
          }).open();
        }
        return true;
      }
    });
  }
  onunload() {
    const win = window;
    for (const name of ["addBookmark", "removeBookmark", "moveBookmark", "removeBookmarkGroup"]) {
      delete win[name];
    }
  }
  // ── Public API ──────────────────────────────────────────────
  async addBookmark(groupName, filePath, title) {
    filePath = this.resolveFilePath(filePath);
    if (!filePath) return;
    const data = await this.readBookmarks();
    const group = this.findOrCreateGroup(data.items, groupName);
    if (this.groupHasFile(group, filePath)) {
      new import_obsidian.Notice(`"${filePath}" is already in "${groupName}".`);
      return;
    }
    const entry = { type: "file", ctime: Date.now(), path: filePath };
    if (title) entry.title = title;
    group.items.push(entry);
    await this.writeBookmarks(data);
    this.syncInstance(data.items);
    const display = title != null ? title : filePath;
    new import_obsidian.Notice(`Added "${display}" to "${groupName}".`);
  }
  async removeBookmark(groupName, filePath) {
    filePath = this.resolveFilePath(filePath);
    if (!filePath) return;
    const data = await this.readBookmarks();
    const group = this.findGroup(data.items, groupName);
    if (!group || !this.removeFileFromGroup(group, filePath)) {
      new import_obsidian.Notice(`"${filePath}" not found in "${groupName}".`);
      return;
    }
    await this.writeBookmarks(data);
    this.syncInstance(data.items);
    new import_obsidian.Notice(`Removed "${filePath}" from "${groupName}".`);
  }
  async moveBookmark(fromGroup, toGroup, filePath) {
    filePath = this.resolveFilePath(filePath);
    if (!filePath) return;
    const data = await this.readBookmarks();
    const src = this.findGroup(data.items, fromGroup);
    if (!src) {
      new import_obsidian.Notice(`Group "${fromGroup}" not found.`);
      return;
    }
    const entry = this.extractFileFromGroup(src, filePath);
    if (!entry) {
      new import_obsidian.Notice(`"${filePath}" not found in "${fromGroup}".`);
      return;
    }
    const dest = this.findOrCreateGroup(data.items, toGroup);
    if (this.groupHasFile(dest, filePath)) {
      new import_obsidian.Notice(`"${filePath}" already exists in "${toGroup}".`);
      return;
    }
    dest.items.push(entry);
    await this.writeBookmarks(data);
    this.syncInstance(data.items);
    new import_obsidian.Notice(`Moved "${filePath}" from "${fromGroup}" to "${toGroup}".`);
  }
  async removeBookmarkGroup(groupName, deleteFiles = false) {
    const data = await this.readBookmarks();
    const idx = data.items.findIndex(
      (i) => i.type === "group" && i.title === groupName
    );
    if (idx === -1) {
      new import_obsidian.Notice(`Group "${groupName}" not found.`);
      return;
    }
    const group = data.items[idx];
    data.items.splice(idx, 1);
    await this.writeBookmarks(data);
    this.syncInstance(data.items);
    if (deleteFiles && (group == null ? void 0 : group.items)) {
      const filePaths = group.items.filter((i) => i.type === "file" && i.path).map((i) => i.path);
      let deleted = 0;
      for (const path of filePaths) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof import_obsidian.TFile) {
          await this.app.fileManager.trashFile(file);
          deleted++;
        }
      }
      new import_obsidian.Notice(`Removed group "${groupName}" and trashed ${deleted} file(s).`);
    } else {
      new import_obsidian.Notice(`Removed group "${groupName}".`);
    }
  }
  // ── Helpers ─────────────────────────────────────────────────
  syncInstance(items) {
    var _a;
    const instance = this.getBookmarksPluginInstance();
    if (!(instance == null ? void 0 : instance.items)) return;
    instance.items.length = 0;
    instance.items.push(...items);
    (_a = instance.requestSave) == null ? void 0 : _a.call(instance);
  }
  resolveFilePath(filePath) {
    if (!filePath) {
      const active = this.app.workspace.getActiveFile();
      if (!active) {
        new import_obsidian.Notice("No active file.");
        return void 0;
      }
      return active.path;
    }
    filePath = filePath.endsWith(".md") ? filePath : filePath + ".md";
    return (0, import_obsidian.normalizePath)(filePath);
  }
  getBookmarksPluginInstance() {
    var _a, _b, _c, _d;
    try {
      const app = this.app;
      return (_d = (_c = (_b = (_a = app.internalPlugins) == null ? void 0 : _a.getPluginById) == null ? void 0 : _b.call(_a, "bookmarks")) == null ? void 0 : _c.instance) != null ? _d : null;
    } catch (e) {
      return null;
    }
  }
  getGroupNames() {
    var _a;
    const instance = this.getBookmarksPluginInstance();
    const items = (_a = instance == null ? void 0 : instance.items) != null ? _a : [];
    return items.filter((i) => i.type === "group" && i.title).map((i) => i.title);
  }
  findGroup(items, groupName) {
    return items.find((i) => i.type === "group" && i.title === groupName);
  }
  findOrCreateGroup(items, groupName) {
    let group = this.findGroup(items, groupName);
    if (!group) {
      group = { type: "group", ctime: Date.now(), items: [], title: groupName };
      items.push(group);
    }
    if (!group.items) group.items = [];
    return group;
  }
  groupHasFile(group, filePath) {
    var _a, _b;
    return (_b = (_a = group.items) == null ? void 0 : _a.some((i) => i.type === "file" && i.path === filePath)) != null ? _b : false;
  }
  removeFileFromGroup(group, filePath) {
    if (!group.items) return false;
    const idx = group.items.findIndex((i) => i.type === "file" && i.path === filePath);
    if (idx === -1) return false;
    group.items.splice(idx, 1);
    return true;
  }
  /** Removes and returns the file entry, or null if not found. */
  extractFileFromGroup(group, filePath) {
    if (!group.items) return null;
    const idx = group.items.findIndex((i) => i.type === "file" && i.path === filePath);
    if (idx === -1) return null;
    return group.items.splice(idx, 1)[0];
  }
  async readBookmarks() {
    const adapter = this.app.vault.adapter;
    if (await adapter.exists(this.bookmarksPath)) {
      const raw = await adapter.read(this.bookmarksPath);
      return JSON.parse(raw);
    }
    return { items: [] };
  }
  async writeBookmarks(data) {
    const raw = JSON.stringify(data, null, "	");
    await this.app.vault.adapter.write(this.bookmarksPath, raw);
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luLCBOb3RpY2UsIFN1Z2dlc3RNb2RhbCwgQXBwLCBub3JtYWxpemVQYXRoLCBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbnRlcmZhY2UgQm9va21hcmtJdGVtIHtcblx0dHlwZTogXCJmaWxlXCIgfCBcImdyb3VwXCI7XG5cdGN0aW1lOiBudW1iZXI7XG5cdHBhdGg/OiBzdHJpbmc7XG5cdHRpdGxlPzogc3RyaW5nO1xuXHRpdGVtcz86IEJvb2ttYXJrSXRlbVtdO1xufVxuXG5pbnRlcmZhY2UgQm9va21hcmtzRGF0YSB7XG5cdGl0ZW1zOiBCb29rbWFya0l0ZW1bXTtcbn1cblxuaW50ZXJmYWNlIEJvb2ttYXJrc1BsdWdpbkluc3RhbmNlIHtcblx0aXRlbXM6IEJvb2ttYXJrSXRlbVtdO1xuXHRyZXF1ZXN0U2F2ZT86ICgpID0+IHZvaWQ7XG59XG5cbmludGVyZmFjZSBJbnRlcm5hbFBsdWdpbnMge1xuXHRnZXRQbHVnaW5CeUlkPyhpZDogc3RyaW5nKTogeyBpbnN0YW5jZT86IEJvb2ttYXJrc1BsdWdpbkluc3RhbmNlIH0gfCB1bmRlZmluZWQ7XG59XG5cbmNsYXNzIEdyb3VwU3VnZ2VzdE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPHN0cmluZz4ge1xuXHRncm91cHM6IHN0cmluZ1tdO1xuXHRvblNlbGVjdDogKGdyb3VwOiBzdHJpbmcpID0+IHZvaWQ7XG5cblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIGdyb3Vwczogc3RyaW5nW10sIG9uU2VsZWN0OiAoZ3JvdXA6IHN0cmluZykgPT4gdm9pZCkge1xuXHRcdHN1cGVyKGFwcCk7XG5cdFx0dGhpcy5ncm91cHMgPSBncm91cHM7XG5cdFx0dGhpcy5vblNlbGVjdCA9IG9uU2VsZWN0O1xuXHRcdHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJUeXBlIGEgYm9va21hcmsgZ3JvdXAgbmFtZS4uLlwiKTtcblx0fVxuXG5cdGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgbG93ZXIgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuXHRcdGNvbnN0IG1hdGNoZXMgPSB0aGlzLmdyb3Vwcy5maWx0ZXIoKGcpID0+XG5cdFx0XHRnLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMobG93ZXIpXG5cdFx0KTtcblx0XHRpZiAocXVlcnkgJiYgIXRoaXMuZ3JvdXBzLnNvbWUoKGcpID0+IGcudG9Mb3dlckNhc2UoKSA9PT0gbG93ZXIpKSB7XG5cdFx0XHRtYXRjaGVzLnB1c2gocXVlcnkpO1xuXHRcdH1cblx0XHRyZXR1cm4gbWF0Y2hlcztcblx0fVxuXG5cdHJlbmRlclN1Z2dlc3Rpb24oZ3JvdXA6IHN0cmluZywgZWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29uc3QgaXNOZXcgPSAhdGhpcy5ncm91cHMuaW5jbHVkZXMoZ3JvdXApO1xuXHRcdGVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgdGV4dDogaXNOZXcgPyBgJHtncm91cH0gKG5ldyBncm91cClgIDogZ3JvdXAgfSk7XG5cdH1cblxuXHRvbkNob29zZVN1Z2dlc3Rpb24oZ3JvdXA6IHN0cmluZykge1xuXHRcdHRoaXMub25TZWxlY3QoZ3JvdXApO1xuXHR9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEJvb2ttYXJrQVBJIGV4dGVuZHMgUGx1Z2luIHtcblx0cHJpdmF0ZSBnZXQgYm9va21hcmtzUGF0aCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBub3JtYWxpemVQYXRoKGAke3RoaXMuYXBwLnZhdWx0LmNvbmZpZ0Rpcn0vYm9va21hcmtzLmpzb25gKTtcblx0fVxuXG5cdG9ubG9hZCgpIHtcblx0XHRjb25zdCBhcGkgPSB7XG5cdFx0XHRhZGRCb29rbWFyazogKGdyb3VwTmFtZTogc3RyaW5nLCBmaWxlUGF0aD86IHN0cmluZywgdGl0bGU/OiBzdHJpbmcpID0+XG5cdFx0XHRcdHRoaXMuYWRkQm9va21hcmsoZ3JvdXBOYW1lLCBmaWxlUGF0aCwgdGl0bGUpLFxuXHRcdFx0cmVtb3ZlQm9va21hcms6IChncm91cE5hbWU6IHN0cmluZywgZmlsZVBhdGg/OiBzdHJpbmcpID0+XG5cdFx0XHRcdHRoaXMucmVtb3ZlQm9va21hcmsoZ3JvdXBOYW1lLCBmaWxlUGF0aCksXG5cdFx0XHRtb3ZlQm9va21hcms6IChmcm9tR3JvdXA6IHN0cmluZywgdG9Hcm91cDogc3RyaW5nLCBmaWxlUGF0aD86IHN0cmluZykgPT5cblx0XHRcdFx0dGhpcy5tb3ZlQm9va21hcmsoZnJvbUdyb3VwLCB0b0dyb3VwLCBmaWxlUGF0aCksXG5cdFx0XHRyZW1vdmVCb29rbWFya0dyb3VwOiAoZ3JvdXBOYW1lOiBzdHJpbmcsIGRlbGV0ZUZpbGVzPzogYm9vbGVhbikgPT5cblx0XHRcdFx0dGhpcy5yZW1vdmVCb29rbWFya0dyb3VwKGdyb3VwTmFtZSwgZGVsZXRlRmlsZXMpLFxuXHRcdH07XG5cblx0XHRjb25zdCB3aW4gPSB3aW5kb3cgYXMgdW5rbm93biBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcblx0XHRmb3IgKGNvbnN0IFtuYW1lLCBmbl0gb2YgT2JqZWN0LmVudHJpZXMoYXBpKSkge1xuXHRcdFx0d2luW25hbWVdID0gZm47XG5cdFx0fVxuXG5cdFx0dGhpcy5hZGRDb21tYW5kKHtcblx0XHRcdGlkOiBcImFkZC10by1ib29rbWFyay1ncm91cFwiLFxuXHRcdFx0bmFtZTogXCJBZGQgZmlsZSB0byBib29rbWFyayBncm91cFwiLFxuXHRcdFx0Y2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKSkgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRpZiAoIWNoZWNraW5nKSB7XG5cdFx0XHRcdFx0bmV3IEdyb3VwU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCB0aGlzLmdldEdyb3VwTmFtZXMoKSwgKGdyb3VwKSA9PiB7XG5cdFx0XHRcdFx0XHR2b2lkIHRoaXMuYWRkQm9va21hcmsoZ3JvdXApO1xuXHRcdFx0XHRcdH0pLm9wZW4oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHR0aGlzLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6IFwicmVtb3ZlLWZyb20tYm9va21hcmstZ3JvdXBcIixcblx0XHRcdG5hbWU6IFwiUmVtb3ZlIGZpbGUgZnJvbSBib29rbWFyayBncm91cFwiLFxuXHRcdFx0Y2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKSkgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRpZiAoIWNoZWNraW5nKSB7XG5cdFx0XHRcdFx0bmV3IEdyb3VwU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCB0aGlzLmdldEdyb3VwTmFtZXMoKSwgKGdyb3VwKSA9PiB7XG5cdFx0XHRcdFx0XHR2b2lkIHRoaXMucmVtb3ZlQm9va21hcmsoZ3JvdXApO1xuXHRcdFx0XHRcdH0pLm9wZW4oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cblxuXHRvbnVubG9hZCgpIHtcblx0XHRjb25zdCB3aW4gPSB3aW5kb3cgYXMgdW5rbm93biBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcblx0XHRmb3IgKGNvbnN0IG5hbWUgb2YgW1wiYWRkQm9va21hcmtcIiwgXCJyZW1vdmVCb29rbWFya1wiLCBcIm1vdmVCb29rbWFya1wiLCBcInJlbW92ZUJvb2ttYXJrR3JvdXBcIl0pIHtcblx0XHRcdGRlbGV0ZSB3aW5bbmFtZV07XG5cdFx0fVxuXHR9XG5cblx0Ly8gXHUyNTAwXHUyNTAwIFB1YmxpYyBBUEkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cblx0YXN5bmMgYWRkQm9va21hcmsoZ3JvdXBOYW1lOiBzdHJpbmcsIGZpbGVQYXRoPzogc3RyaW5nLCB0aXRsZT86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGZpbGVQYXRoID0gdGhpcy5yZXNvbHZlRmlsZVBhdGgoZmlsZVBhdGgpO1xuXHRcdGlmICghZmlsZVBhdGgpIHJldHVybjtcblxuXHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLnJlYWRCb29rbWFya3MoKTtcblxuXHRcdGNvbnN0IGdyb3VwID0gdGhpcy5maW5kT3JDcmVhdGVHcm91cChkYXRhLml0ZW1zLCBncm91cE5hbWUpO1xuXHRcdGlmICh0aGlzLmdyb3VwSGFzRmlsZShncm91cCwgZmlsZVBhdGgpKSB7XG5cdFx0XHRuZXcgTm90aWNlKGBcIiR7ZmlsZVBhdGh9XCIgaXMgYWxyZWFkeSBpbiBcIiR7Z3JvdXBOYW1lfVwiLmApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBlbnRyeTogQm9va21hcmtJdGVtID0geyB0eXBlOiBcImZpbGVcIiwgY3RpbWU6IERhdGUubm93KCksIHBhdGg6IGZpbGVQYXRoIH07XG5cdFx0aWYgKHRpdGxlKSBlbnRyeS50aXRsZSA9IHRpdGxlO1xuXHRcdGdyb3VwLml0ZW1zIS5wdXNoKGVudHJ5KTtcblxuXHRcdGF3YWl0IHRoaXMud3JpdGVCb29rbWFya3MoZGF0YSk7XG5cdFx0dGhpcy5zeW5jSW5zdGFuY2UoZGF0YS5pdGVtcyk7XG5cblx0XHRjb25zdCBkaXNwbGF5ID0gdGl0bGUgPz8gZmlsZVBhdGg7XG5cdFx0bmV3IE5vdGljZShgQWRkZWQgXCIke2Rpc3BsYXl9XCIgdG8gXCIke2dyb3VwTmFtZX1cIi5gKTtcblx0fVxuXG5cdGFzeW5jIHJlbW92ZUJvb2ttYXJrKGdyb3VwTmFtZTogc3RyaW5nLCBmaWxlUGF0aD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGZpbGVQYXRoID0gdGhpcy5yZXNvbHZlRmlsZVBhdGgoZmlsZVBhdGgpO1xuXHRcdGlmICghZmlsZVBhdGgpIHJldHVybjtcblxuXHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLnJlYWRCb29rbWFya3MoKTtcblxuXHRcdGNvbnN0IGdyb3VwID0gdGhpcy5maW5kR3JvdXAoZGF0YS5pdGVtcywgZ3JvdXBOYW1lKTtcblx0XHRpZiAoIWdyb3VwIHx8ICF0aGlzLnJlbW92ZUZpbGVGcm9tR3JvdXAoZ3JvdXAsIGZpbGVQYXRoKSkge1xuXHRcdFx0bmV3IE5vdGljZShgXCIke2ZpbGVQYXRofVwiIG5vdCBmb3VuZCBpbiBcIiR7Z3JvdXBOYW1lfVwiLmApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMud3JpdGVCb29rbWFya3MoZGF0YSk7XG5cdFx0dGhpcy5zeW5jSW5zdGFuY2UoZGF0YS5pdGVtcyk7XG5cblx0XHRuZXcgTm90aWNlKGBSZW1vdmVkIFwiJHtmaWxlUGF0aH1cIiBmcm9tIFwiJHtncm91cE5hbWV9XCIuYCk7XG5cdH1cblxuXHRhc3luYyBtb3ZlQm9va21hcmsoZnJvbUdyb3VwOiBzdHJpbmcsIHRvR3JvdXA6IHN0cmluZywgZmlsZVBhdGg/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRmaWxlUGF0aCA9IHRoaXMucmVzb2x2ZUZpbGVQYXRoKGZpbGVQYXRoKTtcblx0XHRpZiAoIWZpbGVQYXRoKSByZXR1cm47XG5cblx0XHRjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5yZWFkQm9va21hcmtzKCk7XG5cblx0XHRjb25zdCBzcmMgPSB0aGlzLmZpbmRHcm91cChkYXRhLml0ZW1zLCBmcm9tR3JvdXApO1xuXHRcdGlmICghc3JjKSB7XG5cdFx0XHRuZXcgTm90aWNlKGBHcm91cCBcIiR7ZnJvbUdyb3VwfVwiIG5vdCBmb3VuZC5gKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZW50cnkgPSB0aGlzLmV4dHJhY3RGaWxlRnJvbUdyb3VwKHNyYywgZmlsZVBhdGgpO1xuXHRcdGlmICghZW50cnkpIHtcblx0XHRcdG5ldyBOb3RpY2UoYFwiJHtmaWxlUGF0aH1cIiBub3QgZm91bmQgaW4gXCIke2Zyb21Hcm91cH1cIi5gKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZGVzdCA9IHRoaXMuZmluZE9yQ3JlYXRlR3JvdXAoZGF0YS5pdGVtcywgdG9Hcm91cCk7XG5cdFx0aWYgKHRoaXMuZ3JvdXBIYXNGaWxlKGRlc3QsIGZpbGVQYXRoKSkge1xuXHRcdFx0bmV3IE5vdGljZShgXCIke2ZpbGVQYXRofVwiIGFscmVhZHkgZXhpc3RzIGluIFwiJHt0b0dyb3VwfVwiLmApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRkZXN0Lml0ZW1zIS5wdXNoKGVudHJ5KTtcblxuXHRcdGF3YWl0IHRoaXMud3JpdGVCb29rbWFya3MoZGF0YSk7XG5cdFx0dGhpcy5zeW5jSW5zdGFuY2UoZGF0YS5pdGVtcyk7XG5cblx0XHRuZXcgTm90aWNlKGBNb3ZlZCBcIiR7ZmlsZVBhdGh9XCIgZnJvbSBcIiR7ZnJvbUdyb3VwfVwiIHRvIFwiJHt0b0dyb3VwfVwiLmApO1xuXHR9XG5cblx0YXN5bmMgcmVtb3ZlQm9va21hcmtHcm91cChncm91cE5hbWU6IHN0cmluZywgZGVsZXRlRmlsZXMgPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLnJlYWRCb29rbWFya3MoKTtcblxuXHRcdGNvbnN0IGlkeCA9IGRhdGEuaXRlbXMuZmluZEluZGV4KFxuXHRcdFx0KGkpID0+IGkudHlwZSA9PT0gXCJncm91cFwiICYmIGkudGl0bGUgPT09IGdyb3VwTmFtZVxuXHRcdCk7XG5cdFx0aWYgKGlkeCA9PT0gLTEpIHtcblx0XHRcdG5ldyBOb3RpY2UoYEdyb3VwIFwiJHtncm91cE5hbWV9XCIgbm90IGZvdW5kLmApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBncm91cCA9IGRhdGEuaXRlbXNbaWR4XTtcblx0XHRkYXRhLml0ZW1zLnNwbGljZShpZHgsIDEpO1xuXG5cdFx0YXdhaXQgdGhpcy53cml0ZUJvb2ttYXJrcyhkYXRhKTtcblx0XHR0aGlzLnN5bmNJbnN0YW5jZShkYXRhLml0ZW1zKTtcblxuXHRcdGlmIChkZWxldGVGaWxlcyAmJiBncm91cD8uaXRlbXMpIHtcblx0XHRcdGNvbnN0IGZpbGVQYXRocyA9IGdyb3VwLml0ZW1zXG5cdFx0XHRcdC5maWx0ZXIoKGkpID0+IGkudHlwZSA9PT0gXCJmaWxlXCIgJiYgaS5wYXRoKVxuXHRcdFx0XHQubWFwKChpKSA9PiBpLnBhdGghKTtcblx0XHRcdGxldCBkZWxldGVkID0gMDtcblx0XHRcdGZvciAoY29uc3QgcGF0aCBvZiBmaWxlUGF0aHMpIHtcblx0XHRcdFx0Y29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcblx0XHRcdFx0aWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuYXBwLmZpbGVNYW5hZ2VyLnRyYXNoRmlsZShmaWxlKTtcblx0XHRcdFx0XHRkZWxldGVkKys7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdG5ldyBOb3RpY2UoYFJlbW92ZWQgZ3JvdXAgXCIke2dyb3VwTmFtZX1cIiBhbmQgdHJhc2hlZCAke2RlbGV0ZWR9IGZpbGUocykuYCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG5ldyBOb3RpY2UoYFJlbW92ZWQgZ3JvdXAgXCIke2dyb3VwTmFtZX1cIi5gKTtcblx0XHR9XG5cdH1cblxuXHQvLyBcdTI1MDBcdTI1MDAgSGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuXHRwcml2YXRlIHN5bmNJbnN0YW5jZShpdGVtczogQm9va21hcmtJdGVtW10pOiB2b2lkIHtcblx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuZ2V0Qm9va21hcmtzUGx1Z2luSW5zdGFuY2UoKTtcblx0XHRpZiAoIWluc3RhbmNlPy5pdGVtcykgcmV0dXJuO1xuXHRcdGluc3RhbmNlLml0ZW1zLmxlbmd0aCA9IDA7XG5cdFx0aW5zdGFuY2UuaXRlbXMucHVzaCguLi5pdGVtcyk7XG5cdFx0aW5zdGFuY2UucmVxdWVzdFNhdmU/LigpO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlRmlsZVBhdGgoZmlsZVBhdGg/OiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmICghZmlsZVBhdGgpIHtcblx0XHRcdGNvbnN0IGFjdGl2ZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cdFx0XHRpZiAoIWFjdGl2ZSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKFwiTm8gYWN0aXZlIGZpbGUuXCIpO1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGFjdGl2ZS5wYXRoO1xuXHRcdH1cblx0XHRmaWxlUGF0aCA9IGZpbGVQYXRoLmVuZHNXaXRoKFwiLm1kXCIpID8gZmlsZVBhdGggOiBmaWxlUGF0aCArIFwiLm1kXCI7XG5cdFx0cmV0dXJuIG5vcm1hbGl6ZVBhdGgoZmlsZVBhdGgpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRCb29rbWFya3NQbHVnaW5JbnN0YW5jZSgpOiBCb29rbWFya3NQbHVnaW5JbnN0YW5jZSB8IG51bGwge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBhcHAgPSB0aGlzLmFwcCBhcyB1bmtub3duIGFzIHsgaW50ZXJuYWxQbHVnaW5zPzogSW50ZXJuYWxQbHVnaW5zIH07XG5cdFx0XHRyZXR1cm4gYXBwLmludGVybmFsUGx1Z2lucz8uZ2V0UGx1Z2luQnlJZD8uKFwiYm9va21hcmtzXCIpPy5pbnN0YW5jZSA/PyBudWxsO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRHcm91cE5hbWVzKCk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuZ2V0Qm9va21hcmtzUGx1Z2luSW5zdGFuY2UoKTtcblx0XHRjb25zdCBpdGVtczogQm9va21hcmtJdGVtW10gPSBpbnN0YW5jZT8uaXRlbXMgPz8gW107XG5cdFx0cmV0dXJuIGl0ZW1zXG5cdFx0XHQuZmlsdGVyKChpKSA9PiBpLnR5cGUgPT09IFwiZ3JvdXBcIiAmJiBpLnRpdGxlKVxuXHRcdFx0Lm1hcCgoaSkgPT4gaS50aXRsZSBhcyBzdHJpbmcpO1xuXHR9XG5cblx0cHJpdmF0ZSBmaW5kR3JvdXAoaXRlbXM6IEJvb2ttYXJrSXRlbVtdLCBncm91cE5hbWU6IHN0cmluZyk6IEJvb2ttYXJrSXRlbSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIGl0ZW1zLmZpbmQoKGkpID0+IGkudHlwZSA9PT0gXCJncm91cFwiICYmIGkudGl0bGUgPT09IGdyb3VwTmFtZSk7XG5cdH1cblxuXHRwcml2YXRlIGZpbmRPckNyZWF0ZUdyb3VwKGl0ZW1zOiBCb29rbWFya0l0ZW1bXSwgZ3JvdXBOYW1lOiBzdHJpbmcpOiBCb29rbWFya0l0ZW0ge1xuXHRcdGxldCBncm91cCA9IHRoaXMuZmluZEdyb3VwKGl0ZW1zLCBncm91cE5hbWUpO1xuXHRcdGlmICghZ3JvdXApIHtcblx0XHRcdGdyb3VwID0geyB0eXBlOiBcImdyb3VwXCIsIGN0aW1lOiBEYXRlLm5vdygpLCBpdGVtczogW10sIHRpdGxlOiBncm91cE5hbWUgfTtcblx0XHRcdGl0ZW1zLnB1c2goZ3JvdXApO1xuXHRcdH1cblx0XHRpZiAoIWdyb3VwLml0ZW1zKSBncm91cC5pdGVtcyA9IFtdO1xuXHRcdHJldHVybiBncm91cDtcblx0fVxuXG5cdHByaXZhdGUgZ3JvdXBIYXNGaWxlKGdyb3VwOiBCb29rbWFya0l0ZW0sIGZpbGVQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZ3JvdXAuaXRlbXM/LnNvbWUoKGkpID0+IGkudHlwZSA9PT0gXCJmaWxlXCIgJiYgaS5wYXRoID09PSBmaWxlUGF0aCkgPz8gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZUZpbGVGcm9tR3JvdXAoZ3JvdXA6IEJvb2ttYXJrSXRlbSwgZmlsZVBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGlmICghZ3JvdXAuaXRlbXMpIHJldHVybiBmYWxzZTtcblx0XHRjb25zdCBpZHggPSBncm91cC5pdGVtcy5maW5kSW5kZXgoKGkpID0+IGkudHlwZSA9PT0gXCJmaWxlXCIgJiYgaS5wYXRoID09PSBmaWxlUGF0aCk7XG5cdFx0aWYgKGlkeCA9PT0gLTEpIHJldHVybiBmYWxzZTtcblx0XHRncm91cC5pdGVtcy5zcGxpY2UoaWR4LCAxKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKiBSZW1vdmVzIGFuZCByZXR1cm5zIHRoZSBmaWxlIGVudHJ5LCBvciBudWxsIGlmIG5vdCBmb3VuZC4gKi9cblx0cHJpdmF0ZSBleHRyYWN0RmlsZUZyb21Hcm91cChncm91cDogQm9va21hcmtJdGVtLCBmaWxlUGF0aDogc3RyaW5nKTogQm9va21hcmtJdGVtIHwgbnVsbCB7XG5cdFx0aWYgKCFncm91cC5pdGVtcykgcmV0dXJuIG51bGw7XG5cdFx0Y29uc3QgaWR4ID0gZ3JvdXAuaXRlbXMuZmluZEluZGV4KChpKSA9PiBpLnR5cGUgPT09IFwiZmlsZVwiICYmIGkucGF0aCA9PT0gZmlsZVBhdGgpO1xuXHRcdGlmIChpZHggPT09IC0xKSByZXR1cm4gbnVsbDtcblx0XHRyZXR1cm4gZ3JvdXAuaXRlbXMuc3BsaWNlKGlkeCwgMSlbMF07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlYWRCb29rbWFya3MoKTogUHJvbWlzZTxCb29rbWFya3NEYXRhPiB7XG5cdFx0Y29uc3QgYWRhcHRlciA9IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXI7XG5cdFx0aWYgKGF3YWl0IGFkYXB0ZXIuZXhpc3RzKHRoaXMuYm9va21hcmtzUGF0aCkpIHtcblx0XHRcdGNvbnN0IHJhdyA9IGF3YWl0IGFkYXB0ZXIucmVhZCh0aGlzLmJvb2ttYXJrc1BhdGgpO1xuXHRcdFx0cmV0dXJuIEpTT04ucGFyc2UocmF3KSBhcyBCb29rbWFya3NEYXRhO1xuXHRcdH1cblx0XHRyZXR1cm4geyBpdGVtczogW10gfTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgd3JpdGVCb29rbWFya3MoZGF0YTogQm9va21hcmtzRGF0YSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHJhdyA9IEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIFwiXFx0XCIpO1xuXHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUodGhpcy5ib29rbWFya3NQYXRoLCByYXcpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQUF3RTtBQXVCeEUsSUFBTSxvQkFBTixjQUFnQyw2QkFBcUI7QUFBQSxFQUlwRCxZQUFZLEtBQVUsUUFBa0IsVUFBbUM7QUFDMUUsVUFBTSxHQUFHO0FBQ1QsU0FBSyxTQUFTO0FBQ2QsU0FBSyxXQUFXO0FBQ2hCLFNBQUssZUFBZSwrQkFBK0I7QUFBQSxF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
