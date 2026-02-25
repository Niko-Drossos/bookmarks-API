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
    var _a;
    filePath = this.resolveFilePath(filePath);
    if (!filePath) return;
    const instance = this.getBookmarksPluginInstance();
    if (instance == null ? void 0 : instance.items) {
      const group = this.findOrCreateGroup(instance.items, groupName);
      if (this.groupHasFile(group, filePath)) {
        new import_obsidian.Notice(`"${filePath}" is already in "${groupName}".`);
        return;
      }
      const entry = { type: "file", ctime: Date.now(), path: filePath };
      if (title) entry.title = title;
      group.items.push(entry);
      (_a = instance.requestSave) == null ? void 0 : _a.call(instance);
    } else {
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
    }
    const display = title != null ? title : filePath;
    new import_obsidian.Notice(`Added "${display}" to "${groupName}".`);
  }
  async removeBookmark(groupName, filePath) {
    var _a;
    filePath = this.resolveFilePath(filePath);
    if (!filePath) return;
    const instance = this.getBookmarksPluginInstance();
    if (instance == null ? void 0 : instance.items) {
      const group = this.findGroup(instance.items, groupName);
      if (!group || !this.removeFileFromGroup(group, filePath)) {
        new import_obsidian.Notice(`"${filePath}" not found in "${groupName}".`);
        return;
      }
      (_a = instance.requestSave) == null ? void 0 : _a.call(instance);
    } else {
      const data = await this.readBookmarks();
      const group = this.findGroup(data.items, groupName);
      if (!group || !this.removeFileFromGroup(group, filePath)) {
        new import_obsidian.Notice(`"${filePath}" not found in "${groupName}".`);
        return;
      }
      await this.writeBookmarks(data);
    }
    new import_obsidian.Notice(`Removed "${filePath}" from "${groupName}".`);
  }
  async moveBookmark(fromGroup, toGroup, filePath) {
    var _a;
    filePath = this.resolveFilePath(filePath);
    if (!filePath) return;
    const instance = this.getBookmarksPluginInstance();
    if (instance == null ? void 0 : instance.items) {
      const src = this.findGroup(instance.items, fromGroup);
      if (!src) {
        new import_obsidian.Notice(`Group "${fromGroup}" not found.`);
        return;
      }
      const entry = this.extractFileFromGroup(src, filePath);
      if (!entry) {
        new import_obsidian.Notice(`"${filePath}" not found in "${fromGroup}".`);
        return;
      }
      const dest = this.findOrCreateGroup(instance.items, toGroup);
      if (this.groupHasFile(dest, filePath)) {
        new import_obsidian.Notice(`"${filePath}" already exists in "${toGroup}".`);
        return;
      }
      dest.items.push(entry);
      (_a = instance.requestSave) == null ? void 0 : _a.call(instance);
    } else {
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
    }
    new import_obsidian.Notice(`Moved "${filePath}" from "${fromGroup}" to "${toGroup}".`);
  }
  async removeBookmarkGroup(groupName, deleteFiles = false) {
    var _a;
    let group;
    const instance = this.getBookmarksPluginInstance();
    if (instance == null ? void 0 : instance.items) {
      const idx = instance.items.findIndex(
        (i) => i.type === "group" && i.title === groupName
      );
      if (idx === -1) {
        new import_obsidian.Notice(`Group "${groupName}" not found.`);
        return;
      }
      group = instance.items[idx];
      instance.items.splice(idx, 1);
      (_a = instance.requestSave) == null ? void 0 : _a.call(instance);
    } else {
      const data = await this.readBookmarks();
      const idx = data.items.findIndex(
        (i) => i.type === "group" && i.title === groupName
      );
      if (idx === -1) {
        new import_obsidian.Notice(`Group "${groupName}" not found.`);
        return;
      }
      group = data.items[idx];
      data.items.splice(idx, 1);
      await this.writeBookmarks(data);
    }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luLCBOb3RpY2UsIFN1Z2dlc3RNb2RhbCwgQXBwLCBub3JtYWxpemVQYXRoLCBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbnRlcmZhY2UgQm9va21hcmtJdGVtIHtcblx0dHlwZTogXCJmaWxlXCIgfCBcImdyb3VwXCI7XG5cdGN0aW1lOiBudW1iZXI7XG5cdHBhdGg/OiBzdHJpbmc7XG5cdHRpdGxlPzogc3RyaW5nO1xuXHRpdGVtcz86IEJvb2ttYXJrSXRlbVtdO1xufVxuXG5pbnRlcmZhY2UgQm9va21hcmtzRGF0YSB7XG5cdGl0ZW1zOiBCb29rbWFya0l0ZW1bXTtcbn1cblxuaW50ZXJmYWNlIEJvb2ttYXJrc1BsdWdpbkluc3RhbmNlIHtcblx0aXRlbXM6IEJvb2ttYXJrSXRlbVtdO1xuXHRyZXF1ZXN0U2F2ZT86ICgpID0+IHZvaWQ7XG59XG5cbmludGVyZmFjZSBJbnRlcm5hbFBsdWdpbnMge1xuXHRnZXRQbHVnaW5CeUlkPyhpZDogc3RyaW5nKTogeyBpbnN0YW5jZT86IEJvb2ttYXJrc1BsdWdpbkluc3RhbmNlIH0gfCB1bmRlZmluZWQ7XG59XG5cbmNsYXNzIEdyb3VwU3VnZ2VzdE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPHN0cmluZz4ge1xuXHRncm91cHM6IHN0cmluZ1tdO1xuXHRvblNlbGVjdDogKGdyb3VwOiBzdHJpbmcpID0+IHZvaWQ7XG5cblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIGdyb3Vwczogc3RyaW5nW10sIG9uU2VsZWN0OiAoZ3JvdXA6IHN0cmluZykgPT4gdm9pZCkge1xuXHRcdHN1cGVyKGFwcCk7XG5cdFx0dGhpcy5ncm91cHMgPSBncm91cHM7XG5cdFx0dGhpcy5vblNlbGVjdCA9IG9uU2VsZWN0O1xuXHRcdHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJUeXBlIGEgYm9va21hcmsgZ3JvdXAgbmFtZS4uLlwiKTtcblx0fVxuXG5cdGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgbG93ZXIgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuXHRcdGNvbnN0IG1hdGNoZXMgPSB0aGlzLmdyb3Vwcy5maWx0ZXIoKGcpID0+XG5cdFx0XHRnLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMobG93ZXIpXG5cdFx0KTtcblx0XHRpZiAocXVlcnkgJiYgIXRoaXMuZ3JvdXBzLnNvbWUoKGcpID0+IGcudG9Mb3dlckNhc2UoKSA9PT0gbG93ZXIpKSB7XG5cdFx0XHRtYXRjaGVzLnB1c2gocXVlcnkpO1xuXHRcdH1cblx0XHRyZXR1cm4gbWF0Y2hlcztcblx0fVxuXG5cdHJlbmRlclN1Z2dlc3Rpb24oZ3JvdXA6IHN0cmluZywgZWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29uc3QgaXNOZXcgPSAhdGhpcy5ncm91cHMuaW5jbHVkZXMoZ3JvdXApO1xuXHRcdGVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgdGV4dDogaXNOZXcgPyBgJHtncm91cH0gKG5ldyBncm91cClgIDogZ3JvdXAgfSk7XG5cdH1cblxuXHRvbkNob29zZVN1Z2dlc3Rpb24oZ3JvdXA6IHN0cmluZykge1xuXHRcdHRoaXMub25TZWxlY3QoZ3JvdXApO1xuXHR9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEJvb2ttYXJrQVBJIGV4dGVuZHMgUGx1Z2luIHtcblx0cHJpdmF0ZSBnZXQgYm9va21hcmtzUGF0aCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBub3JtYWxpemVQYXRoKGAke3RoaXMuYXBwLnZhdWx0LmNvbmZpZ0Rpcn0vYm9va21hcmtzLmpzb25gKTtcblx0fVxuXG5cdGFzeW5jIG9ubG9hZCgpIHtcblx0XHRjb25zdCBhcGkgPSB7XG5cdFx0XHRhZGRCb29rbWFyazogKGdyb3VwTmFtZTogc3RyaW5nLCBmaWxlUGF0aD86IHN0cmluZywgdGl0bGU/OiBzdHJpbmcpID0+XG5cdFx0XHRcdHRoaXMuYWRkQm9va21hcmsoZ3JvdXBOYW1lLCBmaWxlUGF0aCwgdGl0bGUpLFxuXHRcdFx0cmVtb3ZlQm9va21hcms6IChncm91cE5hbWU6IHN0cmluZywgZmlsZVBhdGg/OiBzdHJpbmcpID0+XG5cdFx0XHRcdHRoaXMucmVtb3ZlQm9va21hcmsoZ3JvdXBOYW1lLCBmaWxlUGF0aCksXG5cdFx0XHRtb3ZlQm9va21hcms6IChmcm9tR3JvdXA6IHN0cmluZywgdG9Hcm91cDogc3RyaW5nLCBmaWxlUGF0aD86IHN0cmluZykgPT5cblx0XHRcdFx0dGhpcy5tb3ZlQm9va21hcmsoZnJvbUdyb3VwLCB0b0dyb3VwLCBmaWxlUGF0aCksXG5cdFx0XHRyZW1vdmVCb29rbWFya0dyb3VwOiAoZ3JvdXBOYW1lOiBzdHJpbmcsIGRlbGV0ZUZpbGVzPzogYm9vbGVhbikgPT5cblx0XHRcdFx0dGhpcy5yZW1vdmVCb29rbWFya0dyb3VwKGdyb3VwTmFtZSwgZGVsZXRlRmlsZXMpLFxuXHRcdH07XG5cblx0XHRjb25zdCB3aW4gPSB3aW5kb3cgYXMgdW5rbm93biBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcblx0XHRmb3IgKGNvbnN0IFtuYW1lLCBmbl0gb2YgT2JqZWN0LmVudHJpZXMoYXBpKSkge1xuXHRcdFx0d2luW25hbWVdID0gZm47XG5cdFx0fVxuXG5cdFx0dGhpcy5hZGRDb21tYW5kKHtcblx0XHRcdGlkOiBcImFkZC10by1ib29rbWFyay1ncm91cFwiLFxuXHRcdFx0bmFtZTogXCJBZGQgZmlsZSB0byBib29rbWFyayBncm91cFwiLFxuXHRcdFx0Y2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKSkgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRpZiAoIWNoZWNraW5nKSB7XG5cdFx0XHRcdFx0bmV3IEdyb3VwU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCB0aGlzLmdldEdyb3VwTmFtZXMoKSwgKGdyb3VwKSA9PiB7XG5cdFx0XHRcdFx0XHR2b2lkIHRoaXMuYWRkQm9va21hcmsoZ3JvdXApO1xuXHRcdFx0XHRcdH0pLm9wZW4oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHR0aGlzLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6IFwicmVtb3ZlLWZyb20tYm9va21hcmstZ3JvdXBcIixcblx0XHRcdG5hbWU6IFwiUmVtb3ZlIGZpbGUgZnJvbSBib29rbWFyayBncm91cFwiLFxuXHRcdFx0Y2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKSkgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRpZiAoIWNoZWNraW5nKSB7XG5cdFx0XHRcdFx0bmV3IEdyb3VwU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCB0aGlzLmdldEdyb3VwTmFtZXMoKSwgKGdyb3VwKSA9PiB7XG5cdFx0XHRcdFx0XHR2b2lkIHRoaXMucmVtb3ZlQm9va21hcmsoZ3JvdXApO1xuXHRcdFx0XHRcdH0pLm9wZW4oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cblxuXHRvbnVubG9hZCgpIHtcblx0XHRjb25zdCB3aW4gPSB3aW5kb3cgYXMgdW5rbm93biBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPjtcblx0XHRmb3IgKGNvbnN0IG5hbWUgb2YgW1wiYWRkQm9va21hcmtcIiwgXCJyZW1vdmVCb29rbWFya1wiLCBcIm1vdmVCb29rbWFya1wiLCBcInJlbW92ZUJvb2ttYXJrR3JvdXBcIl0pIHtcblx0XHRcdGRlbGV0ZSB3aW5bbmFtZV07XG5cdFx0fVxuXHR9XG5cblx0Ly8gXHUyNTAwXHUyNTAwIFB1YmxpYyBBUEkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cblx0YXN5bmMgYWRkQm9va21hcmsoZ3JvdXBOYW1lOiBzdHJpbmcsIGZpbGVQYXRoPzogc3RyaW5nLCB0aXRsZT86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGZpbGVQYXRoID0gdGhpcy5yZXNvbHZlRmlsZVBhdGgoZmlsZVBhdGgpO1xuXHRcdGlmICghZmlsZVBhdGgpIHJldHVybjtcblxuXHRcdGNvbnN0IGluc3RhbmNlID0gdGhpcy5nZXRCb29rbWFya3NQbHVnaW5JbnN0YW5jZSgpO1xuXHRcdGlmIChpbnN0YW5jZT8uaXRlbXMpIHtcblx0XHRcdGNvbnN0IGdyb3VwID0gdGhpcy5maW5kT3JDcmVhdGVHcm91cChpbnN0YW5jZS5pdGVtcywgZ3JvdXBOYW1lKTtcblx0XHRcdGlmICh0aGlzLmdyb3VwSGFzRmlsZShncm91cCwgZmlsZVBhdGgpKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYFwiJHtmaWxlUGF0aH1cIiBpcyBhbHJlYWR5IGluIFwiJHtncm91cE5hbWV9XCIuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGVudHJ5OiBCb29rbWFya0l0ZW0gPSB7IHR5cGU6IFwiZmlsZVwiLCBjdGltZTogRGF0ZS5ub3coKSwgcGF0aDogZmlsZVBhdGggfTtcblx0XHRcdGlmICh0aXRsZSkgZW50cnkudGl0bGUgPSB0aXRsZTtcblx0XHRcdGdyb3VwLml0ZW1zIS5wdXNoKGVudHJ5KTtcblx0XHRcdGluc3RhbmNlLnJlcXVlc3RTYXZlPy4oKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHRoaXMucmVhZEJvb2ttYXJrcygpO1xuXHRcdFx0Y29uc3QgZ3JvdXAgPSB0aGlzLmZpbmRPckNyZWF0ZUdyb3VwKGRhdGEuaXRlbXMsIGdyb3VwTmFtZSk7XG5cdFx0XHRpZiAodGhpcy5ncm91cEhhc0ZpbGUoZ3JvdXAsIGZpbGVQYXRoKSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKGBcIiR7ZmlsZVBhdGh9XCIgaXMgYWxyZWFkeSBpbiBcIiR7Z3JvdXBOYW1lfVwiLmApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBlbnRyeTogQm9va21hcmtJdGVtID0geyB0eXBlOiBcImZpbGVcIiwgY3RpbWU6IERhdGUubm93KCksIHBhdGg6IGZpbGVQYXRoIH07XG5cdFx0XHRpZiAodGl0bGUpIGVudHJ5LnRpdGxlID0gdGl0bGU7XG5cdFx0XHRncm91cC5pdGVtcyEucHVzaChlbnRyeSk7XG5cdFx0XHRhd2FpdCB0aGlzLndyaXRlQm9va21hcmtzKGRhdGEpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpc3BsYXkgPSB0aXRsZSA/PyBmaWxlUGF0aDtcblx0XHRuZXcgTm90aWNlKGBBZGRlZCBcIiR7ZGlzcGxheX1cIiB0byBcIiR7Z3JvdXBOYW1lfVwiLmApO1xuXHR9XG5cblx0YXN5bmMgcmVtb3ZlQm9va21hcmsoZ3JvdXBOYW1lOiBzdHJpbmcsIGZpbGVQYXRoPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0ZmlsZVBhdGggPSB0aGlzLnJlc29sdmVGaWxlUGF0aChmaWxlUGF0aCk7XG5cdFx0aWYgKCFmaWxlUGF0aCkgcmV0dXJuO1xuXG5cdFx0Y29uc3QgaW5zdGFuY2UgPSB0aGlzLmdldEJvb2ttYXJrc1BsdWdpbkluc3RhbmNlKCk7XG5cdFx0aWYgKGluc3RhbmNlPy5pdGVtcykge1xuXHRcdFx0Y29uc3QgZ3JvdXAgPSB0aGlzLmZpbmRHcm91cChpbnN0YW5jZS5pdGVtcywgZ3JvdXBOYW1lKTtcblx0XHRcdGlmICghZ3JvdXAgfHwgIXRoaXMucmVtb3ZlRmlsZUZyb21Hcm91cChncm91cCwgZmlsZVBhdGgpKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYFwiJHtmaWxlUGF0aH1cIiBub3QgZm91bmQgaW4gXCIke2dyb3VwTmFtZX1cIi5gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aW5zdGFuY2UucmVxdWVzdFNhdmU/LigpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5yZWFkQm9va21hcmtzKCk7XG5cdFx0XHRjb25zdCBncm91cCA9IHRoaXMuZmluZEdyb3VwKGRhdGEuaXRlbXMsIGdyb3VwTmFtZSk7XG5cdFx0XHRpZiAoIWdyb3VwIHx8ICF0aGlzLnJlbW92ZUZpbGVGcm9tR3JvdXAoZ3JvdXAsIGZpbGVQYXRoKSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKGBcIiR7ZmlsZVBhdGh9XCIgbm90IGZvdW5kIGluIFwiJHtncm91cE5hbWV9XCIuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGF3YWl0IHRoaXMud3JpdGVCb29rbWFya3MoZGF0YSk7XG5cdFx0fVxuXG5cdFx0bmV3IE5vdGljZShgUmVtb3ZlZCBcIiR7ZmlsZVBhdGh9XCIgZnJvbSBcIiR7Z3JvdXBOYW1lfVwiLmApO1xuXHR9XG5cblx0YXN5bmMgbW92ZUJvb2ttYXJrKGZyb21Hcm91cDogc3RyaW5nLCB0b0dyb3VwOiBzdHJpbmcsIGZpbGVQYXRoPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0ZmlsZVBhdGggPSB0aGlzLnJlc29sdmVGaWxlUGF0aChmaWxlUGF0aCk7XG5cdFx0aWYgKCFmaWxlUGF0aCkgcmV0dXJuO1xuXG5cdFx0Y29uc3QgaW5zdGFuY2UgPSB0aGlzLmdldEJvb2ttYXJrc1BsdWdpbkluc3RhbmNlKCk7XG5cdFx0aWYgKGluc3RhbmNlPy5pdGVtcykge1xuXHRcdFx0Y29uc3Qgc3JjID0gdGhpcy5maW5kR3JvdXAoaW5zdGFuY2UuaXRlbXMsIGZyb21Hcm91cCk7XG5cdFx0XHRpZiAoIXNyYykge1xuXHRcdFx0XHRuZXcgTm90aWNlKGBHcm91cCBcIiR7ZnJvbUdyb3VwfVwiIG5vdCBmb3VuZC5gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZW50cnkgPSB0aGlzLmV4dHJhY3RGaWxlRnJvbUdyb3VwKHNyYywgZmlsZVBhdGgpO1xuXHRcdFx0aWYgKCFlbnRyeSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKGBcIiR7ZmlsZVBhdGh9XCIgbm90IGZvdW5kIGluIFwiJHtmcm9tR3JvdXB9XCIuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGRlc3QgPSB0aGlzLmZpbmRPckNyZWF0ZUdyb3VwKGluc3RhbmNlLml0ZW1zLCB0b0dyb3VwKTtcblx0XHRcdGlmICh0aGlzLmdyb3VwSGFzRmlsZShkZXN0LCBmaWxlUGF0aCkpIHtcblx0XHRcdFx0bmV3IE5vdGljZShgXCIke2ZpbGVQYXRofVwiIGFscmVhZHkgZXhpc3RzIGluIFwiJHt0b0dyb3VwfVwiLmApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRkZXN0Lml0ZW1zIS5wdXNoKGVudHJ5KTtcblx0XHRcdGluc3RhbmNlLnJlcXVlc3RTYXZlPy4oKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHRoaXMucmVhZEJvb2ttYXJrcygpO1xuXHRcdFx0Y29uc3Qgc3JjID0gdGhpcy5maW5kR3JvdXAoZGF0YS5pdGVtcywgZnJvbUdyb3VwKTtcblx0XHRcdGlmICghc3JjKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYEdyb3VwIFwiJHtmcm9tR3JvdXB9XCIgbm90IGZvdW5kLmApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBlbnRyeSA9IHRoaXMuZXh0cmFjdEZpbGVGcm9tR3JvdXAoc3JjLCBmaWxlUGF0aCk7XG5cdFx0XHRpZiAoIWVudHJ5KSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYFwiJHtmaWxlUGF0aH1cIiBub3QgZm91bmQgaW4gXCIke2Zyb21Hcm91cH1cIi5gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZGVzdCA9IHRoaXMuZmluZE9yQ3JlYXRlR3JvdXAoZGF0YS5pdGVtcywgdG9Hcm91cCk7XG5cdFx0XHRpZiAodGhpcy5ncm91cEhhc0ZpbGUoZGVzdCwgZmlsZVBhdGgpKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYFwiJHtmaWxlUGF0aH1cIiBhbHJlYWR5IGV4aXN0cyBpbiBcIiR7dG9Hcm91cH1cIi5gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZGVzdC5pdGVtcyEucHVzaChlbnRyeSk7XG5cdFx0XHRhd2FpdCB0aGlzLndyaXRlQm9va21hcmtzKGRhdGEpO1xuXHRcdH1cblxuXHRcdG5ldyBOb3RpY2UoYE1vdmVkIFwiJHtmaWxlUGF0aH1cIiBmcm9tIFwiJHtmcm9tR3JvdXB9XCIgdG8gXCIke3RvR3JvdXB9XCIuYCk7XG5cdH1cblxuXHRhc3luYyByZW1vdmVCb29rbWFya0dyb3VwKGdyb3VwTmFtZTogc3RyaW5nLCBkZWxldGVGaWxlcyA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bGV0IGdyb3VwOiBCb29rbWFya0l0ZW0gfCB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuZ2V0Qm9va21hcmtzUGx1Z2luSW5zdGFuY2UoKTtcblx0XHRpZiAoaW5zdGFuY2U/Lml0ZW1zKSB7XG5cdFx0XHRjb25zdCBpZHggPSBpbnN0YW5jZS5pdGVtcy5maW5kSW5kZXgoXG5cdFx0XHRcdChpKSA9PiBpLnR5cGUgPT09IFwiZ3JvdXBcIiAmJiBpLnRpdGxlID09PSBncm91cE5hbWVcblx0XHRcdCk7XG5cdFx0XHRpZiAoaWR4ID09PSAtMSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKGBHcm91cCBcIiR7Z3JvdXBOYW1lfVwiIG5vdCBmb3VuZC5gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Z3JvdXAgPSBpbnN0YW5jZS5pdGVtc1tpZHhdO1xuXHRcdFx0aW5zdGFuY2UuaXRlbXMuc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRpbnN0YW5jZS5yZXF1ZXN0U2F2ZT8uKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLnJlYWRCb29rbWFya3MoKTtcblx0XHRcdGNvbnN0IGlkeCA9IGRhdGEuaXRlbXMuZmluZEluZGV4KFxuXHRcdFx0XHQoaSkgPT4gaS50eXBlID09PSBcImdyb3VwXCIgJiYgaS50aXRsZSA9PT0gZ3JvdXBOYW1lXG5cdFx0XHQpO1xuXHRcdFx0aWYgKGlkeCA9PT0gLTEpIHtcblx0XHRcdFx0bmV3IE5vdGljZShgR3JvdXAgXCIke2dyb3VwTmFtZX1cIiBub3QgZm91bmQuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGdyb3VwID0gZGF0YS5pdGVtc1tpZHhdO1xuXHRcdFx0ZGF0YS5pdGVtcy5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdGF3YWl0IHRoaXMud3JpdGVCb29rbWFya3MoZGF0YSk7XG5cdFx0fVxuXG5cdFx0aWYgKGRlbGV0ZUZpbGVzICYmIGdyb3VwPy5pdGVtcykge1xuXHRcdFx0Y29uc3QgZmlsZVBhdGhzID0gZ3JvdXAuaXRlbXNcblx0XHRcdFx0LmZpbHRlcigoaSkgPT4gaS50eXBlID09PSBcImZpbGVcIiAmJiBpLnBhdGgpXG5cdFx0XHRcdC5tYXAoKGkpID0+IGkucGF0aCEpO1xuXHRcdFx0bGV0IGRlbGV0ZWQgPSAwO1xuXHRcdFx0Zm9yIChjb25zdCBwYXRoIG9mIGZpbGVQYXRocykge1xuXHRcdFx0XHRjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpO1xuXHRcdFx0XHRpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5hcHAuZmlsZU1hbmFnZXIudHJhc2hGaWxlKGZpbGUpO1xuXHRcdFx0XHRcdGRlbGV0ZWQrKztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0bmV3IE5vdGljZShgUmVtb3ZlZCBncm91cCBcIiR7Z3JvdXBOYW1lfVwiIGFuZCB0cmFzaGVkICR7ZGVsZXRlZH0gZmlsZShzKS5gKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bmV3IE5vdGljZShgUmVtb3ZlZCBncm91cCBcIiR7Z3JvdXBOYW1lfVwiLmApO1xuXHRcdH1cblx0fVxuXG5cdC8vIFx1MjUwMFx1MjUwMCBIZWxwZXJzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5cdHByaXZhdGUgcmVzb2x2ZUZpbGVQYXRoKGZpbGVQYXRoPzogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0aWYgKCFmaWxlUGF0aCkge1xuXHRcdFx0Y29uc3QgYWN0aXZlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcblx0XHRcdGlmICghYWN0aXZlKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoXCJObyBhY3RpdmUgZmlsZS5cIik7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGFjdGl2ZS5wYXRoO1xuXHRcdH1cblx0XHRmaWxlUGF0aCA9IGZpbGVQYXRoLmVuZHNXaXRoKFwiLm1kXCIpID8gZmlsZVBhdGggOiBmaWxlUGF0aCArIFwiLm1kXCI7XG5cdFx0cmV0dXJuIG5vcm1hbGl6ZVBhdGgoZmlsZVBhdGgpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRCb29rbWFya3NQbHVnaW5JbnN0YW5jZSgpOiBCb29rbWFya3NQbHVnaW5JbnN0YW5jZSB8IG51bGwge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBhcHAgPSB0aGlzLmFwcCBhcyB1bmtub3duIGFzIHsgaW50ZXJuYWxQbHVnaW5zPzogSW50ZXJuYWxQbHVnaW5zIH07XG5cdFx0XHRyZXR1cm4gYXBwLmludGVybmFsUGx1Z2lucz8uZ2V0UGx1Z2luQnlJZD8uKFwiYm9va21hcmtzXCIpPy5pbnN0YW5jZSA/PyBudWxsO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRHcm91cE5hbWVzKCk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuZ2V0Qm9va21hcmtzUGx1Z2luSW5zdGFuY2UoKTtcblx0XHRjb25zdCBpdGVtczogQm9va21hcmtJdGVtW10gPSBpbnN0YW5jZT8uaXRlbXMgPz8gW107XG5cdFx0cmV0dXJuIGl0ZW1zXG5cdFx0XHQuZmlsdGVyKChpKSA9PiBpLnR5cGUgPT09IFwiZ3JvdXBcIiAmJiBpLnRpdGxlKVxuXHRcdFx0Lm1hcCgoaSkgPT4gaS50aXRsZSBhcyBzdHJpbmcpO1xuXHR9XG5cblx0cHJpdmF0ZSBmaW5kR3JvdXAoaXRlbXM6IEJvb2ttYXJrSXRlbVtdLCBncm91cE5hbWU6IHN0cmluZyk6IEJvb2ttYXJrSXRlbSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIGl0ZW1zLmZpbmQoKGkpID0+IGkudHlwZSA9PT0gXCJncm91cFwiICYmIGkudGl0bGUgPT09IGdyb3VwTmFtZSk7XG5cdH1cblxuXHRwcml2YXRlIGZpbmRPckNyZWF0ZUdyb3VwKGl0ZW1zOiBCb29rbWFya0l0ZW1bXSwgZ3JvdXBOYW1lOiBzdHJpbmcpOiBCb29rbWFya0l0ZW0ge1xuXHRcdGxldCBncm91cCA9IHRoaXMuZmluZEdyb3VwKGl0ZW1zLCBncm91cE5hbWUpO1xuXHRcdGlmICghZ3JvdXApIHtcblx0XHRcdGdyb3VwID0geyB0eXBlOiBcImdyb3VwXCIsIGN0aW1lOiBEYXRlLm5vdygpLCBpdGVtczogW10sIHRpdGxlOiBncm91cE5hbWUgfTtcblx0XHRcdGl0ZW1zLnB1c2goZ3JvdXApO1xuXHRcdH1cblx0XHRpZiAoIWdyb3VwLml0ZW1zKSBncm91cC5pdGVtcyA9IFtdO1xuXHRcdHJldHVybiBncm91cDtcblx0fVxuXG5cdHByaXZhdGUgZ3JvdXBIYXNGaWxlKGdyb3VwOiBCb29rbWFya0l0ZW0sIGZpbGVQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZ3JvdXAuaXRlbXM/LnNvbWUoKGkpID0+IGkudHlwZSA9PT0gXCJmaWxlXCIgJiYgaS5wYXRoID09PSBmaWxlUGF0aCkgPz8gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZUZpbGVGcm9tR3JvdXAoZ3JvdXA6IEJvb2ttYXJrSXRlbSwgZmlsZVBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGlmICghZ3JvdXAuaXRlbXMpIHJldHVybiBmYWxzZTtcblx0XHRjb25zdCBpZHggPSBncm91cC5pdGVtcy5maW5kSW5kZXgoKGkpID0+IGkudHlwZSA9PT0gXCJmaWxlXCIgJiYgaS5wYXRoID09PSBmaWxlUGF0aCk7XG5cdFx0aWYgKGlkeCA9PT0gLTEpIHJldHVybiBmYWxzZTtcblx0XHRncm91cC5pdGVtcy5zcGxpY2UoaWR4LCAxKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKiBSZW1vdmVzIGFuZCByZXR1cm5zIHRoZSBmaWxlIGVudHJ5LCBvciBudWxsIGlmIG5vdCBmb3VuZC4gKi9cblx0cHJpdmF0ZSBleHRyYWN0RmlsZUZyb21Hcm91cChncm91cDogQm9va21hcmtJdGVtLCBmaWxlUGF0aDogc3RyaW5nKTogQm9va21hcmtJdGVtIHwgbnVsbCB7XG5cdFx0aWYgKCFncm91cC5pdGVtcykgcmV0dXJuIG51bGw7XG5cdFx0Y29uc3QgaWR4ID0gZ3JvdXAuaXRlbXMuZmluZEluZGV4KChpKSA9PiBpLnR5cGUgPT09IFwiZmlsZVwiICYmIGkucGF0aCA9PT0gZmlsZVBhdGgpO1xuXHRcdGlmIChpZHggPT09IC0xKSByZXR1cm4gbnVsbDtcblx0XHRyZXR1cm4gZ3JvdXAuaXRlbXMuc3BsaWNlKGlkeCwgMSlbMF07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlYWRCb29rbWFya3MoKTogUHJvbWlzZTxCb29rbWFya3NEYXRhPiB7XG5cdFx0Y29uc3QgYWRhcHRlciA9IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXI7XG5cdFx0aWYgKGF3YWl0IGFkYXB0ZXIuZXhpc3RzKHRoaXMuYm9va21hcmtzUGF0aCkpIHtcblx0XHRcdGNvbnN0IHJhdyA9IGF3YWl0IGFkYXB0ZXIucmVhZCh0aGlzLmJvb2ttYXJrc1BhdGgpO1xuXHRcdFx0cmV0dXJuIEpTT04ucGFyc2UocmF3KSBhcyBCb29rbWFya3NEYXRhO1xuXHRcdH1cblx0XHRyZXR1cm4geyBpdGVtczogW10gfTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgd3JpdGVCb29rbWFya3MoZGF0YTogQm9va21hcmtzRGF0YSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHJhdyA9IEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIFwiXFx0XCIpO1xuXHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUodGhpcy5ib29rbWFya3NQYXRoLCByYXcpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQUF3RTtBQXVCeEUsSUFBTSxvQkFBTixjQUFnQyw2QkFBcUI7QUFBQSxFQUlwRCxZQUFZLEtBQVUsUUFBa0IsVUFBbUM7QUFDMUUsVUFBTSxHQUFHO0FBQ1QsU0FBSyxTQUFTO0FBQ2QsU0FBSyxXQUFXO0FBQ2hCLFNBQUssZUFBZSwrQkFBK0I7QUFBQSxFQUNwRDtBQUFBLEVBRUEsZUFBZSxPQUF5QjtB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
