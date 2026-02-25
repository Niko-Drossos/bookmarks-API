import { Plugin, Notice, SuggestModal, App, normalizePath, TFile } from "obsidian";

interface BookmarkItem {
	type: "file" | "group";
	ctime: number;
	path?: string;
	title?: string;
	items?: BookmarkItem[];
}

interface BookmarksData {
	items: BookmarkItem[];
}

interface BookmarksPluginInstance {
	items: BookmarkItem[];
	requestSave?: () => void;
}

interface InternalPlugins {
	getPluginById?(id: string): { instance?: BookmarksPluginInstance } | undefined;
}

class GroupSuggestModal extends SuggestModal<string> {
	groups: string[];
	onSelect: (group: string) => void;

	constructor(app: App, groups: string[], onSelect: (group: string) => void) {
		super(app);
		this.groups = groups;
		this.onSelect = onSelect;
		this.setPlaceholder("Type a bookmark group name...");
	}

	getSuggestions(query: string): string[] {
		const lower = query.toLowerCase();
		const matches = this.groups.filter((g) =>
			g.toLowerCase().includes(lower)
		);
		if (query && !this.groups.some((g) => g.toLowerCase() === lower)) {
			matches.push(query);
		}
		return matches;
	}

	renderSuggestion(group: string, el: HTMLElement) {
		const isNew = !this.groups.includes(group);
		el.createEl("div", { text: isNew ? `${group} (new group)` : group });
	}

	onChooseSuggestion(group: string) {
		this.onSelect(group);
	}
}

export default class BookmarkAPI extends Plugin {
	private get bookmarksPath(): string {
		return normalizePath(`${this.app.vault.configDir}/bookmarks.json`);
	}

	async onload() {
		const api = {
			addBookmark: (groupName: string, filePath?: string, title?: string) =>
				this.addBookmark(groupName, filePath, title),
			removeBookmark: (groupName: string, filePath?: string) =>
				this.removeBookmark(groupName, filePath),
			moveBookmark: (fromGroup: string, toGroup: string, filePath?: string) =>
				this.moveBookmark(fromGroup, toGroup, filePath),
			removeBookmarkGroup: (groupName: string, deleteFiles?: boolean) =>
				this.removeBookmarkGroup(groupName, deleteFiles),
		};

		const win = window as unknown as Record<string, unknown>;
		for (const [name, fn] of Object.entries(api)) {
			win[name] = fn;
		}

		this.addCommand({
			id: "add-to-bookmark-group",
			name: "Add file to bookmark group",
			checkCallback: (checking: boolean) => {
				if (!this.app.workspace.getActiveFile()) return false;
				if (!checking) {
					new GroupSuggestModal(this.app, this.getGroupNames(), (group) => {
						void this.addBookmark(group);
					}).open();
				}
				return true;
			},
		});

		this.addCommand({
			id: "remove-from-bookmark-group",
			name: "Remove file from bookmark group",
			checkCallback: (checking: boolean) => {
				if (!this.app.workspace.getActiveFile()) return false;
				if (!checking) {
					new GroupSuggestModal(this.app, this.getGroupNames(), (group) => {
						void this.removeBookmark(group);
					}).open();
				}
				return true;
			},
		});
	}

	onunload() {
		const win = window as unknown as Record<string, unknown>;
		for (const name of ["addBookmark", "removeBookmark", "moveBookmark", "removeBookmarkGroup"]) {
			delete win[name];
		}
	}

	// ── Public API ──────────────────────────────────────────────

	async addBookmark(groupName: string, filePath?: string, title?: string): Promise<void> {
		filePath = this.resolveFilePath(filePath);
		if (!filePath) return;

		const data = await this.readBookmarks();

		const group = this.findOrCreateGroup(data.items, groupName);
		if (this.groupHasFile(group, filePath)) {
			new Notice(`"${filePath}" is already in "${groupName}".`);
			return;
		}
		const entry: BookmarkItem = { type: "file", ctime: Date.now(), path: filePath };
		if (title) entry.title = title;
		group.items!.push(entry);

		await this.writeBookmarks(data);
		this.syncInstance(data.items);

		const display = title ?? filePath;
		new Notice(`Added "${display}" to "${groupName}".`);
	}

	async removeBookmark(groupName: string, filePath?: string): Promise<void> {
		filePath = this.resolveFilePath(filePath);
		if (!filePath) return;

		const data = await this.readBookmarks();

		const group = this.findGroup(data.items, groupName);
		if (!group || !this.removeFileFromGroup(group, filePath)) {
			new Notice(`"${filePath}" not found in "${groupName}".`);
			return;
		}

		await this.writeBookmarks(data);
		this.syncInstance(data.items);

		new Notice(`Removed "${filePath}" from "${groupName}".`);
	}

