import type { App } from "obsidian";
import { useCallback, useContext } from "react";
import { useSyncExternalStore } from "react";
import { ReactiveCache } from "@/lib/reactiveCache";
import { HostContext } from "@/lib/render";
import { AppContext } from "@/lib/render";
import { type MdSnapshot, type Subfolder } from "@/lib/snapshot";
import {
	getFolderFiles,
	getSnapshot,
	getSubfolders,
	subscribeFile,
	subscribeFolderFiles,
	subscribeSubfolders,
	updateBody,
	updateFrontmatter,
} from "@/lib/store";

export { ReactiveCache };

export function useApp(): App {
	const app = useContext(AppContext);
	if (!app) throw new Error("hook precisa de um <AppContext.Provider>.");
	return app;
}

type SubscribeFn = (
	app: App,
	key: string,
	cb: () => void,
	host: Node | null,
) => () => void;
type ReadFn<T> = (app: App, key: string) => T;

/**
 * Liga uma `key` a uma cache reativa do store via `useSyncExternalStore`.
 * Estabiliza `subscribe` com `useCallback` para evitar re-inscrições a cada render.
 * Usa `HostContext` como sentinela de assinante órfão — quando o Dataview arranca
 * o container do shadow DOM o `mount` fica `isConnected === false` e a cache poda
 * automaticamente o assinante.
 */
function useStoreValue<T>(
	subscribeFn: SubscribeFn,
	read: ReadFn<T>,
	key: string,
): { app: App; value: T } {
	const app = useApp();
	const host = useContext(HostContext);

	const sub = useCallback(
		(cb: () => void) => subscribeFn(app, key, cb, host),
		[app, subscribeFn, key, host],
	);
	const value = useSyncExternalStore(sub, () => read(app, key));

	return { app, value };
}

export interface UseMarkdownFile extends MdSnapshot {
	/** Escrita em lote no frontmatter: altere quantas propriedades quiser dentro de `fn`. */
	update: (fn: (frontmatter: Record<string, unknown>) => void) => Promise<void>;
	/** Substitui o corpo do arquivo (tudo após o frontmatter) atomicamente. */
	updateBody: (body: string) => Promise<void>;
}

/** Lê (reativamente) o frontmatter + corpo de um `.md` e expõe escrita em lote. */
export function useMarkdownFile(path: string): UseMarkdownFile {
	const { app, value } = useStoreValue(subscribeFile, getSnapshot, path);
	return {
		...value,
		update: (fn) => updateFrontmatter(app, path, fn),
		updateBody: (body) => updateBody(app, path, body),
	};
}

export interface UseSubfolders {
	items: Subfolder[];
}

/** Lista (reativamente) as subpastas de uma pasta. */
export function useSubfolders(folder: string): UseSubfolders {
	const { value } = useStoreValue(subscribeSubfolders, getSubfolders, folder);
	return { items: value };
}

export interface UseFolderFiles {
	items: MdSnapshot[];
}

/**
 * Lê (reativamente) todos os `.md` de `folder` como `MdSnapshot[]`.
 * `recursive=true` (padrão) inclui subpastas; `false` lista só o nível direto.
 * O array é referencialmente estável entre renders sem mudança.
 */
export function useFolderFiles(
	folder: string,
	recursive = true,
): UseFolderFiles {
	const app = useApp();
	const host = useContext(HostContext);

	// Estabiliza as fns de subscribe/read com os parâmetros extras (folder + recursive)
	// sem expor o encoding de chave para fora da lib.
	const sub = useCallback(
		(cb: () => void) => subscribeFolderFiles(app, folder, cb, host, recursive),
		[app, folder, host, recursive],
	);
	const value = useSyncExternalStore(sub, () =>
		getFolderFiles(app, folder, recursive),
	);

	return { items: value };
}
