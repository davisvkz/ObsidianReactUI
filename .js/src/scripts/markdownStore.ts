import type { App, CachedMetadata, EventRef, TFile } from "obsidian";

/** Debounce local (evita import de runtime do módulo `obsidian`, indisponível no eval). */
function debounce(cb: () => void, timeout: number): () => void {
	let handle: ReturnType<typeof setTimeout> | null = null;
	return () => {
		if (handle !== null) clearTimeout(handle);
		handle = setTimeout(() => {
			handle = null;
			cb();
		}, timeout);
	};
}

export interface MdSnapshot {
	file: TFile | null;
	frontmatter: Record<string, unknown>;
	/** Corpo cru do arquivo, sem o bloco de frontmatter. */
	body: string;
	exists: boolean;
}

/** Item de uma listagem de pasta (frontmatter síncrono, sem corpo). */
export interface MdItem {
	file: TFile;
	path: string;
	basename: string;
	frontmatter: Record<string, unknown>;
}

interface Subscriber {
	cb: () => void;
	host: Node | null;
}

interface FileEntry {
	snapshot: MdSnapshot;
	subscribers: Set<Subscriber>;
}

interface FolderEntry {
	folder: string;
	snapshot: MdItem[];
	subscribers: Set<Subscriber>;
}

interface Store {
	app: App;
	refs: EventRef[];
	files: Map<string, FileEntry>;
	folders: Map<string, FolderEntry>;
	dirtyFiles: Set<string>;
	dirtyFolders: Set<string>;
	flush: () => void;
}

const KEY = "__mdStore__";

/** Pasta-pai de um path (`"todos/a.md"` → `"todos"`, raiz → `"/"`). */
function parentOf(path: string): string {
	const i = path.lastIndexOf("/");
	return i === -1 ? "/" : path.slice(0, i);
}

/** Remove o bloco `--- ... ---` do início, devolvendo só o corpo. */
function stripFrontmatter(data: string, cache?: CachedMetadata | null): string {
	const end = cache?.frontmatterPosition?.end.offset;
	if (typeof end !== "number") return data;
	return data.slice(end).replace(/^\r?\n/, "");
}

function buildSnapshot(
	app: App,
	path: string,
	data?: string,
	cache?: CachedMetadata | null,
): MdSnapshot {
	const file = app.vault.getAbstractFileByPath(path) as TFile | null;
	const fm = (cache?.frontmatter ?? {}) as Record<string, unknown>;
	return {
		file,
		frontmatter: { ...fm },
		body: stripFrontmatter(data ?? "", cache),
		exists: !!file,
	};
}

