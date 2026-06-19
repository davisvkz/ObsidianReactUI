import type { TAbstractFile, TFile, TFolder } from "obsidian";

export interface MdSnapshot {
	/** Raw file body, without the frontmatter block. */
	body: string;
	exists: boolean;
	file: TFile | null;
	frontmatter: Record<string, unknown>;
}

/** A subfolder of a folder (absolute path + directory name). */
export interface Subfolder {
	name: string;
	path: string;
}

/** Removes the leading `--- ... ---` block, returning only the body. */
export function stripFrontmatter(
	data: string,
	cache?: import("obsidian").CachedMetadata | null,
): string {
	const end = cache?.frontmatterPosition?.end.offset;
	if (typeof end !== "number") return data;
	return data.slice(end).replace(/^\r?\n/, "");
}

/** Type guard without `instanceof` (the `obsidian` module is not bundlable in eval). */
export function isFolder(f: TAbstractFile): f is TFolder {
	return (f as TFolder).children !== undefined;
}
