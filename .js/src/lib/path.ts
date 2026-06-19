/** Parent folder of a path (`"a/b.md"` → `"a"`, root → `"/"`). */
export function parentOf(path: string): string {
	const i = path.lastIndexOf("/");
	return i === -1 ? "/" : path.slice(0, i);
}

/**
 * Generates the `folderFiles` cache key prefixes that must be invalidated when
 * a file at `path` changes. Walks up from `parentOf(path)` to `"/"`, emitting
 * `"f:<dir>"` (flat) and `"r:<dir>"` (recursive) for each ancestor.
 */
export function containingFolderKeys(path: string): string[] {
	const keys: string[] = [];
	let dir = parentOf(path);
	for (;;) {
		keys.push(`f:${dir}`, `r:${dir}`);
		if (dir === "/") break;
		dir = parentOf(dir);
	}
	return keys;
}

/** Internal key used by the `folderFiles` cache. */
export function folderFilesKey(folder: string, recursive: boolean): string {
	return (recursive ? "r:" : "f:") + folder;
}
