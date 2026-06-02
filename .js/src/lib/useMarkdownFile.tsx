import type { App } from "obsidian";
import { useCallback, useContext, useRef, useSyncExternalStore } from "react";
import { folderFilesKey } from "@/lib/path";
import { ReactiveCache } from "@/lib/reactiveCache";
import { type MdSnapshot, type Subfolder } from "@/lib/snapshot";
import {
	getFolderFiles,
	getSnapshot,
	getSubfolders,
	subscribe,
	subscribeFolderFiles,
	subscribeSubfolders,
	updateBody,
	updateFrontmatter,
} from "@/lib/store";
import { AppContext } from "@/lib/utils";

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
 * Liga uma `key` a uma cache reativa do store via `useSyncExternalStore`. Estabiliza
 * `subscribe` com `useCallback` (senão o React re-inscreve a cada render → loop) e
 * expõe um `hostRef` para a cache podar assinantes órfãos. Base dos hooks abaixo.
 */
function useStoreValue<T>(
	subscribeFn: SubscribeFn,
	read: ReadFn<T>,
	key: string,
): { app: App; value: T; hostRef: React.RefObject<HTMLSpanElement | null> } {
	const app = useApp();
	const hostRef = useRef<HTMLSpanElement>(null);

	const sub = useCallback(
		(cb: () => void) => subscribeFn(app, key, cb, hostRef.current),
		[app, subscribeFn, key],
	);
	const value = useSyncExternalStore(sub, () => read(app, key));

	return { app, hostRef, value };
}

export interface UseMarkdownFile extends MdSnapshot {
	/** Ancore num elemento renderizado para permitir poda de assinantes órfãos. */
	hostRef: React.RefObject<HTMLSpanElement | null>;
	/** Escrita em lote no frontmatter: altere quantas propriedades quiser dentro de `fn`. */
	update: (fn: (frontmatter: Record<string, unknown>) => void) => Promise<void>;
	/** Substitui o corpo do arquivo (tudo após o frontmatter) atomicamente. */
	updateBody: (body: string) => Promise<void>;
}

/** Lê (reativamente) o frontmatter + corpo de um `.md` e expõe escrita em lote. */
export function useMarkdownFile(path: string): UseMarkdownFile {
	const { app, value, hostRef } = useStoreValue(subscribe, getSnapshot, path);
	return {
		...value,
		hostRef,
		update: (fn) => updateFrontmatter(app, path, fn),
		updateBody: (body) => updateBody(app, path, body),
	};
}

export interface UseSubfolders {
	hostRef: React.RefObject<HTMLSpanElement | null>;
	items: Subfolder[];
}

/** Lista (reativamente) as subpastas de uma pasta. */
export function useSubfolders(folder: string): UseSubfolders {
	const { value, hostRef } = useStoreValue(
		subscribeSubfolders,
		getSubfolders,
		folder,
	);
	return { hostRef, items: value };
}

export interface UseFolderFiles {
	hostRef: React.RefObject<HTMLSpanElement | null>;
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
	const key = folderFilesKey(folder, recursive);

	const subscribeFn = useCallback(
		(app: App, _key: string, cb: () => void, host: Node | null) =>
			subscribeFolderFiles(app, folder, recursive, cb, host),
		[folder, recursive],
	);
	const readFn = useCallback(
		(app: App, _key: string) => getFolderFiles(app, folder, recursive),
		[folder, recursive],
	);

	const { value, hostRef } = useStoreValue(subscribeFn, readFn, key);
	return { hostRef, items: value };
}