	async moveBookmark(fromGroup: string, toGroup: string, filePath?: string): Promise<void> {
		filePath = this.resolveFilePath(filePath);
		if (!filePath) return;

		const data = await this.readBookmarks();

		const src = this.findGroup(data.items, fromGroup);
		if (!src) {
			new Notice(`Group "${fromGroup}" not found.`);
			return;
		}
		const entry = this.extractFileFromGroup(src, filePath);
		if (!entry) {
			new Notice(`"${filePath}" not found in "${fromGroup}".`);
			return;
		}
		const dest = this.findOrCreateGroup(data.items, toGroup);
		if (this.groupHasFile(dest, filePath)) {
			new Notice(`"${filePath}" already exists in "${toGroup}".`);
			return;
		}
		dest.items!.push(entry);

		await this.writeBookmarks(data);
		this.syncInstance(data.items);

		new Notice(`Moved "${filePath}" from "${fromGroup}" to "${toGroup}".`);
	}

	async removeBookmarkGroup(groupName: string, deleteFiles = false): Promise<void> {
		const data = await this.readBookmarks();

		const idx = data.items.findIndex(
			(i) => i.type === "group" && i.title === groupName
		);
		if (idx === -1) {
			new Notice(`Group "${groupName}" not found.`);
			return;
		}
		const group = data.items[idx];
		data.items.splice(idx, 1);

		await this.writeBookmarks(data);
		this.syncInstance(data.items);

		if (deleteFiles && group?.items) {
			const filePaths = group.items
				.filter((i) => i.type === "file" && i.path)
				.map((i) => i.path!);
			let deleted = 0;
			for (const path of filePaths) {
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file instanceof TFile) {
					await this.app.fileManager.trashFile(file);
					deleted++;
				}
			}
			new Notice(`Removed group "${groupName}" and trashed ${deleted} file(s).`);
		} else {
			new Notice(`Removed group "${groupName}".`);
		}
	}

	// ── Helpers ─────────────────────────────────────────────────

	private syncInstance(items: BookmarkItem[]): void {
		const instance = this.getBookmarksPluginInstance();
		if (!instance?.items) return;
		instance.items.length = 0;
		instance.items.push(...items);
		instance.requestSave?.();
	}

	private resolveFilePath(filePath?: string): string | null {
		if (!filePath) {
			const active = this.app.workspace.getActiveFile();
			if (!active) {
				new Notice("No active file.");
				return null;
			}
			return active.path;
		}
		filePath = filePath.endsWith(".md") ? filePath : filePath + ".md";
		return normalizePath(filePath);
	}

	private getBookmarksPluginInstance(): BookmarksPluginInstance | null {
		try {
			const app = this.app as unknown as { internalPlugins?: InternalPlugins };
			return app.internalPlugins?.getPluginById?.("bookmarks")?.instance ?? null;
		} catch {
			return null;
		}
	}

	private getGroupNames(): string[] {
		const instance = this.getBookmarksPluginInstance();
		const items: BookmarkItem[] = instance?.items ?? [];
		return items
			.filter((i) => i.type === "group" && i.title)
			.map((i) => i.title as string);
	}

	private findGroup(items: BookmarkItem[], groupName: string): BookmarkItem | undefined {
		return items.find((i) => i.type === "group" && i.title === groupName);
	}

	private findOrCreateGroup(items: BookmarkItem[], groupName: string): BookmarkItem {
		let group = this.findGroup(items, groupName);
		if (!group) {
			group = { type: "group", ctime: Date.now(), items: [], title: groupName };
			items.push(group);
		}
		if (!group.items) group.items = [];
		return group;
	}

	private groupHasFile(group: BookmarkItem, filePath: string): boolean {
		return group.items?.some((i) => i.type === "file" && i.path === filePath) ?? false;
	}

	private removeFileFromGroup(group: BookmarkItem, filePath: string): boolean {
		if (!group.items) return false;
		const idx = group.items.findIndex((i) => i.type === "file" && i.path === filePath);
		if (idx === -1) return false;
		group.items.splice(idx, 1);
		return true;
	}

	/** Removes and returns the file entry, or null if not found. */
	private extractFileFromGroup(group: BookmarkItem, filePath: string): BookmarkItem | null {
		if (!group.items) return null;
		const idx = group.items.findIndex((i) => i.type === "file" && i.path === filePath);
		if (idx === -1) return null;
		return group.items.splice(idx, 1)[0];
	}

	private async readBookmarks(): Promise<BookmarksData> {
		const adapter = this.app.vault.adapter;
		if (await adapter.exists(this.bookmarksPath)) {
			const raw = await adapter.read(this.bookmarksPath);
			return JSON.parse(raw) as BookmarksData;
		}
		return { items: [] };
	}

	private async writeBookmarks(data: BookmarksData): Promise<void> {
		const raw = JSON.stringify(data, null, "\t");
		await this.app.vault.adapter.write(this.bookmarksPath, raw);
	}
}
