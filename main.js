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
      callback: () => {
        new GroupSuggestModal(this.app, this.getGroupNames(), async (group) => {
          await this.addBookmark(group);
        }).open();
      }
    });
    this.addCommand({
      id: "remove-from-bookmark-group",
      name: "Remove file from bookmark group",
      callback: () => {
        new GroupSuggestModal(this.app, this.getGroupNames(), async (group) => {
          await this.removeBookmark(group);
        }).open();
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
    return filePath.endsWith(".md") ? filePath : filePath + ".md";
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luLCBOb3RpY2UsIFN1Z2dlc3RNb2RhbCwgQXBwIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmludGVyZmFjZSBCb29rbWFya0l0ZW0ge1xuXHR0eXBlOiBcImZpbGVcIiB8IFwiZ3JvdXBcIjtcblx0Y3RpbWU6IG51bWJlcjtcblx0cGF0aD86IHN0cmluZztcblx0dGl0bGU/OiBzdHJpbmc7XG5cdGl0ZW1zPzogQm9va21hcmtJdGVtW107XG59XG5cbmludGVyZmFjZSBCb29rbWFya3NEYXRhIHtcblx0aXRlbXM6IEJvb2ttYXJrSXRlbVtdO1xufVxuXG5jb25zdCBCT09LTUFSS1NfUEFUSCA9IFwiLm9ic2lkaWFuL2Jvb2ttYXJrcy5qc29uXCI7XG5cbmNsYXNzIEdyb3VwU3VnZ2VzdE1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPHN0cmluZz4ge1xuXHRncm91cHM6IHN0cmluZ1tdO1xuXHRvblNlbGVjdDogKGdyb3VwOiBzdHJpbmcpID0+IHZvaWQ7XG5cblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIGdyb3Vwczogc3RyaW5nW10sIG9uU2VsZWN0OiAoZ3JvdXA6IHN0cmluZykgPT4gdm9pZCkge1xuXHRcdHN1cGVyKGFwcCk7XG5cdFx0dGhpcy5ncm91cHMgPSBncm91cHM7XG5cdFx0dGhpcy5vblNlbGVjdCA9IG9uU2VsZWN0O1xuXHRcdHRoaXMuc2V0UGxhY2Vob2xkZXIoXCJUeXBlIGEgYm9va21hcmsgZ3JvdXAgbmFtZS4uLlwiKTtcblx0fVxuXG5cdGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgbG93ZXIgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuXHRcdGNvbnN0IG1hdGNoZXMgPSB0aGlzLmdyb3Vwcy5maWx0ZXIoKGcpID0+XG5cdFx0XHRnLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMobG93ZXIpXG5cdFx0KTtcblx0XHRpZiAocXVlcnkgJiYgIXRoaXMuZ3JvdXBzLnNvbWUoKGcpID0+IGcudG9Mb3dlckNhc2UoKSA9PT0gbG93ZXIpKSB7XG5cdFx0XHRtYXRjaGVzLnB1c2gocXVlcnkpO1xuXHRcdH1cblx0XHRyZXR1cm4gbWF0Y2hlcztcblx0fVxuXG5cdHJlbmRlclN1Z2dlc3Rpb24oZ3JvdXA6IHN0cmluZywgZWw6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29uc3QgaXNOZXcgPSAhdGhpcy5ncm91cHMuaW5jbHVkZXMoZ3JvdXApO1xuXHRcdGVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgdGV4dDogaXNOZXcgPyBgJHtncm91cH0gKG5ldyBncm91cClgIDogZ3JvdXAgfSk7XG5cdH1cblxuXHRvbkNob29zZVN1Z2dlc3Rpb24oZ3JvdXA6IHN0cmluZykge1xuXHRcdHRoaXMub25TZWxlY3QoZ3JvdXApO1xuXHR9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEJvb2ttYXJrQVBJIGV4dGVuZHMgUGx1Z2luIHtcblx0YXN5bmMgb25sb2FkKCkge1xuXHRcdGNvbnN0IGFwaSA9IHtcblx0XHRcdGFkZEJvb2ttYXJrOiAoZ3JvdXBOYW1lOiBzdHJpbmcsIGZpbGVQYXRoPzogc3RyaW5nLCB0aXRsZT86IHN0cmluZykgPT5cblx0XHRcdFx0dGhpcy5hZGRCb29rbWFyayhncm91cE5hbWUsIGZpbGVQYXRoLCB0aXRsZSksXG5cdFx0XHRyZW1vdmVCb29rbWFyazogKGdyb3VwTmFtZTogc3RyaW5nLCBmaWxlUGF0aD86IHN0cmluZykgPT5cblx0XHRcdFx0dGhpcy5yZW1vdmVCb29rbWFyayhncm91cE5hbWUsIGZpbGVQYXRoKSxcblx0XHRcdG1vdmVCb29rbWFyazogKGZyb21Hcm91cDogc3RyaW5nLCB0b0dyb3VwOiBzdHJpbmcsIGZpbGVQYXRoPzogc3RyaW5nKSA9PlxuXHRcdFx0XHR0aGlzLm1vdmVCb29rbWFyayhmcm9tR3JvdXAsIHRvR3JvdXAsIGZpbGVQYXRoKSxcblx0XHRcdHJlbW92ZUJvb2ttYXJrR3JvdXA6IChncm91cE5hbWU6IHN0cmluZywgZGVsZXRlRmlsZXM/OiBib29sZWFuKSA9PlxuXHRcdFx0XHR0aGlzLnJlbW92ZUJvb2ttYXJrR3JvdXAoZ3JvdXBOYW1lLCBkZWxldGVGaWxlcyksXG5cdFx0fTtcblxuXHRcdGZvciAoY29uc3QgW25hbWUsIGZuXSBvZiBPYmplY3QuZW50cmllcyhhcGkpKSB7XG5cdFx0XHQod2luZG93IGFzIGFueSlbbmFtZV0gPSBmbjtcblx0XHR9XG5cblx0XHR0aGlzLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6IFwiYWRkLXRvLWJvb2ttYXJrLWdyb3VwXCIsXG5cdFx0XHRuYW1lOiBcIkFkZCBmaWxlIHRvIGJvb2ttYXJrIGdyb3VwXCIsXG5cdFx0XHRjYWxsYmFjazogKCkgPT4ge1xuXHRcdFx0XHRuZXcgR3JvdXBTdWdnZXN0TW9kYWwodGhpcy5hcHAsIHRoaXMuZ2V0R3JvdXBOYW1lcygpLCBhc3luYyAoZ3JvdXApID0+IHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmFkZEJvb2ttYXJrKGdyb3VwKTtcblx0XHRcdFx0fSkub3BlbigpO1xuXHRcdFx0fSxcblx0XHR9KTtcblxuXHRcdHRoaXMuYWRkQ29tbWFuZCh7XG5cdFx0XHRpZDogXCJyZW1vdmUtZnJvbS1ib29rbWFyay1ncm91cFwiLFxuXHRcdFx0bmFtZTogXCJSZW1vdmUgZmlsZSBmcm9tIGJvb2ttYXJrIGdyb3VwXCIsXG5cdFx0XHRjYWxsYmFjazogKCkgPT4ge1xuXHRcdFx0XHRuZXcgR3JvdXBTdWdnZXN0TW9kYWwodGhpcy5hcHAsIHRoaXMuZ2V0R3JvdXBOYW1lcygpLCBhc3luYyAoZ3JvdXApID0+IHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnJlbW92ZUJvb2ttYXJrKGdyb3VwKTtcblx0XHRcdFx0fSkub3BlbigpO1xuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdG9udW5sb2FkKCkge1xuXHRcdGZvciAoY29uc3QgbmFtZSBvZiBbXCJhZGRCb29rbWFya1wiLCBcInJlbW92ZUJvb2ttYXJrXCIsIFwibW92ZUJvb2ttYXJrXCIsIFwicmVtb3ZlQm9va21hcmtHcm91cFwiXSkge1xuXHRcdFx0ZGVsZXRlICh3aW5kb3cgYXMgYW55KVtuYW1lXTtcblx0XHR9XG5cdH1cblxuXHQvLyBcdTI1MDBcdTI1MDAgUHVibGljIEFQSSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuXHRhc3luYyBhZGRCb29rbWFyayhncm91cE5hbWU6IHN0cmluZywgZmlsZVBhdGg/OiBzdHJpbmcsIHRpdGxlPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0ZmlsZVBhdGggPSB0aGlzLnJlc29sdmVGaWxlUGF0aChmaWxlUGF0aCk7XG5cdFx0aWYgKCFmaWxlUGF0aCkgcmV0dXJuO1xuXG5cdFx0Y29uc3QgaW5zdGFuY2UgPSB0aGlzLmdldEJvb2ttYXJrc1BsdWdpbkluc3RhbmNlKCk7XG5cdFx0aWYgKGluc3RhbmNlPy5pdGVtcykge1xuXHRcdFx0Y29uc3QgZ3JvdXAgPSB0aGlzLmZpbmRPckNyZWF0ZUdyb3VwKGluc3RhbmNlLml0ZW1zLCBncm91cE5hbWUpO1xuXHRcdFx0aWYgKHRoaXMuZ3JvdXBIYXNGaWxlKGdyb3VwLCBmaWxlUGF0aCkpIHtcblx0XHRcdFx0bmV3IE5vdGljZShgXCIke2ZpbGVQYXRofVwiIGlzIGFscmVhZHkgaW4gXCIke2dyb3VwTmFtZX1cIi5gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZW50cnk6IEJvb2ttYXJrSXRlbSA9IHsgdHlwZTogXCJmaWxlXCIsIGN0aW1lOiBEYXRlLm5vdygpLCBwYXRoOiBmaWxlUGF0aCB9O1xuXHRcdFx0aWYgKHRpdGxlKSBlbnRyeS50aXRsZSA9IHRpdGxlO1xuXHRcdFx0Z3JvdXAuaXRlbXMhLnB1c2goZW50cnkpO1xuXHRcdFx0aW5zdGFuY2UucmVxdWVzdFNhdmU/LigpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5yZWFkQm9va21hcmtzKCk7XG5cdFx0XHRjb25zdCBncm91cCA9IHRoaXMuZmluZE9yQ3JlYXRlR3JvdXAoZGF0YS5pdGVtcywgZ3JvdXBOYW1lKTtcblx0XHRcdGlmICh0aGlzLmdyb3VwSGFzRmlsZShncm91cCwgZmlsZVBhdGgpKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYFwiJHtmaWxlUGF0aH1cIiBpcyBhbHJlYWR5IGluIFwiJHtncm91cE5hbWV9XCIuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGVudHJ5OiBCb29rbWFya0l0ZW0gPSB7IHR5cGU6IFwiZmlsZVwiLCBjdGltZTogRGF0ZS5ub3coKSwgcGF0aDogZmlsZVBhdGggfTtcblx0XHRcdGlmICh0aXRsZSkgZW50cnkudGl0bGUgPSB0aXRsZTtcblx0XHRcdGdyb3VwLml0ZW1zIS5wdXNoKGVudHJ5KTtcblx0XHRcdGF3YWl0IHRoaXMud3JpdGVCb29rbWFya3MoZGF0YSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlzcGxheSA9IHRpdGxlID8/IGZpbGVQYXRoO1xuXHRcdG5ldyBOb3RpY2UoYEFkZGVkIFwiJHtkaXNwbGF5fVwiIHRvIFwiJHtncm91cE5hbWV9XCIuYCk7XG5cdH1cblxuXHRhc3luYyByZW1vdmVCb29rbWFyayhncm91cE5hbWU6IHN0cmluZywgZmlsZVBhdGg/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRmaWxlUGF0aCA9IHRoaXMucmVzb2x2ZUZpbGVQYXRoKGZpbGVQYXRoKTtcblx0XHRpZiAoIWZpbGVQYXRoKSByZXR1cm47XG5cblx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuZ2V0Qm9va21hcmtzUGx1Z2luSW5zdGFuY2UoKTtcblx0XHRpZiAoaW5zdGFuY2U/Lml0ZW1zKSB7XG5cdFx0XHRjb25zdCBncm91cCA9IHRoaXMuZmluZEdyb3VwKGluc3RhbmNlLml0ZW1zLCBncm91cE5hbWUpO1xuXHRcdFx0aWYgKCFncm91cCB8fCAhdGhpcy5yZW1vdmVGaWxlRnJvbUdyb3VwKGdyb3VwLCBmaWxlUGF0aCkpIHtcblx0XHRcdFx0bmV3IE5vdGljZShgXCIke2ZpbGVQYXRofVwiIG5vdCBmb3VuZCBpbiBcIiR7Z3JvdXBOYW1lfVwiLmApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpbnN0YW5jZS5yZXF1ZXN0U2F2ZT8uKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLnJlYWRCb29rbWFya3MoKTtcblx0XHRcdGNvbnN0IGdyb3VwID0gdGhpcy5maW5kR3JvdXAoZGF0YS5pdGVtcywgZ3JvdXBOYW1lKTtcblx0XHRcdGlmICghZ3JvdXAgfHwgIXRoaXMucmVtb3ZlRmlsZUZyb21Hcm91cChncm91cCwgZmlsZVBhdGgpKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYFwiJHtmaWxlUGF0aH1cIiBub3QgZm91bmQgaW4gXCIke2dyb3VwTmFtZX1cIi5gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy53cml0ZUJvb2ttYXJrcyhkYXRhKTtcblx0XHR9XG5cblx0XHRuZXcgTm90aWNlKGBSZW1vdmVkIFwiJHtmaWxlUGF0aH1cIiBmcm9tIFwiJHtncm91cE5hbWV9XCIuYCk7XG5cdH1cblxuXHRhc3luYyBtb3ZlQm9va21hcmsoZnJvbUdyb3VwOiBzdHJpbmcsIHRvR3JvdXA6IHN0cmluZywgZmlsZVBhdGg/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRmaWxlUGF0aCA9IHRoaXMucmVzb2x2ZUZpbGVQYXRoKGZpbGVQYXRoKTtcblx0XHRpZiAoIWZpbGVQYXRoKSByZXR1cm47XG5cblx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuZ2V0Qm9va21hcmtzUGx1Z2luSW5zdGFuY2UoKTtcblx0XHRpZiAoaW5zdGFuY2U/Lml0ZW1zKSB7XG5cdFx0XHRjb25zdCBzcmMgPSB0aGlzLmZpbmRHcm91cChpbnN0YW5jZS5pdGVtcywgZnJvbUdyb3VwKTtcblx0XHRcdGlmICghc3JjKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYEdyb3VwIFwiJHtmcm9tR3JvdXB9XCIgbm90IGZvdW5kLmApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBlbnRyeSA9IHRoaXMuZXh0cmFjdEZpbGVGcm9tR3JvdXAoc3JjLCBmaWxlUGF0aCk7XG5cdFx0XHRpZiAoIWVudHJ5KSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYFwiJHtmaWxlUGF0aH1cIiBub3QgZm91bmQgaW4gXCIke2Zyb21Hcm91cH1cIi5gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZGVzdCA9IHRoaXMuZmluZE9yQ3JlYXRlR3JvdXAoaW5zdGFuY2UuaXRlbXMsIHRvR3JvdXApO1xuXHRcdFx0aWYgKHRoaXMuZ3JvdXBIYXNGaWxlKGRlc3QsIGZpbGVQYXRoKSkge1xuXHRcdFx0XHRuZXcgTm90aWNlKGBcIiR7ZmlsZVBhdGh9XCIgYWxyZWFkeSBleGlzdHMgaW4gXCIke3RvR3JvdXB9XCIuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGRlc3QuaXRlbXMhLnB1c2goZW50cnkpO1xuXHRcdFx0aW5zdGFuY2UucmVxdWVzdFNhdmU/LigpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5yZWFkQm9va21hcmtzKCk7XG5cdFx0XHRjb25zdCBzcmMgPSB0aGlzLmZpbmRHcm91cChkYXRhLml0ZW1zLCBmcm9tR3JvdXApO1xuXHRcdFx0aWYgKCFzcmMpIHtcblx0XHRcdFx0bmV3IE5vdGljZShgR3JvdXAgXCIke2Zyb21Hcm91cH1cIiBub3QgZm91bmQuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGVudHJ5ID0gdGhpcy5leHRyYWN0RmlsZUZyb21Hcm91cChzcmMsIGZpbGVQYXRoKTtcblx0XHRcdGlmICghZW50cnkpIHtcblx0XHRcdFx0bmV3IE5vdGljZShgXCIke2ZpbGVQYXRofVwiIG5vdCBmb3VuZCBpbiBcIiR7ZnJvbUdyb3VwfVwiLmApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBkZXN0ID0gdGhpcy5maW5kT3JDcmVhdGVHcm91cChkYXRhLml0ZW1zLCB0b0dyb3VwKTtcblx0XHRcdGlmICh0aGlzLmdyb3VwSGFzRmlsZShkZXN0LCBmaWxlUGF0aCkpIHtcblx0XHRcdFx0bmV3IE5vdGljZShgXCIke2ZpbGVQYXRofVwiIGFscmVhZHkgZXhpc3RzIGluIFwiJHt0b0dyb3VwfVwiLmApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRkZXN0Lml0ZW1zIS5wdXNoKGVudHJ5KTtcblx0XHRcdGF3YWl0IHRoaXMud3JpdGVCb29rbWFya3MoZGF0YSk7XG5cdFx0fVxuXG5cdFx0bmV3IE5vdGljZShgTW92ZWQgXCIke2ZpbGVQYXRofVwiIGZyb20gXCIke2Zyb21Hcm91cH1cIiB0byBcIiR7dG9Hcm91cH1cIi5gKTtcblx0fVxuXG5cdGFzeW5jIHJlbW92ZUJvb2ttYXJrR3JvdXAoZ3JvdXBOYW1lOiBzdHJpbmcsIGRlbGV0ZUZpbGVzID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRsZXQgZ3JvdXA6IEJvb2ttYXJrSXRlbSB8IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IGluc3RhbmNlID0gdGhpcy5nZXRCb29rbWFya3NQbHVnaW5JbnN0YW5jZSgpO1xuXHRcdGlmIChpbnN0YW5jZT8uaXRlbXMpIHtcblx0XHRcdGNvbnN0IGlkeCA9IGluc3RhbmNlLml0ZW1zLmZpbmRJbmRleChcblx0XHRcdFx0KGk6IEJvb2ttYXJrSXRlbSkgPT4gaS50eXBlID09PSBcImdyb3VwXCIgJiYgaS50aXRsZSA9PT0gZ3JvdXBOYW1lXG5cdFx0XHQpO1xuXHRcdFx0aWYgKGlkeCA9PT0gLTEpIHtcblx0XHRcdFx0bmV3IE5vdGljZShgR3JvdXAgXCIke2dyb3VwTmFtZX1cIiBub3QgZm91bmQuYCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGdyb3VwID0gaW5zdGFuY2UuaXRlbXNbaWR4XTtcblx0XHRcdGluc3RhbmNlLml0ZW1zLnNwbGljZShpZHgsIDEpO1xuXHRcdFx0aW5zdGFuY2UucmVxdWVzdFNhdmU/LigpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5yZWFkQm9va21hcmtzKCk7XG5cdFx0XHRjb25zdCBpZHggPSBkYXRhLml0ZW1zLmZpbmRJbmRleChcblx0XHRcdFx0KGkpID0+IGkudHlwZSA9PT0gXCJncm91cFwiICYmIGkudGl0bGUgPT09IGdyb3VwTmFtZVxuXHRcdFx0KTtcblx0XHRcdGlmIChpZHggPT09IC0xKSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYEdyb3VwIFwiJHtncm91cE5hbWV9XCIgbm90IGZvdW5kLmApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRncm91cCA9IGRhdGEuaXRlbXNbaWR4XTtcblx0XHRcdGRhdGEuaXRlbXMuc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRhd2FpdCB0aGlzLndyaXRlQm9va21hcmtzKGRhdGEpO1xuXHRcdH1cblxuXHRcdGlmIChkZWxldGVGaWxlcyAmJiBncm91cD8uaXRlbXMpIHtcblx0XHRcdGNvbnN0IGZpbGVQYXRocyA9IGdyb3VwLml0ZW1zXG5cdFx0XHRcdC5maWx0ZXIoKGkpID0+IGkudHlwZSA9PT0gXCJmaWxlXCIgJiYgaS5wYXRoKVxuXHRcdFx0XHQubWFwKChpKSA9PiBpLnBhdGghKTtcblx0XHRcdGxldCBkZWxldGVkID0gMDtcblx0XHRcdGZvciAoY29uc3QgcGF0aCBvZiBmaWxlUGF0aHMpIHtcblx0XHRcdFx0Y29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcblx0XHRcdFx0aWYgKGZpbGUpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC50cmFzaChmaWxlLCBmYWxzZSk7XG5cdFx0XHRcdFx0ZGVsZXRlZCsrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRuZXcgTm90aWNlKGBSZW1vdmVkIGdyb3VwIFwiJHtncm91cE5hbWV9XCIgYW5kIHRyYXNoZWQgJHtkZWxldGVkfSBmaWxlKHMpLmApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRuZXcgTm90aWNlKGBSZW1vdmVkIGdyb3VwIFwiJHtncm91cE5hbWV9XCIuYCk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gXHUyNTAwXHUyNTAwIEhlbHBlcnMgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cblx0cHJpdmF0ZSByZXNvbHZlRmlsZVBhdGgoZmlsZVBhdGg/OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRpZiAoIWZpbGVQYXRoKSB7XG5cdFx0XHRjb25zdCBhY3RpdmUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXHRcdFx0aWYgKCFhY3RpdmUpIHtcblx0XHRcdFx0bmV3IE5vdGljZShcIk5vIGFjdGl2ZSBmaWxlLlwiKTtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYWN0aXZlLnBhdGg7XG5cdFx0fVxuXHRcdHJldHVybiBmaWxlUGF0aC5lbmRzV2l0aChcIi5tZFwiKSA/IGZpbGVQYXRoIDogZmlsZVBhdGggKyBcIi5tZFwiO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRCb29rbWFya3NQbHVnaW5JbnN0YW5jZSgpOiBhbnkge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gKHRoaXMuYXBwIGFzIGFueSkuaW50ZXJuYWxQbHVnaW5zXG5cdFx0XHRcdD8uZ2V0UGx1Z2luQnlJZD8uKFwiYm9va21hcmtzXCIpPy5pbnN0YW5jZTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0R3JvdXBOYW1lcygpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgaW5zdGFuY2UgPSB0aGlzLmdldEJvb2ttYXJrc1BsdWdpbkluc3RhbmNlKCk7XG5cdFx0Y29uc3QgaXRlbXM6IEJvb2ttYXJrSXRlbVtdID0gaW5zdGFuY2U/Lml0ZW1zID8/IFtdO1xuXHRcdHJldHVybiBpdGVtc1xuXHRcdFx0LmZpbHRlcigoaSkgPT4gaS50eXBlID09PSBcImdyb3VwXCIgJiYgaS50aXRsZSlcblx0XHRcdC5tYXAoKGkpID0+IGkudGl0bGUgYXMgc3RyaW5nKTtcblx0fVxuXG5cdHByaXZhdGUgZmluZEdyb3VwKGl0ZW1zOiBCb29rbWFya0l0ZW1bXSwgZ3JvdXBOYW1lOiBzdHJpbmcpOiBCb29rbWFya0l0ZW0gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBpdGVtcy5maW5kKChpKSA9PiBpLnR5cGUgPT09IFwiZ3JvdXBcIiAmJiBpLnRpdGxlID09PSBncm91cE5hbWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBmaW5kT3JDcmVhdGVHcm91cChpdGVtczogQm9va21hcmtJdGVtW10sIGdyb3VwTmFtZTogc3RyaW5nKTogQm9va21hcmtJdGVtIHtcblx0XHRsZXQgZ3JvdXAgPSB0aGlzLmZpbmRHcm91cChpdGVtcywgZ3JvdXBOYW1lKTtcblx0XHRpZiAoIWdyb3VwKSB7XG5cdFx0XHRncm91cCA9IHsgdHlwZTogXCJncm91cFwiLCBjdGltZTogRGF0ZS5ub3coKSwgaXRlbXM6IFtdLCB0aXRsZTogZ3JvdXBOYW1lIH07XG5cdFx0XHRpdGVtcy5wdXNoKGdyb3VwKTtcblx0XHR9XG5cdFx0aWYgKCFncm91cC5pdGVtcykgZ3JvdXAuaXRlbXMgPSBbXTtcblx0XHRyZXR1cm4gZ3JvdXA7XG5cdH1cblxuXHRwcml2YXRlIGdyb3VwSGFzRmlsZShncm91cDogQm9va21hcmtJdGVtLCBmaWxlUGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGdyb3VwLml0ZW1zPy5zb21lKChpKSA9PiBpLnR5cGUgPT09IFwiZmlsZVwiICYmIGkucGF0aCA9PT0gZmlsZVBhdGgpID8/IGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSByZW1vdmVGaWxlRnJvbUdyb3VwKGdyb3VwOiBCb29rbWFya0l0ZW0sIGZpbGVQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRpZiAoIWdyb3VwLml0ZW1zKSByZXR1cm4gZmFsc2U7XG5cdFx0Y29uc3QgaWR4ID0gZ3JvdXAuaXRlbXMuZmluZEluZGV4KChpKSA9PiBpLnR5cGUgPT09IFwiZmlsZVwiICYmIGkucGF0aCA9PT0gZmlsZVBhdGgpO1xuXHRcdGlmIChpZHggPT09IC0xKSByZXR1cm4gZmFsc2U7XG5cdFx0Z3JvdXAuaXRlbXMuc3BsaWNlKGlkeCwgMSk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKiogUmVtb3ZlcyBhbmQgcmV0dXJucyB0aGUgZmlsZSBlbnRyeSwgb3IgbnVsbCBpZiBub3QgZm91bmQuICovXG5cdHByaXZhdGUgZXh0cmFjdEZpbGVGcm9tR3JvdXAoZ3JvdXA6IEJvb2ttYXJrSXRlbSwgZmlsZVBhdGg6IHN0cmluZyk6IEJvb2ttYXJrSXRlbSB8IG51bGwge1xuXHRcdGlmICghZ3JvdXAuaXRlbXMpIHJldHVybiBudWxsO1xuXHRcdGNvbnN0IGlkeCA9IGdyb3VwLml0ZW1zLmZpbmRJbmRleCgoaSkgPT4gaS50eXBlID09PSBcImZpbGVcIiAmJiBpLnBhdGggPT09IGZpbGVQYXRoKTtcblx0XHRpZiAoaWR4ID09PSAtMSkgcmV0dXJuIG51bGw7XG5cdFx0cmV0dXJuIGdyb3VwLml0ZW1zLnNwbGljZShpZHgsIDEpWzBdO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZWFkQm9va21hcmtzKCk6IFByb21pc2U8Qm9va21hcmtzRGF0YT4ge1xuXHRcdGNvbnN0IGFkYXB0ZXIgPSB0aGlzLmFwcC52YXVsdC5hZGFwdGVyO1xuXHRcdGlmIChhd2FpdCBhZGFwdGVyLmV4aXN0cyhCT09LTUFSS1NfUEFUSCkpIHtcblx0XHRcdGNvbnN0IHJhdyA9IGF3YWl0IGFkYXB0ZXIucmVhZChCT09LTUFSS1NfUEFUSCk7XG5cdFx0XHRyZXR1cm4gSlNPTi5wYXJzZShyYXcpIGFzIEJvb2ttYXJrc0RhdGE7XG5cdFx0fVxuXHRcdHJldHVybiB7IGl0ZW1zOiBbXSB9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB3cml0ZUJvb2ttYXJrcyhkYXRhOiBCb29rbWFya3NEYXRhKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcmF3ID0gSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgXCJcXHRcIik7XG5cdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQuYWRhcHRlci53cml0ZShCT09LTUFSS1NfUEFUSCwgcmF3KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQkFBa0Q7QUFjbEQsSUFBTSxpQkFBaUI7QUFFdkIsSUFBTSxvQkFBTixjQUFnQyw2QkFBcUI7QUFBQSxFQUlwRCxZQUFZLEtBQVUsUUFBa0IsVUFBbUM7QUFDMUUsVUFBTSxHQUFHO0FBQ1QsU0FBSyxT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
