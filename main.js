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
var BOOKMARKS_PATH = ".obsidian/bookmarks.json";
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
  async onload() {
    const api = {
      addBookmark: (groupName, filePath, title) => this.addBookmark(groupName, filePath, title),
      removeBookmark: (groupName, filePath) => this.removeBookmark(groupName, filePath),
      moveBookmark: (fromGroup, toGroup, filePath) => this.moveBookmark(fromGroup, toGroup, filePath),
      removeBookmarkGroup: (groupName, deleteFiles) => this.removeBookmarkGroup(groupName, deleteFiles)
    };
    for (const [name, fn] of Object.entries(api)) {
      window[name] = fn;
    }
    this.addCommand({
      id: "add-to-bookmark-group",
      name: "Add file to bookmark group",
      checkCallback: (checking) => {
        if (!this.app.workspace.getActiveFile()) return false;
        if (!checking) {
          new GroupSuggestModal(this.app, this.getGroupNames(), async (group) => {
            await this.addBookmark(group);
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
          new GroupSuggestModal(this.app, this.getGroupNames(), async (group) => {
            await this.removeBookmark(group);
          }).open();
        }
        return true;
      }
    });
  }
  onunload() {
    for (const name of ["addBookmark", "removeBookmark", "moveBookmark", "removeBookmarkGroup"]) {
      delete window[name];
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
        if (file) {
          await this.app.vault.trash(file, false);
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
    var _a, _b, _c;
    try {
      return (_c = (_b = (_a = this.app.internalPlugins) == null ? void 0 : _a.getPluginById) == null ? void 0 : _b.call(_a, "bookmarks")) == null ? void 0 : _c.instance;
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
    if (await adapter.exists(BOOKMARKS_PATH)) {
      const raw = await adapter.read(BOOKMARKS_PATH);
      return JSON.parse(raw);
    }
    return { items: [] };
  }
  async writeBookmarks(data) {
    const raw = JSON.stringify(data, null, "	");
    await this.app.vault.adapter.write(BOOKMARKS_PATH, raw);
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luLCBOb3RpY2UsIFN1Z2dlc3RNb2RhbCwgQXBwLCBub3JtYWxpemVQYXRoIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmludGVyZmFjZSBCb29rbWFya0l0ZW0ge1xuXHR0eXBlOiBcImZpbGVcIiB8IFwiZ3JvdXBcIjtcblx0Y3RpbWU6IG51bWJlcjtcblx0cGF0aD86IHN0cmluZztcblx0dGl0bGU/OiBzdHJpbmc7XG5cdGl0ZW1zPzogQm9va21hcmtJdGVtW107XG59XG5cbmludGVyZmFjZSBCb29rbWFya3NEYXRhIHtcblx0aXRlbXM6IEJvb2ttYXJrSXRlbVtdO1xufVxuXG5jb25zdCBCT09LTUFSS1NfUEFUSCA9IFwiLm9ic2lkaWFuL2Jvb2ttYXJrcy5qc29uXCI7XG5cbmNsYXNzIEdyb3VwU3VnZ2VzdE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPHN0cmluZz4ge1xuXHRncm91cHM6IHN0cmluZ1tdO1xuXHRvblNlbGVjdDogKGdyb3VwOiBzdHJpbmcpID0+IHZvaWQ7XG5cblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIGdyb3Vwczogc3RyaW5nW10sIG9uU2VsZWN0OiAoZ3JvdXA6IHN0cmluZykgPT4gdm9pZCkge1xuXHRcdHN1cGVyKGFwcCk7XG5cdFx0dGhpcy5ncm91cHMgPSBncm91cHM7XG5cdFx0dGhpcy5vblNlbGVjdCA9IG9uU2VsZWN0O1xuXHRcdHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJUeXBlIGEgYm9va21hcmsgZ3JvdXAgbmFtZS4uLlwiKTtcblx0fVxuXG5cdGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgbG93ZXIgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuXHRcdGNvbnN0IG1hdGNoZXMgPSB0aGlzLmdyb3Vwcy5maWx0ZXIoKGcpID0+XG5cdFx0XHRnLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMobG93ZXIpXG5cdFx0KTtcblx0XHRpZiAocXVlcnkgJiYgIXRoaXMuZ3JvdXBzLnNvbWUoKGcpID0+IGcudG9Mb3dlckNhc2UoKSA9PT0gbG93ZXIpKSB7XG5cdFx0XHRtYXRjaGVzLnB1c2gocXVlcnkpO1xuXHRcdH1cblx0XHRyZXR1cm4gbWF0Y2hlcztcblx0fVxuXG5cdHJlbmRlclN1Z2dlc3Rpb24oZ3JvdXA6IHN0cmluZywgZWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29uc3QgaXNOZXcgPSAhdGhpcy5ncm91cHMuaW5jbHVkZXMoZ3JvdXApO1xuXHRcdGVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgdGV4dDogaXNOZXcgPyBgJHtncm91cH0gKG5ldyBncm91cClgIDogZ3JvdXAgfSk7XG5cdH1cblxuXHRvbkNob29zZVN1Z2dlc3Rpb24oZ3JvdXA6IHN0cmluZykge1xuXHRcdHRoaXMub25TZWxlY3QoZ3JvdXApO1xuXHR9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEJvb2ttYXJrQVBJIGV4dGVuZHMgUGx1Z2luIHtcblx0YXN5bmMgb25sb2FkKCkge1xuXHRcdGNvbnN0IGFwaSA9IHtcblx0XHRcdGFkZEJvb2ttYXJrOiAoZ3JvdXBOYW1lOiBzdHJpbmcsIGZpbGVQYXRoPzogc3RyaW5nLCB0aXRsZT86IHN0cmluZykgPT5cblx0XHRcdFx0dGhpcy5hZGRCb29rbWFyayhncm91cE5hbWUsIGZpbGVQYXRoLCB0aXRsZSksXG5cdFx0XHRyZW1vdmVCb29rbWFyazogKGdyb3VwTmFtZTogc3RyaW5nLCBmaWxlUGF0aD86IHN0cmluZykgPT5cblx0XHRcdFx0dGhpcy5yZW1vdmVCb29rbWFyayhncm91cE5hbWUsIGZpbGVQYXRoKSxcblx0XHRcdG1vdmVCb29rbWFyazogKGZyb21Hcm91cDogc3RyaW5nLCB0b0dyb3VwOiBzdHJpbmcsIGZpbGVQYXRoPzogc3RyaW5nKSA9PlxuXHRcdFx0XHR0aGlzLm1vdmVCb29rbWFyayhmcm9tR3JvdXAsIHRvR3JvdXAsIGZpbGVQYXRoKSxcblx0XHRcdHJlbW92ZUJvb2ttYXJrR3JvdXA6IChncm91cE5hbWU6IHN0cmluZywgZGVsZXRlRmlsZXM/OiBib29sZWFuKSA9PlxuXHRcdFx0XHR0aGlzLnJlbW92ZUJvb2ttYXJrR3JvdXAoZ3JvdXBOYW1lLCBkZWxldGVGaWxlcyksXG5cdFx0fTtcblxuXHRcdGZvciAoY29uc3QgW25hbWUsIGZuXSBvZiBPYmplY3QuZW50cmllcyhhcGkpKSB7XG5cdFx0XHQod2luZG93IGFzIGFueSlbbmFtZV0gPSBmbjtcblx0XHR9XG5cblx0XHR0aGlzLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6IFwiYWRkLXRvLWJvb2ttYXJrLWdyb3VwXCIsXG5cdFx0XHRuYW1lOiBcIkFkZCBmaWxlIHRvIGJvb2ttYXJrIGdyb3VwXCIsXG5cdFx0XHRjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpKSByZXR1cm4gZmFsc2U7XG5cdFx0XHRcdGlmICghY2hlY2tpbmcpIHtcblx0XHRcdFx0XHRuZXcgR3JvdXBTdWdnZXN0TW9kYWwodGhpcy5hcHAsIHRoaXMuZ2V0R3JvdXBOYW1lcygpLCBhc3luYyAoZ3JvdXApID0+IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuYWRkQm9va21hcmsoZ3JvdXApO1xuXHRcdFx0XHRcdH0pLm9wZW4oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHR0aGlzLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6IFwicmVtb3ZlLWZyb20tYm9va21hcmstZ3JvdXBcIixcblx0XHRcdG5hbWU6IFwiUmVtb3ZlIGZpbGUgZnJvbSBib29rbWFyayBncm91cFwiLFxuXHRcdFx0Y2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdGlmICghdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKSkgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRpZiAoIWNoZWNraW5nKSB7XG5cdFx0XHRcdFx0bmV3IEdyb3VwU3VnZ2VzdE1vZGFsKHRoaXMuYXBwLCB0aGlzLmdldEdyb3VwTmFtZXMoKSwgYXN5bmMgKGdyb3VwKSA9PiB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnJlbW92ZUJvb2ttYXJrKGdyb3VwKTtcblx0XHRcdFx0XHR9KS5vcGVuKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cblx0b251bmxvYWQoKSB7XG5cdFx0Zm9yIChjb25zdCBuYW1lIG9mIFtcImFkZEJvb2ttYXJrXCIsIFwicmVtb3ZlQm9va21hcmtcIiwgXCJtb3ZlQm9va21hcmtcIiwgXCJyZW1vdmVCb29rbWFya0dyb3VwXCJdKSB7XG5cdFx0XHRkZWxldGUgKHdpbmRvdyBhcyBhbnkpW25hbWVdO1xuXHRcdH1cblx0fVxuXG5cdC8vIFx1MjUwMFx1MjUwMCBQdWJsaWMgQVBJIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5cdGFzeW5jIGFkZEJvb2ttYXJrKGdyb3VwTmFtZTogc3RyaW5nLCBmaWxlUGF0aD86IHN0cmluZywgdGl0bGU/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRmaWxlUGF0aCA9IHRoaXMucmVzb2x2ZUZpbGVQYXRoKGZpbGVQYXRoKTtcblx0XHRpZiAoIWZpbGVQYXRoKSByZXR1cm47XG5cblx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuZ2V0Qm9va21hcmtzUGx1Z2luSW5zdGFuY2UoKTtcblx0XHRpZiAoaW5zdGFuY2U/Lml0ZW1zKSB7XG5cdFx0XHRjb25zdCBncm91cCA9IHRoaXMuZmluZE9yQ3JlYXRlR3JvdXAoaW5zdGFuY2UuaXRlbXMsIGdyb3VwTmFtZSk7XG5cdFx0XHRpZiAodGhpcy5ncm91cEhhc0ZpbGUoZ3JvdXAsIGZpbGVQYXRoKSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKGBcIiR7ZmlsZVBhdGh9XCIgaXMgYWxyZWFkeSBpbiBcIiR7Z3JvdXBOYW1lfVwiLmApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBlbnRyeTogQm9va21hcmtJdGVtID0geyB0eXBlOiBcImZpbGVcIiwgY3RpbWU6IERhdGUubm93KCksIHBhdGg6IGZpbGVQYXRoIH07XG5cdFx0XHRpZiAodGl0bGUpIGVudHJ5LnRpdGxlID0gdGl0bGU7XG5cdFx0XHRncm91cC5pdGVtcyEucHVzaChlbnRyeSk7XG5cdFx0XHRpbnN0YW5jZS5yZXF1ZXN0U2F2ZT8uKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLnJlYWRCb29rbWFya3MoKTtcblx0XHRcdGNvbnN0IGdyb3VwID0gdGhpcy5maW5kT3JDcmVhdGVHcm91cChkYXRhLml0ZW1zLCBncm91cE5hbWUpO1xuXHRcdFx0aWYgKHRoaXMuZ3JvdXBIYXNGaWxlKGdyb3VwLCBmaWxlUGF0aCkpIHtcblx0XHRcdFx0bmV3IE5vdGljZShgXCIke2ZpbGVQYXRofVwiIGlzIGFscmVhZHkgaW4gXCIke2dyb3VwTmFtZX1cIi5gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZW50cnk6IEJvb2ttYXJrSXRlbSA9IHsgdHlwZTogXCJmaWxlXCIsIGN0aW1lOiBEYXRlLm5vdygpLCBwYXRoOiBmaWxlUGF0aCB9O1xuXHRcdFx0aWYgKHRpdGxlKSBlbnRyeS50aXRsZSA9IHRpdGxlO1xuXHRcdFx0Z3JvdXAuaXRlbXMhLnB1c2goZW50cnkpO1xuXHRcdFx0YXdhaXQgdGhpcy53cml0ZUJvb2ttYXJrcyhkYXRhKTtcblx0XHR9XG5cblx0XHRjb25zdCBkaXNwbGF5ID0gdGl0bGUgPz8gZmlsZVBhdGg7XG5cdFx0bmV3IE5vdGljZShgQWRkZWQgXCIke2Rpc3BsYXl9XCIgdG8gXCIke2dyb3VwTmFtZX1cIi5gKTtcblx0fVxuXG5cdGFzeW5jIHJlbW92ZUJvb2ttYXJrKGdyb3VwTmFtZTogc3RyaW5nLCBmaWxlUGF0aD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGZpbGVQYXRoID0gdGhpcy5yZXNvbHZlRmlsZVBhdGgoZmlsZVBhdGgpO1xuXHRcdGlmICghZmlsZVBhdGgpIHJldHVybjtcblxuXHRcdGNvbnN0IGluc3RhbmNlID0gdGhpcy5nZXRCb29rbWFya3NQbHVnaW5JbnN0YW5jZSgpO1xuXHRcdGlmIChpbnN0YW5jZT8uaXRlbXMpIHtcblx0XHRcdGNvbnN0IGdyb3VwID0gdGhpcy5maW5kR3JvdXAoaW5zdGFuY2UuaXRlbXMsIGdyb3VwTmFtZSk7XG5cdFx0XHRpZiAoIWdyb3VwIHx8ICF0aGlzLnJlbW92ZUZpbGVGcm9tR3JvdXAoZ3JvdXAsIGZpbGVQYXRoKSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKGBcIiR7ZmlsZVBhdGh9XCIgbm90IGZvdW5kIGluIFwiJHtncm91cE5hbWV9XCIuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGluc3RhbmNlLnJlcXVlc3RTYXZlPy4oKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgZGF0YSA9IGF3YWl0IHRoaXMucmVhZEJvb2ttYXJrcygpO1xuXHRcdFx0Y29uc3QgZ3JvdXAgPSB0aGlzLmZpbmRHcm91cChkYXRhLml0ZW1zLCBncm91cE5hbWUpO1xuXHRcdFx0aWYgKCFncm91cCB8fCAhdGhpcy5yZW1vdmVGaWxlRnJvbUdyb3VwKGdyb3VwLCBmaWxlUGF0aCkpIHtcblx0XHRcdFx0bmV3IE5vdGljZShgXCIke2ZpbGVQYXRofVwiIG5vdCBmb3VuZCBpbiBcIiR7Z3JvdXBOYW1lfVwiLmApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCB0aGlzLndyaXRlQm9va21hcmtzKGRhdGEpO1xuXHRcdH1cblxuXHRcdG5ldyBOb3RpY2UoYFJlbW92ZWQgXCIke2ZpbGVQYXRofVwiIGZyb20gXCIke2dyb3VwTmFtZX1cIi5gKTtcblx0fVxuXG5cdGFzeW5jIG1vdmVCb29rbWFyayhmcm9tR3JvdXA6IHN0cmluZywgdG9Hcm91cDogc3RyaW5nLCBmaWxlUGF0aD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGZpbGVQYXRoID0gdGhpcy5yZXNvbHZlRmlsZVBhdGgoZmlsZVBhdGgpO1xuXHRcdGlmICghZmlsZVBhdGgpIHJldHVybjtcblxuXHRcdGNvbnN0IGluc3RhbmNlID0gdGhpcy5nZXRCb29rbWFya3NQbHVnaW5JbnN0YW5jZSgpO1xuXHRcdGlmIChpbnN0YW5jZT8uaXRlbXMpIHtcblx0XHRcdGNvbnN0IHNyYyA9IHRoaXMuZmluZEdyb3VwKGluc3RhbmNlLml0ZW1zLCBmcm9tR3JvdXApO1xuXHRcdFx0aWYgKCFzcmMpIHtcblx0XHRcdFx0bmV3IE5vdGljZShgR3JvdXAgXCIke2Zyb21Hcm91cH1cIiBub3QgZm91bmQuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGVudHJ5ID0gdGhpcy5leHRyYWN0RmlsZUZyb21Hcm91cChzcmMsIGZpbGVQYXRoKTtcblx0XHRcdGlmICghZW50cnkpIHtcblx0XHRcdFx0bmV3IE5vdGljZShgXCIke2ZpbGVQYXRofVwiIG5vdCBmb3VuZCBpbiBcIiR7ZnJvbUdyb3VwfVwiLmApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBkZXN0ID0gdGhpcy5maW5kT3JDcmVhdGVHcm91cChpbnN0YW5jZS5pdGVtcywgdG9Hcm91cCk7XG5cdFx0XHRpZiAodGhpcy5ncm91cEhhc0ZpbGUoZGVzdCwgZmlsZVBhdGgpKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYFwiJHtmaWxlUGF0aH1cIiBhbHJlYWR5IGV4aXN0cyBpbiBcIiR7dG9Hcm91cH1cIi5gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZGVzdC5pdGVtcyEucHVzaChlbnRyeSk7XG5cdFx0XHRpbnN0YW5jZS5yZXF1ZXN0U2F2ZT8uKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLnJlYWRCb29rbWFya3MoKTtcblx0XHRcdGNvbnN0IHNyYyA9IHRoaXMuZmluZEdyb3VwKGRhdGEuaXRlbXMsIGZyb21Hcm91cCk7XG5cdFx0XHRpZiAoIXNyYykge1xuXHRcdFx0XHRuZXcgTm90aWNlKGBHcm91cCBcIiR7ZnJvbUdyb3VwfVwiIG5vdCBmb3VuZC5gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZW50cnkgPSB0aGlzLmV4dHJhY3RGaWxlRnJvbUdyb3VwKHNyYywgZmlsZVBhdGgpO1xuXHRcdFx0aWYgKCFlbnRyeSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKGBcIiR7ZmlsZVBhdGh9XCIgbm90IGZvdW5kIGluIFwiJHtmcm9tR3JvdXB9XCIuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGRlc3QgPSB0aGlzLmZpbmRPckNyZWF0ZUdyb3VwKGRhdGEuaXRlbXMsIHRvR3JvdXApO1xuXHRcdFx0aWYgKHRoaXMuZ3JvdXBIYXNGaWxlKGRlc3QsIGZpbGVQYXRoKSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKGBcIiR7ZmlsZVBhdGh9XCIgYWxyZWFkeSBleGlzdHMgaW4gXCIke3RvR3JvdXB9XCIuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGRlc3QuaXRlbXMhLnB1c2goZW50cnkpO1xuXHRcdFx0YXdhaXQgdGhpcy53cml0ZUJvb2ttYXJrcyhkYXRhKTtcblx0XHR9XG5cblx0XHRuZXcgTm90aWNlKGBNb3ZlZCBcIiR7ZmlsZVBhdGh9XCIgZnJvbSBcIiR7ZnJvbUdyb3VwfVwiIHRvIFwiJHt0b0dyb3VwfVwiLmApO1xuXHR9XG5cblx0YXN5bmMgcmVtb3ZlQm9va21hcmtHcm91cChncm91cE5hbWU6IHN0cmluZywgZGVsZXRlRmlsZXMgPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBncm91cDogQm9va21hcmtJdGVtIHwgdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgaW5zdGFuY2UgPSB0aGlzLmdldEJvb2ttYXJrc1BsdWdpbkluc3RhbmNlKCk7XG5cdFx0aWYgKGluc3RhbmNlPy5pdGVtcykge1xuXHRcdFx0Y29uc3QgaWR4ID0gaW5zdGFuY2UuaXRlbXMuZmluZEluZGV4KFxuXHRcdFx0XHQoaTogQm9va21hcmtJdGVtKSA9PiBpLnR5cGUgPT09IFwiZ3JvdXBcIiAmJiBpLnRpdGxlID09PSBncm91cE5hbWVcblx0XHRcdCk7XG5cdFx0XHRpZiAoaWR4ID09PSAtMSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKGBHcm91cCBcIiR7Z3JvdXBOYW1lfVwiIG5vdCBmb3VuZC5gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Z3JvdXAgPSBpbnN0YW5jZS5pdGVtc1tpZHhdO1xuXHRcdFx0aW5zdGFuY2UuaXRlbXMuc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRpbnN0YW5jZS5yZXF1ZXN0U2F2ZT8uKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLnJlYWRCb29rbWFya3MoKTtcblx0XHRcdGNvbnN0IGlkeCA9IGRhdGEuaXRlbXMuZmluZEluZGV4KFxuXHRcdFx0XHQoaSkgPT4gaS50eXBlID09PSBcImdyb3VwXCIgJiYgaS50aXRsZSA9PT0gZ3JvdXBOYW1lXG5cdFx0XHQpO1xuXHRcdFx0aWYgKGlkeCA9PT0gLTEpIHtcblx0XHRcdFx0bmV3IE5vdGljZShgR3JvdXAgXCIke2dyb3VwTmFtZX1cIiBub3QgZm91bmQuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGdyb3VwID0gZGF0YS5pdGVtc1tpZHhdO1xuXHRcdFx0ZGF0YS5pdGVtcy5zcGxpY2UoaWR4LCAxKTtcblx0XHRcdGF3YWl0IHRoaXMud3JpdGVCb29rbWFya3MoZGF0YSk7XG5cdFx0fVxuXG5cdFx0aWYgKGRlbGV0ZUZpbGVzICYmIGdyb3VwPy5pdGVtcykge1xuXHRcdFx0Y29uc3QgZmlsZVBhdGhzID0gZ3JvdXAuaXRlbXNcblx0XHRcdFx0LmZpbHRlcigoaSkgPT4gaS50eXBlID09PSBcImZpbGVcIiAmJiBpLnBhdGgpXG5cdFx0XHRcdC5tYXAoKGkpID0+IGkucGF0aCEpO1xuXHRcdFx0bGV0IGRlbGV0ZWQgPSAwO1xuXHRcdFx0Zm9yIChjb25zdCBwYXRoIG9mIGZpbGVQYXRocykge1xuXHRcdFx0XHRjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpO1xuXHRcdFx0XHRpZiAoZmlsZSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0LnRyYXNoKGZpbGUsIGZhbHNlKTtcblx0XHRcdFx0XHRkZWxldGVkKys7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdG5ldyBOb3RpY2UoYFJlbW92ZWQgZ3JvdXAgXCIke2dyb3VwTmFtZX1cIiBhbmQgdHJhc2hlZCAke2RlbGV0ZWR9IGZpbGUocykuYCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG5ldyBOb3RpY2UoYFJlbW92ZWQgZ3JvdXAgXCIke2dyb3VwTmFtZX1cIi5gKTtcblx0XHR9XG5cdH1cblxuXHQvLyBcdTI1MDBcdTI1MDAgSGVscGVycyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuXHRwcml2YXRlIHJlc29sdmVGaWxlUGF0aChmaWxlUGF0aD86IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuXHRcdGlmICghZmlsZVBhdGgpIHtcblx0XHRcdGNvbnN0IGFjdGl2ZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cdFx0XHRpZiAoIWFjdGl2ZSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKFwiTm8gYWN0aXZlIGZpbGUuXCIpO1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdHJldHVybiBhY3RpdmUucGF0aDtcblx0XHR9XG5cdFx0ZmlsZVBhdGggPSBmaWxlUGF0aC5lbmRzV2l0aChcIi5tZFwiKSA/IGZpbGVQYXRoIDogZmlsZVBhdGggKyBcIi5tZFwiO1xuXHRcdHJldHVybiBub3JtYWxpemVQYXRoKGZpbGVQYXRoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Qm9va21hcmtzUGx1Z2luSW5zdGFuY2UoKTogYW55IHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuICh0aGlzLmFwcCBhcyBhbnkpLmludGVybmFsUGx1Z2luc1xuXHRcdFx0XHQ/LmdldFBsdWdpbkJ5SWQ/LihcImJvb2ttYXJrc1wiKT8uaW5zdGFuY2U7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldEdyb3VwTmFtZXMoKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IGluc3RhbmNlID0gdGhpcy5nZXRCb29rbWFya3NQbHVnaW5JbnN0YW5jZSgpO1xuXHRcdGNvbnN0IGl0ZW1zOiBCb29rbWFya0l0ZW1bXSA9IGluc3RhbmNlPy5pdGVtcyA/PyBbXTtcblx0XHRyZXR1cm4gaXRlbXNcblx0XHRcdC5maWx0ZXIoKGkpID0+IGkudHlwZSA9PT0gXCJncm91cFwiICYmIGkudGl0bGUpXG5cdFx0XHQubWFwKChpKSA9PiBpLnRpdGxlIGFzIHN0cmluZyk7XG5cdH1cblxuXHRwcml2YXRlIGZpbmRHcm91cChpdGVtczogQm9va21hcmtJdGVtW10sIGdyb3VwTmFtZTogc3RyaW5nKTogQm9va21hcmtJdGVtIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gaXRlbXMuZmluZCgoaSkgPT4gaS50eXBlID09PSBcImdyb3VwXCIgJiYgaS50aXRsZSA9PT0gZ3JvdXBOYW1lKTtcblx0fVxuXG5cdHByaXZhdGUgZmluZE9yQ3JlYXRlR3JvdXAoaXRlbXM6IEJvb2ttYXJrSXRlbVtdLCBncm91cE5hbWU6IHN0cmluZyk6IEJvb2ttYXJrSXRlbSB7XG5cdFx0bGV0IGdyb3VwID0gdGhpcy5maW5kR3JvdXAoaXRlbXMsIGdyb3VwTmFtZSk7XG5cdFx0aWYgKCFncm91cCkge1xuXHRcdFx0Z3JvdXAgPSB7IHR5cGU6IFwiZ3JvdXBcIiwgY3RpbWU6IERhdGUubm93KCksIGl0ZW1zOiBbXSwgdGl0bGU6IGdyb3VwTmFtZSB9O1xuXHRcdFx0aXRlbXMucHVzaChncm91cCk7XG5cdFx0fVxuXHRcdGlmICghZ3JvdXAuaXRlbXMpIGdyb3VwLml0ZW1zID0gW107XG5cdFx0cmV0dXJuIGdyb3VwO1xuXHR9XG5cblx0cHJpdmF0ZSBncm91cEhhc0ZpbGUoZ3JvdXA6IEJvb2ttYXJrSXRlbSwgZmlsZVBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBncm91cC5pdGVtcz8uc29tZSgoaSkgPT4gaS50eXBlID09PSBcImZpbGVcIiAmJiBpLnBhdGggPT09IGZpbGVQYXRoKSA/PyBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgcmVtb3ZlRmlsZUZyb21Hcm91cChncm91cDogQm9va21hcmtJdGVtLCBmaWxlUGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0aWYgKCFncm91cC5pdGVtcykgcmV0dXJuIGZhbHNlO1xuXHRcdGNvbnN0IGlkeCA9IGdyb3VwLml0ZW1zLmZpbmRJbmRleCgoaSkgPT4gaS50eXBlID09PSBcImZpbGVcIiAmJiBpLnBhdGggPT09IGZpbGVQYXRoKTtcblx0XHRpZiAoaWR4ID09PSAtMSkgcmV0dXJuIGZhbHNlO1xuXHRcdGdyb3VwLml0ZW1zLnNwbGljZShpZHgsIDEpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0LyoqIFJlbW92ZXMgYW5kIHJldHVybnMgdGhlIGZpbGUgZW50cnksIG9yIG51bGwgaWYgbm90IGZvdW5kLiAqL1xuXHRwcml2YXRlIGV4dHJhY3RGaWxlRnJvbUdyb3VwKGdyb3VwOiBCb29rbWFya0l0ZW0sIGZpbGVQYXRoOiBzdHJpbmcpOiBCb29rbWFya0l0ZW0gfCBudWxsIHtcblx0XHRpZiAoIWdyb3VwLml0ZW1zKSByZXR1cm4gbnVsbDtcblx0XHRjb25zdCBpZHggPSBncm91cC5pdGVtcy5maW5kSW5kZXgoKGkpID0+IGkudHlwZSA9PT0gXCJmaWxlXCIgJiYgaS5wYXRoID09PSBmaWxlUGF0aCk7XG5cdFx0aWYgKGlkeCA9PT0gLTEpIHJldHVybiBudWxsO1xuXHRcdHJldHVybiBncm91cC5pdGVtcy5zcGxpY2UoaWR4LCAxKVswXTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVhZEJvb2ttYXJrcygpOiBQcm9taXNlPEJvb2ttYXJrc0RhdGE+IHtcblx0XHRjb25zdCBhZGFwdGVyID0gdGhpcy5hcHAudmF1bHQuYWRhcHRlcjtcblx0XHRpZiAoYXdhaXQgYWRhcHRlci5leGlzdHMoQk9PS01BUktTX1BBVEgpKSB7XG5cdFx0XHRjb25zdCByYXcgPSBhd2FpdCBhZGFwdGVyLnJlYWQoQk9PS01BUktTX1BBVEgpO1xuXHRcdFx0cmV0dXJuIEpTT04ucGFyc2UocmF3KSBhcyBCb29rbWFya3NEYXRhO1xuXHRcdH1cblx0XHRyZXR1cm4geyBpdGVtczogW10gfTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgd3JpdGVCb29rbWFya3MoZGF0YTogQm9va21hcmtzRGF0YSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHJhdyA9IEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIFwiXFx0XCIpO1xuXHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0LmFkYXB0ZXIud3JpdGUoQk9PS01BUktTX1BBVEgsIHJhdyk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0JBQWlFO0FBY2pFLElBQU0saUJBQWlCO0FBRXZCLElBQU0sb0JBQU4sY0FBZ0MsNkJBQXFCO0FBQUEsRUFJcEQsWUFBWSxLQUFVLFFBQWtCLFVBQW1DO0FBQzFFLFVBQU0sR0FBRztBQUNULFNBQUssU0FBUztBQUNkLFNBQUssV0FBVztBQUNoQixTQUFLLGVBQWUsK0JBQStCO0FBQUEsRUFDcEQ7QUFBQSxFQUVBLGVBQWUsT0FBeUI7QUFDdkMsVUFBTSxRQUFRLE1BQU0sWUFBWTtBQUNoQyxVQUFNLFVBQVUsS0FBSyxPQUFPO0FBQUEsTUFBTyxDQUFDLE1BQ25DLEVBQUUsWUFBWSxFQUFFLFNBQVMsS0FBSztBQUFBLElBQy9CO0FBQ0EsUUFBSSxTQUFTLENBQUMsS0FBSyxPQUFPLEtBQUssQ0FBQyxNQUFNLEVBQUUsWUFBWSxNQUFNLEtBQUssR0FBRztBQUNqRSxjQUFRLEtBQUssS0FBSztBQUFBLElBQ25CO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLGlCQUFpQixPQUFlLElBQWlCO0FBQ2hELFVBQU0sUUFBUSxDQUFDLEtBQUssT0FBTyxTQUFTLEtBQUs7QUFDekMsT0FBRyxTQUFTLE9BQU8sRUFBRSxNQUFNLFFBQVEsR0FBRyxLQUFLLGlCQUFpQixNQUFNLENBQUM7QUFBQSxFQUNwRTtBQUFBLEVBRUEsbUJBQW1CLE9BQWU7QUFDakMsU0FBSyxTQUFTLEtBQUs7QUFBQSxFQUNwQjtBQUNEO0FBRUEsSUFBcUIsY0FBckIsY0FBeUMsdUJBQU87QUFBQSxF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
