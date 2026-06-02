import type { App } from "obsidian";
import { useCallback, useContext, useRef, useSyncExternalStore } from "react";
import {
	type MdSnapshot,
	type Subfolder,
	getSnapshot,
	getSubfolders,
	subscribe,
	subscribeSubfolders,
	updateFrontmatter,
} from "@/lib/markdownStore";
import { AppContext } from "@/lib/utils";

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

/** Lê (reativamente) o frontmatter + corpo de um `.md` e expõe escrita em lote. */
export function useMarkdownFile(path: string): UseMarkdownFile {
	const { app, value, hostRef } = useStoreValue(subscribe, getSnapshot, path);
	return {
		...value,
		hostRef,
		update: (fn) => updateFrontmatter(app, path, fn),
	};
}

export interface UseSubfolders {
	items: Subfolder[];
	hostRef: React.RefObject<HTMLSpanElement | null>;
}

/** Lista (reativamente) as subpastas de uma pasta. */
export function useSubfolders(folder: string): UseSubfolders {
	const { value, hostRef } = useStoreValue(
		subscribeSubfolders,
		getSubfolders,
		folder,
	);
	return { items: value, hostRef };
}
