import type { TAbstractFile, TFile, TFolder } from "obsidian";

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

/** Remove o bloco `--- ... ---` do início, devolvendo só o corpo. */
export function stripFrontmatter(
	data: string,
	cache?: import("obsidian").CachedMetadata | null,
): string {
	const end = cache?.frontmatterPosition?.end.offset;
	if (typeof end !== "number") return data;
	return data.slice(end).replace(/^\r?\n/, "");
}

/** Type guard sem `instanceof` (módulo `obsidian` não é bundlável no eval). */
export function isFolder(f: TAbstractFile): f is TFolder {
	return (f as TFolder).children !== undefined;
}
