import type { App } from "obsidian";
import { useCallback, useContext, useSyncExternalStore } from "react";
import { ReactiveCache } from "@/lib/reactiveCache";
import { AppContext, HostContext } from "@/lib/render";
import type { MdSnapshot, Subfolder } from "@/lib/snapshot";
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
	if (!app) throw new Error("hook requires an <AppContext.Provider>.");
	return app;
}

type SubscribeFn = (app: App, key: string, cb: () => void, host: Node | null) => () => void;
type ReadFn<T> = (app: App, key: string) => T;

/**
 * Binds a `key` to a reactive store cache via `useSyncExternalStore`.
 * Stabilises `subscribe` with `useCallback` to avoid re-subscriptions on every render.
 * Uses `HostContext` as a sentinel for orphaned subscribers — when Dataview detaches
 * the container from the shadow DOM, `mount.isConnected === false` and the cache
 * automatically prunes the subscriber.
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
	/** Batch-write to frontmatter: change as many properties as needed inside `fn`. */
	update: (fn: (frontmatter: Record<string, unknown>) => void) => Promise<void>;
	/** Atomically replaces the file body (everything after the frontmatter). */
	updateBody: (body: string) => Promise<void>;
}

/** Reactively reads the frontmatter + body of a `.md` file and exposes batch writes. */
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

/** Reactively lists the subfolders of a folder. */
export function useSubfolders(folder: string): UseSubfolders {
	const { value } = useStoreValue(subscribeSubfolders, getSubfolders, folder);
	return { items: value };
}

export interface UseFolderFiles {
	items: MdSnapshot[];
}

/**
 * Reactively reads all `.md` files in `folder` as `MdSnapshot[]`.
 * `recursive=true` (default) includes subfolders; `false` lists only the immediate level.
 * The array is referentially stable between renders when nothing has changed.
 */
export function useFolderFiles(folder: string, recursive = true): UseFolderFiles {
	const app = useApp();
	const host = useContext(HostContext);

	// Stabilise the subscribe/read fns with the extra parameters (folder + recursive)
	// without leaking the key-encoding detail outside the lib.
	const sub = useCallback(
		(cb: () => void) => subscribeFolderFiles(app, folder, cb, host, recursive),
		[app, folder, host, recursive],
	);
	const value = useSyncExternalStore(sub, () => getFolderFiles(app, folder, recursive));

	return { items: value };
}
