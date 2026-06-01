import type { App } from "obsidian";
import { useCallback, useContext, useRef, useSyncExternalStore } from "react";
import {
	type FolderNode,
	type MdItem,
	type MdSnapshot,
	getChildFolders,
	getFolderSnapshot,
	getSnapshot,
	subscribe,
	subscribeChildFolders,
	subscribeFolder,
	updateFrontmatter,
} from "@/scripts/markdownStore";
import { AppContext } from "@/scripts/utils";

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

	return { app, value, hostRef };
}

export interface UseMarkdownFile extends MdSnapshot {
	/** Ancore num elemento renderizado para permitir poda de assinantes órfãos. */
	hostRef: React.RefObject<HTMLSpanElement | null>;
	/** Escrita em lote: altere quantas propriedades quiser dentro de `fn`. */
	update: (fn: (frontmatter: Record<string, unknown>) => void) => Promise<void>;
}

export function useMarkdownFile(path: string): UseMarkdownFile {
	const { app, value, hostRef } = useStoreValue(subscribe, getSnapshot, path);
	return {
		...value,
		hostRef,
		update: (fn) => updateFrontmatter(app, path, fn),
	};
}

export interface UseMarkdownFolder {
	items: MdItem[];
	hostRef: React.RefObject<HTMLSpanElement | null>;
}

export function useMarkdownFolder(folder: string): UseMarkdownFolder {
	const { value, hostRef } = useStoreValue(
		subscribeFolder,
		getFolderSnapshot,
		folder,
	);
	return { items: value, hostRef };
}

export interface UseChildFolders {
	items: FolderNode[];
	hostRef: React.RefObject<HTMLSpanElement | null>;
}

export function useChildFolders(folder: string): UseChildFolders {
	const { value, hostRef } = useStoreValue(
		subscribeChildFolders,
		getChildFolders,
		folder,
	);
	return { items: value, hostRef };
}
