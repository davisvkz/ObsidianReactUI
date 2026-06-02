/** Pasta-pai de um path (`"a/b.md"` → `"a"`, raiz → `"/"`). */
export function parentOf(path: string): string {
	const i = path.lastIndexOf("/");
	return i === -1 ? "/" : path.slice(0, i);
}

/**
 * Gera os prefixos de chave do `folderFiles` que devem ser invalidados quando
 * um arquivo em `path` muda. Sobe de `parentOf(path)` até `"/"`, emitindo
 * `"f:<dir>"` (flat) e `"r:<dir>"` (recursivo) para cada ancestral.
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

/** Chave interna usada pelo cache `folderFiles`. */
export function folderFilesKey(folder: string, recursive: boolean): string {
	return (recursive ? "r:" : "f:") + folder;
}
