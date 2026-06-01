import type {
	App,
	CachedMetadata,
	EventRef,
	TAbstractFile,
	TFile,
	TFolder,
} from "obsidian";

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

/** Subpasta de uma pasta (um nó filho na árvore de to-dos). */
export interface FolderNode {
	folder: string;
	name: string;
}

// ---------------------------------------------------------------------------
// Construção de snapshots (funções puras: App + chave → dado imutável)
// ---------------------------------------------------------------------------

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

/** Type guard sem `instanceof` (módulo `obsidian` não é bundlável no eval). */
function isFolder(f: TAbstractFile): f is TFolder {
	return (f as TFolder).children !== undefined;
}

function buildChildFolders(app: App, folder: string): FolderNode[] {
	const dir = app.vault.getFolderByPath(folder);
	if (!dir) return [];
	return dir.children
		.filter(isFolder)
		// Um to-do É a sua pasta + `index.md`. Subpasta sem `index.md` não é um to-do
		// (assim deletar a nota faz o nó sumir, em vez de virar fantasma).
		.filter((c) => app.vault.getAbstractFileByPath(`${c.path}/index.md`) != null)
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((c) => ({ folder: c.path, name: c.name }));
}

// ---------------------------------------------------------------------------
// ReactiveCache: uma coleção reativa, chaveada por string, para useSyncExternalStore
// ---------------------------------------------------------------------------

interface Subscriber {
	cb: () => void;
	host: Node | null;
}

interface CacheEntry<T> {
	snapshot: T;
	subscribers: Set<Subscriber>;
}

/**
 * Mantém, por chave, um snapshot referencialmente estável (só troca quando
 * invalidado) e os assinantes daquela chave. Reconstrói via `build` apenas o que foi
 * invalidado, coalescido pelo `requestFlush` compartilhado do store. Cada uma das
 * coleções reativas (arquivos, listagens de `.md`, subpastas) é uma instância desta.
 */
class ReactiveCache<T> {
	private readonly entries = new Map<string, CacheEntry<T>>();
	private readonly dirty = new Set<string>();

	constructor(
		private readonly build: (key: string) => T,
		private readonly requestFlush: () => void,
	) {}

	private ensure(key: string): CacheEntry<T> {
		const existing = this.entries.get(key);
		if (existing) return existing;
		const created: CacheEntry<T> = {
			snapshot: this.build(key),
			subscribers: new Set(),
		};
		this.entries.set(key, created);
		return created;
	}

	getSnapshot(key: string): T {
		return this.ensure(key).snapshot;
	}

	subscribe(key: string, cb: () => void, host: Node | null): () => void {
		const entry = this.ensure(key);
		const subscriber: Subscriber = { cb, host };
		entry.subscribers.add(subscriber);
		return () => {
			entry.subscribers.delete(subscriber);
			if (entry.subscribers.size === 0) this.entries.delete(key);
		};
	}

	/** Marca `key` para reconstrução no próximo flush (no-op se ninguém observa). */
	invalidate(key: string): void {
		if (!this.entries.has(key)) return;
		this.dirty.add(key);
		this.requestFlush();
	}

	flush(): void {
		for (const key of this.dirty) {
			const entry = this.entries.get(key);
			if (!entry) continue;
			entry.snapshot = this.build(key);
			this.notify(entry.subscribers);
		}
		this.dirty.clear();
	}

	private notify(subscribers: Set<Subscriber>): void {
		// Poda assinantes mortos (React removido sem desmontar → cleanup não rodou).
		for (const s of subscribers)
			if (s.host && !s.host.isConnected) subscribers.delete(s);
		for (const s of subscribers) s.cb();
	}
}

// ---------------------------------------------------------------------------
// Store singleton: as três caches + os listeners globais do vault
// ---------------------------------------------------------------------------

interface Store {
	files: ReactiveCache<MdSnapshot>;
	folders: ReactiveCache<MdItem[]>;
	childFolders: ReactiveCache<FolderNode[]>;
	refs: EventRef[];
}

const KEY = "__mdStore__";

/**
 * Devolve o store singleton vivo em `window`. Sobrevive aos `eval(bundle.js)` que
 * o Dataview faz a cada render — por isso os listeners globais são registrados UMA vez.
 */
