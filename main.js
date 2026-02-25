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
  async onload() {
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
        return null;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luLCBOb3RpY2UsIFN1Z2dlc3RNb2RhbCwgQXBwLCBub3JtYWxpemVQYXRoLCBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbnRlcmZhY2UgQm9va21hcmtJdGVtIHtcblx0dHlwZTogXCJmaWxlXCIgfCBcImdyb3VwXCI7XG5cdGN0aW1lOiBudW1iZXI7XG5cdHBhdGg/OiBzdHJpbmc7XG5cdHRpdGxlPzogc3RyaW5nO1xuXHRpdGVtcz86IEJvb2ttYXJrSXRlbVtdO1xufVxuXG5pbnRlcmZhY2UgQm9va21hcmtzRGF0YSB7XG5cdGl0ZW1zOiBCb29rbWFya0l0ZW1bXTtcbn1cblxuaW50ZXJmYWNlIEJvb2ttYXJrc1BsdWdpbkluc3RhbmNlIHtcblx0aXRlbXM6IEJvb2ttYXJrSXRlbVtdO1xuXHRyZXF1ZXN0U2F2ZT86ICgpID0+IHZvaWQ7XG59XG5cbmludGVyZmFjZSBJbnRlcm5hbFBsdWdpbnMge1xuXHRnZXRQbHVnaW5CeUlkPyhpZDogc3RyaW5nKTogeyBpbnN0YW5jZT86IEJvb2ttYXJrc1BsdWdpbkluc3RhbmNlIH0gfCB1bmRlZmluZWQ7XG59XG5cbmNsYXNzIEdyb3VwU3VnZ2VzdE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPHN0cmluZz4ge1xuXHRncm91cHM6IHN0cmluZ1tdO1xuXHRvblNlbGVjdDogKGdyb3VwOiBzdHJpbmcpID0+IHZvaWQ7XG5cblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIGdyb3Vwczogc3RyaW5nW10sIG9uU2VsZWN0OiAoZ3JvdXA6IHN0cmluZykgPT4gdm9pZCkge1xuXHRcdHN1cGVyKGFwcCk7XG5cdFx0dGhpcy5ncm91cHMgPSBncm91cHM7XG5cdFx0dGhpcy5vblNlbGVjdCA9IG9uU2VsZWN0O1xuXHRcdHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJUeXBlIGEgYm9va21hcmsgZ3JvdXAgbmFtZS4uLlwiKTtcblx0fVxuXG5cdGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgbG93ZXIgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuXHRcdGNvbnN0IG1hdGNoZXMgPSB0aGlzLmdyb3Vwcy5maWx0ZXIoKGcpID0+XG5cdFx0XHRnLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMobG93ZXIpXG5cdFx0KTtcblx0XHRpZiAocXVlcnkgJiYgIXRoaXMuZ3JvdXBzLnNvbWUoKGcpID0+IGcudG9Mb3dlckNhc2UoKSA9PT0gbG93ZXIpKSB7XG5cdFx0XHRtYXRjaGVzLnB1c2gocXVlcnkpO1xuXHRcdH1cblx0XHRyZXR1cm4gbWF0Y2hlcztcblx0fVxuXG5cdHJlbmRlclN1Z2dlc3Rpb24oZ3JvdXA6IHN0cmluZywgZWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29uc3QgaXNOZXcgPSAhdGhpcy5ncm91cHMuaW5jbHVkZXMoZ3JvdXApO1xuXHRcdGVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgdGV4dDogaXNOZXcgPyBgJHtncm91cH0gKG5ldyBncm91cClgIDogZ3JvdXAgfSk7XG5cdH1cblxuXHRvbkNob29zZVN1Z2dlc3Rpb24oZ3JvdXA6IHN0cmluZykge1xuXHRcdHRoaXMub25TZWxlY3QoZ3JvdXApO1xuXHR9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEJvb2ttYXJrQVBJIGV4dGVuZHMgUGx1Z2luIHtcblx0cHJpdmF0ZSBnZXQgYm9va21hcmtzUGF0aCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBub3JtYWxpemVQYXRoKGAke3RoaXMuYXBwLnZhdWx0LmNvbmZpZ0Rpcn0vYm9va21hcmtzLmpzb25gKTtcblx0fVxuXG5cdGFzeW5jIG9ubG9hZCgpIHtcblx0XHRjb25zdCBhcGkgPSB7XG5cdFx0XHRhZGRCb29rbWFyazogKGdyb3VwTmFtZTogc3RyaW5nLCBmaWxlUGF0aD86IHN0cmluZywgdGl0bGU/OiBzdHJpbmcpID0+XG5cdFx0XHRcdHRoaXMuYWRkQm9va21hcmsoZ3JvdXBOYW1lLCBmaWxlUGF0aCwgdGl0bGUpLFxuXHRcdFx0cmVtb3ZlQm9va21hcms6IChncm91cE5hbWU6IHN0cmluZywgZmlsZVBhdGg/OiBzdHJpbmcpID0+XG5cdFx0XHRcdHRoaXMucmVtb3ZlQm9va21hcmsoZ3JvdXBOYW1lLCBmaWxlUGF0aCksXG5cdFx0XHRtb3ZlQm9va21hcms6IChmcm9tR3JvdXA6IHN0cmluZywgdG9Hcm91cDogc3RyaW5nLCBmaWxlUGF0aD86IHN0cmluZykgPT5cblx0XHRcdFx0dGhpcy5tb3ZlQm9va21hcmsoZnJvbUdyb3VwLCB0b0dyb3VwLCBmaWxlUGF0aCksXG5cdFx0XHRyZW1vdmVCb29rbWFya0dyb3VwOiAoZ3JvdXBOYW1lOiBzdHJpbmcsIGRlbGV0ZUZpbGVzPzogYm9vbGVhbikgPT5cblx0XHRcdFx0dGhpcy5yZW1vdmVCb29rbWFya0dyb3VwKGdyb3VwTmFtZSwgZGVsZXRlRmlsZXMpLFxuXHRcdH07XG5cblx0XHRjb25zdCB3aW4gPSB3aW5kb3cgYXMgdW5rbm93biBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcblx0XHRmb3IgKGNvbnN0IFtuYW1lLCBmbl0gb2YgT2JqZWN0LmVudHJpZXMoYXBpKSkge1xuXHRcdFx0d2luW25hbWVdID0gZm47XG5cdFx0fVxuXG5cdFx0dGhpcy5hZGRDb21tYW5kKHtcblx0XHRcdGlkOiBcImFkZC10by1ib29rbWFyay1ncm91cFwiLFxuXHRcdFx0bmFtZTogXCJBZGQgZmlsZSB0byBib29rbWFyayBncm91cFwiLFxuXHRcdFx0Y2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKSkgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRpZiAoIWNoZWNraW5nKSB7XG5cdFx0XHRcdFx0bmV3IEdyb3VwU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCB0aGlzLmdldEdyb3VwTmFtZXMoKSwgKGdyb3VwKSA9PiB7XG5cdFx0XHRcdFx0XHR2b2lkIHRoaXMuYWRkQm9va21hcmsoZ3JvdXApO1xuXHRcdFx0XHRcdH0pLm9wZW4oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHR0aGlzLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6IFwicmVtb3ZlLWZyb20tYm9va21hcmstZ3JvdXBcIixcblx0XHRcdG5hbWU6IFwiUmVtb3ZlIGZpbGUgZnJvbSBib29rbWFyayBncm91cFwiLFxuXHRcdFx0Y2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKSkgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRpZiAoIWNoZWNraW5nKSB7XG5cdFx0XHRcdFx0bmV3IEdyb3VwU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCB0aGlzLmdldEdyb3VwTmFtZXMoKSwgKGdyb3VwKSA9PiB7XG5cdFx0XHRcdFx0XHR2b2lkIHRoaXMucmVtb3ZlQm9va21hcmsoZ3JvdXApO1xuXHRcdFx0XHRcdH0pLm9wZW4oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cblxuXHRvbnVubG9hZCgpIHtcblx0XHRjb25zdCB3aW4gPSB3aW5kb3cgYXMgdW5rbm93biBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcblx0XHRmb3IgKGNvbnN0IG5hbWUgb2YgW1wiYWRkQm9va21hcmtcIiwgXCJyZW1vdmVCb29rbWFya1wiLCBcIm1vdmVCb29rbWFya1wiLCBcInJlbW92ZUJvb2ttYXJrR3JvdXBcIl0pIHtcblx0XHRcdGRlbGV0ZSB3aW5bbmFtZV07XG5cdFx0fVxuXHR9XG5cblx0Ly8gXHUyNTAwXHUyNTAwIFB1YmxpYyBBUEkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cblx0YXN5bmMgYWRkQm9va21hcmsoZ3JvdXBOYW1lOiBzdHJpbmcsIGZpbGVQYXRoPzogc3RyaW5nLCB0aXRsZT86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGZpbGVQYXRoID0gdGhpcy5yZXNvbHZlRmlsZVBhdGgoZmlsZVBhdGgpO1xuXHRcdGlmICghZmlsZVBhdGgpIHJldHVybjtcblxuXHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLnJlYWRCb29rbWFya3MoKTtcblxuXHRcdGNvbnN0IGdyb3VwID0gdGhpcy5maW5kT3JDcmVhdGVHcm91cChkYXRhLml0ZW1zLCBncm91cE5hbWUpO1xuXHRcdGlmICh0aGlzLmdyb3VwSGFzRmlsZShncm91cCwgZmlsZVBhdGgpKSB7XG5cdFx0XHRuZXcgTm90aWNlKGBcIiR7ZmlsZVBhdGh9XCIgaXMgYWxyZWFkeSBpbiBcIiR7Z3JvdXBOYW1lfVwiLmApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBlbnRyeTogQm9va21hcmtJdGVtID0geyB0eXBlOiBcImZpbGVcIiwgY3RpbWU6IERhdGUubm93KCksIHBhdGg6IGZpbGVQYXRoIH07XG5cdFx0aWYgKHRpdGxlKSBlbnRyeS50aXRsZSA9IHRpdGxlO1xuXHRcdGdyb3VwLml0ZW1zIS5wdXNoKGVudHJ5KTtcblxuXHRcdGF3YWl0IHRoaXMud3JpdGVCb29rbWFya3MoZGF0YSk7XG5cdFx0dGhpcy5zeW5jSW5zdGFuY2UoZGF0YS5pdGVtcyk7XG5cblx0XHRjb25zdCBkaXNwbGF5ID0gdGl0bGUgPz8gZmlsZVBhdGg7XG5cdFx0bmV3IE5vdGljZShgQWRkZWQgXCIke2Rpc3BsYXl9XCIgdG8gXCIke2dyb3VwTmFtZX1cIi5gKTtcblx0fVxuXG5cdGFzeW5jIHJlbW92ZUJvb2ttYXJrKGdyb3VwTmFtZTogc3RyaW5nLCBmaWxlUGF0aD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGZpbGVQYXRoID0gdGhpcy5yZXNvbHZlRmlsZVBhdGgoZmlsZVBhdGgpO1xuXHRcdGlmICghZmlsZVBhdGgpIHJldHVybjtcblxuXHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLnJlYWRCb29rbWFya3MoKTtcblxuXHRcdGNvbnN0IGdyb3VwID0gdGhpcy5maW5kR3JvdXAoZGF0YS5pdGVtcywgZ3JvdXBOYW1lKTtcblx0XHRpZiAoIWdyb3VwIHx8ICF0aGlzLnJlbW92ZUZpbGVGcm9tR3JvdXAoZ3JvdXAsIGZpbGVQYXRoKSkge1xuXHRcdFx0bmV3IE5vdGljZShgXCIke2ZpbGVQYXRofVwiIG5vdCBmb3VuZCBpbiBcIiR7Z3JvdXBOYW1lfVwiLmApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMud3JpdGVCb29rbWFya3MoZGF0YSk7XG5cdFx0dGhpcy5zeW5jSW5zdGFuY2UoZGF0YS5pdGVtcyk7XG5cblx0XHRuZXcgTm90aWNlKGBSZW1vdmVkIFwiJHtmaWxlUGF0aH1cIiBmcm9tIFwiJHtncm91cE5hbWV9XCIuYCk7XG5cdH1cblxuXHRhc3luYyBtb3ZlQm9va21hcmsoZnJvbUdyb3VwOiBzdHJpbmcsIHRvR3JvdXA6IHN0cmluZywgZmlsZVBhdGg/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRmaWxlUGF0aCA9IHRoaXMucmVzb2x2ZUZpbGVQYXRoKGZpbGVQYXRoKTtcblx0XHRpZiAoIWZpbGVQYXRoKSByZXR1cm47XG5cblx0XHRjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5yZWFkQm9va21hcmtzKCk7XG5cblx0XHRjb25zdCBzcmMgPSB0aGlzLmZpbmRHcm91cChkYXRhLml0ZW1zLCBmcm9tR3JvdXApO1xuXHRcdGlmICghc3JjKSB7XG5cdFx0XHRuZXcgTm90aWNlKGBHcm91cCBcIiR7ZnJvbUdyb3VwfVwiIG5vdCBmb3VuZC5gKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZW50cnkgPSB0aGlzLmV4dHJhY3RGaWxlRnJvbUdyb3VwKHNyYywgZmlsZVBhdGgpO1xuXHRcdGlmICghZW50cnkpIHtcblx0XHRcdG5ldyBOb3RpY2UoYFwiJHtmaWxlUGF0aH1cIiBub3QgZm91bmQgaW4gXCIke2Zyb21Hcm91cH1cIi5gKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZGVzdCA9IHRoaXMuZmluZE9yQ3JlYXRlR3JvdXAoZGF0YS5pdGVtcywgdG9Hcm91cCk7XG5cdFx0aWYgKHRoaXMuZ3JvdXBIYXNGaWxlKGRlc3QsIGZpbGVQYXRoKSkge1xuXHRcdFx0bmV3IE5vdGljZShgXCIke2ZpbGVQYXRofVwiIGFscmVhZHkgZXhpc3RzIGluIFwiJHt0b0dyb3VwfVwiLmApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRkZXN0Lml0ZW1zIS5wdXNoKGVudHJ5KTtcblxuXHRcdGF3YWl0IHRoaXMud3JpdGVCb29rbWFya3MoZGF0YSk7XG5cdFx0dGhpcy5zeW5jSW5zdGFuY2UoZGF0YS5pdGVtcyk7XG5cblx0XHRuZXcgTm90aWNlKGBNb3ZlZCBcIiR7ZmlsZVBhdGh9XCIgZnJvbSBcIiR7ZnJvbUdyb3VwfVwiIHRvIFwiJHt0b0dyb3VwfVwiLmApO1xuXHR9XG5cblx0YXN5bmMgcmVtb3ZlQm9va21hcmtHcm91cChncm91cE5hbWU6IHN0cmluZywgZGVsZXRlRmlsZXMgPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLnJlYWRCb29rbWFya3MoKTtcblxuXHRcdGNvbnN0IGlkeCA9IGRhdGEuaXRlbXMuZmluZEluZGV4KFxuXHRcdFx0KGkpID0+IGkudHlwZSA9PT0gXCJncm91cFwiICYmIGkudGl0bGUgPT09IGdyb3VwTmFtZVxuXHRcdCk7XG5cdFx0aWYgKGlkeCA9PT0gLTEpIHtcblx0XHRcdG5ldyBOb3RpY2UoYEdyb3VwIFwiJHtncm91cE5hbWV9XCIgbm90IGZvdW5kLmApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBncm91cCA9IGRhdGEuaXRlbXNbaWR4XTtcblx0XHRkYXRhLml0ZW1zLnNwbGljZShpZHgsIDEpO1xuXG5cdFx0YXdhaXQgdGhpcy53cml0ZUJvb2ttYXJrcyhkYXRhKTtcblx0XHR0aGlzLnN5bmNJbnN0YW5jZShkYXRhLml0ZW1zKTtcblxuXHRcdGlmIChkZWxldGVGaWxlcyAmJiBncm91cD8uaXRlbXMpIHtcblx0XHRcdGNvbnN0IGZpbGVQYXRocyA9IGdyb3VwLml0ZW1zXG5cdFx0XHRcdC5maWx0ZXIoKGkpID0+IGkudHlwZSA9PT0gXCJmaWxlXCIgJiYgaS5wYXRoKVxuXHRcdFx0XHQubWFwKChpKSA9PiBpLnBhdGghKTtcblx0XHRcdGxldCBkZWxldGVkID0gMDtcblx0XHRcdGZvciAoY29uc3QgcGF0aCBvZiBmaWxlUGF0aHMpIHtcblx0XHRcdFx0Y29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcblx0XHRcdFx0aWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuYXBwLmZpbGVNYW5hZ2VyLnRyYXNoRmlsZShmaWxlKTtcblx0XHRcdFx0XHRkZWxldGVkKys7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdG5ldyBOb3RpY2UoYFJlbW92ZWQgZ3JvdXAgXCIke2dyb3VwTmFtZX1cIiBhbmQgdHJhc2hlZCAke2RlbGV0ZWR9IGZpbGUocykuYCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG5ldyBOb3RpY2UoYFJlbW92ZWQgZ3JvdXAgXCIke2dyb3VwTmFtZX1cIi5gKTtcblx0XHR9XG5cdH1cblxuXHQvLyBcdTI1MDBcdTI1MDAgSGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuXHRwcml2YXRlIHN5bmNJbnN0YW5jZShpdGVtczogQm9va21hcmtJdGVtW10pOiB2b2lkIHtcblx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuZ2V0Qm9va21hcmtzUGx1Z2luSW5zdGFuY2UoKTtcblx0XHRpZiAoIWluc3RhbmNlPy5pdGVtcykgcmV0dXJuO1xuXHRcdGluc3RhbmNlLml0ZW1zLmxlbmd0aCA9IDA7XG5cdFx0aW5zdGFuY2UuaXRlbXMucHVzaCguLi5pdGVtcyk7XG5cdFx0aW5zdGFuY2UucmVxdWVzdFNhdmU/LigpO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlRmlsZVBhdGgoZmlsZVBhdGg/OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRpZiAoIWZpbGVQYXRoKSB7XG5cdFx0XHRjb25zdCBhY3RpdmUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXHRcdFx0aWYgKCFhY3RpdmUpIHtcblx0XHRcdFx0bmV3IE5vdGljZShcIk5vIGFjdGl2ZSBmaWxlLlwiKTtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYWN0aXZlLnBhdGg7XG5cdFx0fVxuXHRcdGZpbGVQYXRoID0gZmlsZVBhdGguZW5kc1dpdGgoXCIubWRcIikgPyBmaWxlUGF0aCA6IGZpbGVQYXRoICsgXCIubWRcIjtcblx0XHRyZXR1cm4gbm9ybWFsaXplUGF0aChmaWxlUGF0aCk7XG5cdH1cblxuXHRwcml2YXRlIGdldEJvb2ttYXJrc1BsdWdpbkluc3RhbmNlKCk6IEJvb2ttYXJrc1BsdWdpbkluc3RhbmNlIHwgbnVsbCB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGFwcCA9IHRoaXMuYXBwIGFzIHVua25vd24gYXMgeyBpbnRlcm5hbFBsdWdpbnM/OiBJbnRlcm5hbFBsdWdpbnMgfTtcblx0XHRcdHJldHVybiBhcHAuaW50ZXJuYWxQbHVnaW5zPy5nZXRQbHVnaW5CeUlkPy4oXCJib29rbWFya3NcIik/Lmluc3RhbmNlID8/IG51bGw7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldEdyb3VwTmFtZXMoKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IGluc3RhbmNlID0gdGhpcy5nZXRCb29rbWFya3NQbHVnaW5JbnN0YW5jZSgpO1xuXHRcdGNvbnN0IGl0ZW1zOiBCb29rbWFya0l0ZW1bXSA9IGluc3RhbmNlPy5pdGVtcyA/PyBbXTtcblx0XHRyZXR1cm4gaXRlbXNcblx0XHRcdC5maWx0ZXIoKGkpID0+IGkudHlwZSA9PT0gXCJncm91cFwiICYmIGkudGl0bGUpXG5cdFx0XHQubWFwKChpKSA9PiBpLnRpdGxlIGFzIHN0cmluZyk7XG5cdH1cblxuXHRwcml2YXRlIGZpbmRHcm91cChpdGVtczogQm9va21hcmtJdGVtW10sIGdyb3VwTmFtZTogc3RyaW5nKTogQm9va21hcmtJdGVtIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gaXRlbXMuZmluZCgoaSkgPT4gaS50eXBlID09PSBcImdyb3VwXCIgJiYgaS50aXRsZSA9PT0gZ3JvdXBOYW1lKTtcblx0fVxuXG5cdHByaXZhdGUgZmluZE9yQ3JlYXRlR3JvdXAoaXRlbXM6IEJvb2ttYXJrSXRlbVtdLCBncm91cE5hbWU6IHN0cmluZyk6IEJvb2ttYXJrSXRlbSB7XG5cdFx0bGV0IGdyb3VwID0gdGhpcy5maW5kR3JvdXAoaXRlbXMsIGdyb3VwTmFtZSk7XG5cdFx0aWYgKCFncm91cCkge1xuXHRcdFx0Z3JvdXAgPSB7IHR5cGU6IFwiZ3JvdXBcIiwgY3RpbWU6IERhdGUubm93KCksIGl0ZW1zOiBbXSwgdGl0bGU6IGdyb3VwTmFtZSB9O1xuXHRcdFx0aXRlbXMucHVzaChncm91cCk7XG5cdFx0fVxuXHRcdGlmICghZ3JvdXAuaXRlbXMpIGdyb3VwLml0ZW1zID0gW107XG5cdFx0cmV0dXJuIGdyb3VwO1xuXHR9XG5cblx0cHJpdmF0ZSBncm91cEhhc0ZpbGUoZ3JvdXA6IEJvb2ttYXJrSXRlbSwgZmlsZVBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBncm91cC5pdGVtcz8uc29tZSgoaSkgPT4gaS50eXBlID09PSBcImZpbGVcIiAmJiBpLnBhdGggPT09IGZpbGVQYXRoKSA/PyBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgcmVtb3ZlRmlsZUZyb21Hcm91cChncm91cDogQm9va21hcmtJdGVtLCBmaWxlUGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0aWYgKCFncm91cC5pdGVtcykgcmV0dXJuIGZhbHNlO1xuXHRcdGNvbnN0IGlkeCA9IGdyb3VwLml0ZW1zLmZpbmRJbmRleCgoaSkgPT4gaS50eXBlID09PSBcImZpbGVcIiAmJiBpLnBhdGggPT09IGZpbGVQYXRoKTtcblx0XHRpZiAoaWR4ID09PSAtMSkgcmV0dXJuIGZhbHNlO1xuXHRcdGdyb3VwLml0ZW1zLnNwbGljZShpZHgsIDEpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqIFJlbW92ZXMgYW5kIHJldHVybnMgdGhlIGZpbGUgZW50cnksIG9yIG51bGwgaWYgbm90IGZvdW5kLiAqL1xuXHRwcml2YXRlIGV4dHJhY3RGaWxlRnJvbUdyb3VwKGdyb3VwOiBCb29rbWFya0l0ZW0sIGZpbGVQYXRoOiBzdHJpbmcpOiBCb29rbWFya0l0ZW0gfCBudWxsIHtcblx0XHRpZiAoIWdyb3VwLml0ZW1zKSByZXR1cm4gbnVsbDtcblx0XHRjb25zdCBpZHggPSBncm91cC5pdGVtcy5maW5kSW5kZXgoKGkpID0+IGkudHlwZSA9PT0gXCJmaWxlXCIgJiYgaS5wYXRoID09PSBmaWxlUGF0aCk7XG5cdFx0aWYgKGlkeCA9PT0gLTEpIHJldHVybiBudWxsO1xuXHRcdHJldHVybiBncm91cC5pdGVtcy5zcGxpY2UoaWR4LCAxKVswXTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVhZEJvb2ttYXJrcygpOiBQcm9taXNlPEJvb2ttYXJrc0RhdGE+IHtcblx0XHRjb25zdCBhZGFwdGVyID0gdGhpcy5hcHAudmF1bHQuYWRhcHRlcjtcblx0XHRpZiAoYXdhaXQgYWRhcHRlci5leGlzdHModGhpcy5ib29rbWFya3NQYXRoKSkge1xuXHRcdFx0Y29uc3QgcmF3ID0gYXdhaXQgYWRhcHRlci5yZWFkKHRoaXMuYm9va21hcmtzUGF0aCk7XG5cdFx0XHRyZXR1cm4gSlNPTi5wYXJzZShyYXcpIGFzIEJvb2ttYXJrc0RhdGE7XG5cdFx0fVxuXHRcdHJldHVybiB7IGl0ZW1zOiBbXSB9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB3cml0ZUJvb2ttYXJrcyhkYXRhOiBCb29rbWFya3NEYXRhKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcmF3ID0gSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgXCJcXHRcIik7XG5cdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZSh0aGlzLmJvb2ttYXJrc1BhdGgsIHJhdyk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0JBQXdFO0FBdUJ4RSxJQUFNLG9CQUFOLGNBQWdDLDZCQUFxQjtBQUFBLEVBSXBELFlBQVksS0FBVSxRQUFrQixVQUFtQztBQUMxRSxVQUFNLEdBQUc7QUFDVCxTQUFLLFNBQVM7QUFDZCxTQUFLLFdBQVc7QUFDaEIsU0FBSyxlQUFlLCtCQUErQjtBQUFBLEVBQ3BE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
