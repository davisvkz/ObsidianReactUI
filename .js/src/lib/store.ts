import type { App, EventRef, TFile, TFolder } from "obsidian";
import { containingFolderKeys, folderFilesKey, parentOf } from "@/lib/path";
import { ReactiveCache } from "@/lib/reactiveCache";
import {
	isFolder,
	type MdSnapshot,
	stripFrontmatter,
	type Subfolder,
} from "@/lib/snapshot";

// ---------------------------------------------------------------------------
// Debounce local (evita import de runtime do módulo `obsidian`, indisponível no eval)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Construção de snapshots (funções puras: App + chave → dado imutável)
// ---------------------------------------------------------------------------

function buildSnapshot(
	app: App,
	path: string,
	data?: string,
	cache?: import("obsidian").CachedMetadata | null,
): MdSnapshot {
	const file = app.vault.getAbstractFileByPath(path) as TFile | null;
	const fm = (cache?.frontmatter ?? {}) as Record<string, unknown>;
	return {
		body: stripFrontmatter(data ?? "", cache),
		exists: !!file,
		file,
		frontmatter: { ...fm },
	};
}

function buildSubfolders(app: App, folder: string): Subfolder[] {
	const dir = app.vault.getFolderByPath(folder);
	if (!dir) return [];
	return dir.children
		.filter(isFolder)
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((c) => ({ name: c.name, path: c.path }));
}

function collectMdFiles(
	dir: import("obsidian").TFolder,
	recursive: boolean,
): import("obsidian").TFile[] {
	const result: import("obsidian").TFile[] = [];
	for (const child of dir.children) {
		if (isFolder(child)) {
			if (recursive)
				result.push(...collectMdFiles(child as TFolder, recursive));
		} else if (child.path.endsWith(".md")) {
			result.push(child as TFile);
		}
	}
	return result;
}

function buildFolderFiles(
	app: App,
	lastData: Map<string, string>,
	key: string,
): MdSnapshot[] {
	const recursive = key.startsWith("r:");
	const folder = key.slice(2);
	const dir = app.vault.getFolderByPath(folder);
	if (!dir) return [];
	const files = collectMdFiles(dir as TFolder, recursive);
	files.sort((a, b) => a.path.localeCompare(b.path));
	return files.map((f) =>
		buildSnapshot(
			app,
			f.path,
			lastData.get(f.path),
			app.metadataCache.getCache(f.path),
		),
	);
}

// ---------------------------------------------------------------------------
// Store singleton
// ---------------------------------------------------------------------------

interface Store {
	files: ReactiveCache<MdSnapshot>;
	/** Keyed por `"r:<folder>"` (recursivo) ou `"f:<folder>"` (plano). */
	folderFiles: ReactiveCache<MdSnapshot[]>;
	refs: EventRef[];
	subfolders: ReactiveCache<Subfolder[]>;
}

const STORE_KEY = "__mdStore__";

/**
 * Devolve o store singleton vivo em `window`. Sobrevive aos `eval(bundle.js)` que
 * o Dataview faz a cada render — os listeners globais são registrados UMA vez.
 */
function getStore(app: App): Store {
	const w = window as unknown as Record<string, Store | undefined>;
	const existing = w[STORE_KEY];
	if (existing) return existing;

	const lastData = new Map<string, string>();

	let flush: () => void = () => {};
	const requestFlush = () => flush();

	const files = new ReactiveCache<MdSnapshot>(
		(path) =>
			buildSnapshot(
				app,
				path,
				lastData.get(path),
				app.metadataCache.getCache(path),
			),
		requestFlush,
	);
	const subfolders = new ReactiveCache<Subfolder[]>(
		(folder) => buildSubfolders(app, folder),
		requestFlush,
	);
	const folderFiles = new ReactiveCache<MdSnapshot[]>(
		(key) => buildFolderFiles(app, lastData, key),
		requestFlush,
	);

	// Uma rajada de eventos vira UM flush → UM render por entrada.
	flush = debounce(() => {
		files.flush();
		subfolders.flush();
		folderFiles.flush();
	}, 24);

	const invalidateContainingFolders = (path: string) => {
		for (const key of containingFolderKeys(path)) folderFiles.invalidate(key);
	};

	const onStructuralChange = (path: string) => {
		files.invalidate(path);
		subfolders.invalidate(parentOf(path));
		invalidateContainingFolders(path);
	};

	const store: Store = { files, folderFiles, refs: [], subfolders };

	store.refs.push(
		app.metadataCache.on("changed", (file, data) => {
			lastData.set(file.path, data);
			files.invalidate(file.path);
			invalidateContainingFolders(file.path);
		}),
		app.vault.on("create", (file) => onStructuralChange(file.path)),
		app.vault.on("delete", (file) => {
			lastData.delete(file.path);
			onStructuralChange(file.path);
		}),
		app.vault.on("rename", (file, oldPath) => {
			lastData.delete(oldPath);
			onStructuralChange(file.path);
			onStructuralChange(oldPath);
		}),
	);

	w[STORE_KEY] = store;
	return store;
}

// ---------------------------------------------------------------------------
// API pública — leitura reativa
// ---------------------------------------------------------------------------

export function subscribe(
	app: App,
	path: string,
	cb: () => void,
	host: Node | null,
): () => void {
	return getStore(app).files.subscribe(path, cb, host);
}

export function subscribeSubfolders(
	app: App,
	folder: string,
	cb: () => void,
	host: Node | null,
): () => void {
	return getStore(app).subfolders.subscribe(folder, cb, host);
}

export function subscribeFolderFiles(
	app: App,
	folder: string,
	recursive: boolean,
	cb: () => void,
	host: Node | null,
): () => void {
	return getStore(app).folderFiles.subscribe(
		folderFilesKey(folder, recursive),
		cb,
		host,
	);
}

export function getSnapshot(app: App, path: string): MdSnapshot {
	return getStore(app).files.getSnapshot(path);
}

export function getSubfolders(app: App, folder: string): Subfolder[] {
	return getStore(app).subfolders.getSnapshot(folder);
}

export function getFolderFiles(
	app: App,
	folder: string,
	recursive: boolean,
): MdSnapshot[] {
	return getStore(app).folderFiles.getSnapshot(folderFilesKey(folder, recursive));
}

// ---------------------------------------------------------------------------
// API pública — mutações
// ---------------------------------------------------------------------------

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

/** Offset onde o corpo começa (logo após `--- ... ---\n`). 0 = sem frontmatter. */
function bodyOffset(data: string): number {
	if (!data.startsWith("---")) return 0;
	const close = data.indexOf("\n---", 3);
	if (close === -1) return 0;
	const after = close + 4;
	return data[after] === "\n" ? after + 1 : after;
}

/**
 * Substitui o corpo do arquivo (tudo após o frontmatter) de forma atômica.
 * O frontmatter existente é preservado; se o arquivo não tiver frontmatter o
 * conteúdo inteiro é substituído.
 */
export async function updateBody(
	app: App,
	path: string,
	body: string,
): Promise<void> {
	const file = app.vault.getAbstractFileByPath(path) as TFile | null;
	if (!file) return;
	await app.vault.process(file, (data) => {
		const offset = bodyOffset(data);
		return offset === 0 ? body : data.slice(0, offset) + body;
	});
}

export async function ensureFolder(app: App, folder: string): Promise<void> {
	if (folder !== "/" && !app.vault.getFolderByPath(folder)) {
		await app.vault.createFolder(folder);
	}
}

export async function trashPath(app: App, path: string): Promise<void> {
	const target = app.vault.getAbstractFileByPath(path);
	if (target) await app.fileManager.trashFile(target);
}
