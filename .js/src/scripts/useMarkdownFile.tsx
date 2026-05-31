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
import type { App } from "obsidian";

export function useApp(): App {
	const app = useContext(AppContext);
	if (!app) throw new Error("hook precisa de um <AppContext.Provider>.");
	return app;
}

export interface UseMarkdownFile extends MdSnapshot {
	/** Ancore num elemento renderizado para permitir poda de assinantes órfãos. */
	hostRef: React.RefObject<HTMLSpanElement | null>;
	/** Escrita em lote: altere quantas propriedades quiser dentro de `fn`. */
	update: (fn: (frontmatter: Record<string, unknown>) => void) => Promise<void>;
}

export function useMarkdownFile(path: string): UseMarkdownFile {
	const app = useApp();
	const hostRef = useRef<HTMLSpanElement>(null);

	// `subscribe` precisa ter identidade estável, senão o React re-inscreve a cada
	// render e o store recria o snapshot → loop infinito de updates.
	const sub = useCallback(
		(cb: () => void) => subscribe(app, path, cb, hostRef.current),
		[app, path],
	);
	const snapshot = useSyncExternalStore(sub, () => getSnapshot(app, path));

	return {
		...snapshot,
		hostRef,
		update: (fn) => updateFrontmatter(app, path, fn),
	};
}

export interface UseMarkdownFolder {
	items: MdItem[];
	hostRef: React.RefObject<HTMLSpanElement | null>;
}

export function useMarkdownFolder(folder: string): UseMarkdownFolder {
	const app = useApp();
	const hostRef = useRef<HTMLSpanElement>(null);

	const sub = useCallback(
		(cb: () => void) => subscribeFolder(app, folder, cb, hostRef.current),
		[app, folder],
	);
	const items = useSyncExternalStore(sub, () => getFolderSnapshot(app, folder));

	return { items, hostRef };
}

export interface UseChildFolders {
	items: FolderNode[];
	hostRef: React.RefObject<HTMLSpanElement | null>;
}

export function useChildFolders(folder: string): UseChildFolders {
	const app = useApp();
	const hostRef = useRef<HTMLSpanElement>(null);

	const sub = useCallback(
		(cb: () => void) => subscribeChildFolders(app, folder, cb, hostRef.current),
		[app, folder],
	);
	const items = useSyncExternalStore(sub, () => getChildFolders(app, folder));

	return { items, hostRef };
}