function getStore(app: App): Store {
	const w = window as unknown as Record<string, Store | undefined>;
	const existing = w[KEY];
	if (existing) return existing;

	// Último conteúdo cru visto por arquivo, para reconstruir o corpo no snapshot.
	const lastData = new Map<string, string>();

	let flush: () => void = () => {};
	const requestFlush = () => flush();

	const files = new ReactiveCache<MdSnapshot>(
		(path) =>
			buildSnapshot(app, path, lastData.get(path), app.metadataCache.getCache(path)),
		requestFlush,
	);
	const folders = new ReactiveCache<MdItem[]>(
		(folder) => buildFolderSnapshot(app, folder),
		requestFlush,
	);
	const childFolders = new ReactiveCache<FolderNode[]>(
		(folder) => buildChildFolders(app, folder),
		requestFlush,
	);

	// Coalescência: uma rajada de eventos vira UM flush (logo, UM render por entrada).
	flush = debounce(() => {
		files.flush();
		folders.flush();
		childFolders.flush();
	}, 24);

	// Criar/remover um `index.md` muda se a pasta que o contém É um to-do, então a
	// listagem do AVÔ (pasta-pai dessa pasta) precisa ser reconstruída.
	const isIndex = (p: string) => p.split("/").pop() === "index.md";
	const onStructuralChange = (filePath: string) => {
		// `parentOf(filePath)` é robusto a `file.parent` já destacado em deletes.
		const parent = parentOf(filePath);
		folders.invalidate(parent);
		childFolders.invalidate(parent);
		if (isIndex(filePath)) childFolders.invalidate(parentOf(parent));
	};

	const store: Store = { files, folders, childFolders, refs: [] };

	// Listeners GLOBAIS únicos para o vault inteiro.
	store.refs.push(
		// Editar `index.md` (toggle de `done`) só afeta o arquivo e a listagem `.md` do pai.
		app.metadataCache.on("changed", (file, data) => {
			lastData.set(file.path, data);
			files.invalidate(file.path);
			folders.invalidate(parentOf(file.path));
		}),
		app.vault.on("create", (file) => onStructuralChange(file.path)),
		app.vault.on("delete", (file) => {
			lastData.delete(file.path);
			onStructuralChange(file.path);
		}),
		app.vault.on("rename", (file, oldPath) => {
			onStructuralChange(file.path);
			onStructuralChange(oldPath);
		}),
	);

	w[KEY] = store;
	return store;
}

// ---------------------------------------------------------------------------
// API pública: wrappers finos sobre as caches do store
// ---------------------------------------------------------------------------

/** Inscreve `cb` nas mudanças de um arquivo. `host` permite podar assinantes órfãos. */
export function subscribe(
	app: App,
	path: string,
	cb: () => void,
	host: Node | null,
): () => void {
	return getStore(app).files.subscribe(path, cb, host);
}

/** Inscreve `cb` nas mudanças da listagem de `.md` de uma pasta. */
export function subscribeFolder(
	app: App,
	folder: string,
	cb: () => void,
	host: Node | null,
): () => void {
	return getStore(app).folders.subscribe(folder, cb, host);
}

/** Inscreve `cb` nas mudanças das subpastas de `folder` (criação/remoção/rename). */
export function subscribeChildFolders(
	app: App,
	folder: string,
	cb: () => void,
	host: Node | null,
): () => void {
	return getStore(app).childFolders.subscribe(folder, cb, host);
}

/** Snapshot referencialmente estável de um arquivo. */
export function getSnapshot(app: App, path: string): MdSnapshot {
	return getStore(app).files.getSnapshot(path);
}

/** Snapshot referencialmente estável da listagem de `.md` de uma pasta. */
export function getFolderSnapshot(app: App, folder: string): MdItem[] {
	return getStore(app).folders.getSnapshot(folder);
}

/** Snapshot referencialmente estável das subpastas de uma pasta. */
export function getChildFolders(app: App, folder: string): FolderNode[] {
	return getStore(app).childFolders.getSnapshot(folder);
}

// ---------------------------------------------------------------------------
// Mutações (escrita no vault via API do Obsidian)
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

/**
 * Cria um to-do no modelo pasta-por-to-do: uma subpasta de `parent` com `index.md`
 * contendo `done: false`. Evita colisão de nome. Devolve o path da pasta criada.
 */
export async function createTodoFolder(
	app: App,
	parent: string,
	name: string,
): Promise<string> {
	await ensureFolder(app, parent);
	const safe = name.trim().replace(/[\\/:*?"<>|]/g, "-") || "untitled";
	let folder = `${parent}/${safe}`;
	let n = 1;
	while (app.vault.getAbstractFileByPath(folder)) {
		folder = `${parent}/${safe} ${++n}`;
	}
	await app.vault.createFolder(folder);
	await app.vault.create(`${folder}/index.md`, "---\ndone: false\n---\n");
	return folder;
}

/** Move uma pasta inteira para a lixeira (exclusão em cascata: index.md + subárvore). */
export async function deleteFolder(app: App, folder: string): Promise<void> {
	const dir = app.vault.getFolderByPath(folder);
	if (dir) await app.fileManager.trashFile(dir);
}