function buildFolderSnapshot(app: App, folder: string): MdItem[] {
	return app.vault
		.getMarkdownFiles()
		.filter((f) => (f.parent?.path ?? "/") === folder)
		.sort((a, b) => a.basename.localeCompare(b.basename))
		.map((file) => ({
			file,
			path: file.path,
			basename: file.basename,
			frontmatter: {
				...((app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<
					string,
					unknown
				>),
			},
		}));
}

/**
 * Devolve o store singleton vivo em `window`. Sobrevive aos `eval(bundle.js)` que
 * o Dataview faz a cada render — por isso os listeners globais são registrados UMA vez.
 */
function getStore(app: App): Store {
	const w = window as unknown as Record<string, Store | undefined>;
	const existing = w[KEY];
	if (existing) return existing;

	const store: Store = {
		app,
		refs: [],
		files: new Map(),
		folders: new Map(),
		dirtyFiles: new Set(),
		dirtyFolders: new Set(),
		flush: undefined as unknown as () => void,
	};

	const notify = (subs: Set<Subscriber>) => {
		// Poda assinantes mortos (React removido sem desmontar → cleanup não rodou).
		for (const s of subs) if (s.host && !s.host.isConnected) subs.delete(s);
		for (const s of subs) s.cb();
	};

	// Coalescência: uma rajada de eventos vira UMA notificação por entrada.
	store.flush = debounce(() => {
		for (const path of store.dirtyFiles) {
			const entry = store.files.get(path);
			if (entry) notify(entry.subscribers);
		}
		for (const folder of store.dirtyFolders) {
			const entry = store.folders.get(folder);
			if (entry) {
				entry.snapshot = buildFolderSnapshot(app, folder);
				notify(entry.subscribers);
			}
		}
		store.dirtyFiles.clear();
		store.dirtyFolders.clear();
	}, 24);

	const touchFolder = (folder: string) => {
		if (store.folders.has(folder)) {
			store.dirtyFolders.add(folder);
			store.flush();
		}
	};

	// Listeners GLOBAIS únicos para o vault inteiro.
	store.refs.push(
		app.metadataCache.on("changed", (file, data, cache) => {
			const entry = store.files.get(file.path);
			if (entry) {
				entry.snapshot = buildSnapshot(app, file.path, data, cache);
				store.dirtyFiles.add(file.path);
				store.flush();
			}
			touchFolder(file.parent?.path ?? "/");
		}),
		app.vault.on("create", (file) => touchFolder(file.parent?.path ?? "/")),
		app.vault.on("delete", (file) => touchFolder(file.parent?.path ?? "/")),
		app.vault.on("rename", (file, oldPath) => {
			touchFolder(file.parent?.path ?? "/");
			touchFolder(parentOf(oldPath));
		}),
	);

	w[KEY] = store;
	return store;
}

function ensureFileEntry(store: Store, path: string): FileEntry {
	let entry = store.files.get(path);
	if (!entry) {
		entry = {
			snapshot: buildSnapshot(
				store.app,
				path,
				undefined,
				store.app.metadataCache.getCache(path),
			),
			subscribers: new Set(),
		};
		store.files.set(path, entry);
	}
	return entry;
}

function ensureFolderEntry(store: Store, folder: string): FolderEntry {
	let entry = store.folders.get(folder);
	if (!entry) {
		entry = {
			folder,
			snapshot: buildFolderSnapshot(store.app, folder),
			subscribers: new Set(),
		};
		store.folders.set(folder, entry);
	}
	return entry;
}

/** Inscreve `cb` nas mudanças de um arquivo. `host` permite podar assinantes órfãos. */
export function subscribe(
	app: App,
	path: string,
	cb: () => void,
	host: Node | null,
): () => void {
	const store = getStore(app);
	const entry = ensureFileEntry(store, path);
	const sub: Subscriber = { cb, host };
	entry.subscribers.add(sub);
	return () => {
		entry.subscribers.delete(sub);
		if (entry.subscribers.size === 0) store.files.delete(path);
	};
}

/** Inscreve `cb` nas mudanças da listagem de uma pasta (criação/remoção/frontmatter). */
export function subscribeFolder(
	app: App,
	folder: string,
	cb: () => void,
	host: Node | null,
): () => void {
	const store = getStore(app);
	const entry = ensureFolderEntry(store, folder);
	const sub: Subscriber = { cb, host };
	entry.subscribers.add(sub);
	return () => {
		entry.subscribers.delete(sub);
		if (entry.subscribers.size === 0) store.folders.delete(folder);
	};
}

/** Snapshot referencialmente estável de um arquivo. */
export function getSnapshot(app: App, path: string): MdSnapshot {
	return ensureFileEntry(getStore(app), path).snapshot;
}

/** Snapshot referencialmente estável da listagem de uma pasta. */
export function getFolderSnapshot(app: App, folder: string): MdItem[] {
	return ensureFolderEntry(getStore(app), folder).snapshot;
}

/**
 * Escrita em lote no frontmatter: uma chamada = uma escrita = um evento `changed`
 * → (via debounce) um render. Altere várias propriedades dentro do mesmo `fn`.
 */
export async function updateFrontmatter(
	app: App,
	path: string,
	fn: (frontmatter: Record<string, unknown>) => void,
): Promise<void> {
	const file = app.vault.getAbstractFileByPath(path) as TFile | null;
	if (file) await app.fileManager.processFrontMatter(file, fn);
}

/** Garante a existência de uma pasta. */
export async function ensureFolder(app: App, folder: string): Promise<void> {
	if (folder !== "/" && !app.vault.getFolderByPath(folder)) {
		await app.vault.createFolder(folder);
	}
}

/** Cria um arquivo `.md` em `folder` com o frontmatter informado, evitando colisão de nome. */
export async function createMarkdown(
	app: App,
	folder: string,
	title: string,
	frontmatter: Record<string, unknown> = {},
): Promise<TFile> {
	await ensureFolder(app, folder);
	const safe = title.trim().replace(/[\\/:*?"<>|]/g, "-") || "untitled";
	let path = `${folder}/${safe}.md`;
	let n = 1;
	while (app.vault.getAbstractFileByPath(path)) {
		path = `${folder}/${safe} ${++n}.md`;
	}
	const yaml = Object.entries(frontmatter)
		.map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
		.join("\n");
	return app.vault.create(path, `---\n${yaml}\n---\n`);
}

/** Move um arquivo para a lixeira do sistema. */
export async function deleteFile(app: App, path: string): Promise<void> {
	const file = app.vault.getAbstractFileByPath(path) as TFile | null;
	if (file) await app.fileManager.trashFile(file);
}
