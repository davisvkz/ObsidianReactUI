import type { App, EventRef, TAbstractFile, TFile, TFolder } from "obsidian";

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
	/** Corpo cru do arquivo, sem o bloco de frontmatter. */
	body: string;
	exists: boolean;
	file: TFile | null;
	frontmatter: Record<string, unknown>;
}

/** Uma subpasta de uma pasta (path absoluto + nome do diretório). */
export interface Subfolder {
	name: string;
	path: string;
}

// ---------------------------------------------------------------------------
// Construção de snapshots (funções puras: App + chave → dado imutável)
// ---------------------------------------------------------------------------

/** Pasta-pai de um path (`"a/b.md"` → `"a"`, raiz → `"/"`). */
export function parentOf(path: string): string {
	const i = path.lastIndexOf("/");
	return i === -1 ? "/" : path.slice(0, i);
}

/** Remove o bloco `--- ... ---` do início, devolvendo só o corpo. */
export function stripFrontmatter(
	data: string,
	cache?: import("obsidian").CachedMetadata | null,
): string {
	const end = cache?.frontmatterPosition?.end.offset;
	if (typeof end !== "number") return data;
	return data.slice(end).replace(/^\r?\n/, "");
}

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

/** Type guard sem `instanceof` (módulo `obsidian` não é bundlável no eval). */
export function isFolder(f: TAbstractFile): f is TFolder {
	return (f as TFolder).children !== undefined;
}

/** Lista TODAS as subpastas de `folder` (sem nenhuma convenção de conteúdo). */
function buildSubfolders(app: App, folder: string): Subfolder[] {
	const dir = app.vault.getFolderByPath(folder);
	if (!dir) return [];
	return dir.children
		.filter(isFolder)
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((c) => ({ name: c.name, path: c.path }));
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
 * invalidado, coalescido pelo `requestFlush` compartilhado do store. Cada coleção
 * reativa (snapshots de arquivo, listagens de subpastas) é uma instância desta.
 */
export class ReactiveCache<T> {
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
// Store singleton: as caches + os listeners globais do vault
// ---------------------------------------------------------------------------

interface Store {
	files: ReactiveCache<MdSnapshot>;
	refs: EventRef[];
	subfolders: ReactiveCache<Subfolder[]>;
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

	// Coalescência: uma rajada de eventos vira UM flush (logo, UM render por entrada).
	flush = debounce(() => {
		files.flush();
		subfolders.flush();
	}, 24);

	// Regra puramente de filesystem: criar/remover/renomear um path muda o snapshot
	// daquele path E a listagem de subpastas da sua pasta-pai. `parentOf(path)` é
	// robusto a `file.parent` já destacado em deletes.
	const onStructuralChange = (path: string) => {
		files.invalidate(path);
		subfolders.invalidate(parentOf(path));
	};

	const store: Store = { files, refs: [], subfolders };

	// Listeners GLOBAIS únicos para o vault inteiro.
	store.refs.push(
		// Edição de conteúdo: só afeta o snapshot do próprio arquivo.
		app.metadataCache.on("changed", (file, data) => {
			lastData.set(file.path, data);
			files.invalidate(file.path);
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

/** Inscreve `cb` nas mudanças das subpastas de `folder` (criação/remoção/rename). */
export function subscribeSubfolders(
	app: App,
	folder: string,
	cb: () => void,
	host: Node | null,
): () => void {
	return getStore(app).subfolders.subscribe(folder, cb, host);
}

/** Snapshot referencialmente estável de um arquivo. */
export function getSnapshot(app: App, path: string): MdSnapshot {
	return getStore(app).files.getSnapshot(path);
}

/** Snapshot referencialmente estável das subpastas de uma pasta. */
export function getSubfolders(app: App, folder: string): Subfolder[] {
	return getStore(app).subfolders.getSnapshot(folder);
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

/** Move um arquivo OU pasta para a lixeira (cascata, no caso de pasta). */
export async function trashPath(app: App, path: string): Promise<void> {
	const target = app.vault.getAbstractFileByPath(path);
	if (target) await app.fileManager.trashFile(target);
}
