/**
 * Testes do barrel @/lib — verificam que todos os símbolos públicos
 * são re-exportados corretamente pelos módulos internos.
 */
import { describe, expect, it } from "vitest";
import {
	containingFolderKeys,
	folderFilesKey,
	isFolder,
	parentOf,
	ReactiveCache,
	stripFrontmatter,
} from "@/lib";

describe("lib barrel — re-exports", () => {
	it("exporta parentOf", () => {
		expect(parentOf("a/b.md")).toBe("a");
	});

	it("exporta containingFolderKeys", () => {
		const keys = containingFolderKeys("a/b.md");
		expect(keys).toContain("f:a");
		expect(keys).toContain("r:/");
	});

	it("exporta folderFilesKey", () => {
		expect(folderFilesKey("estudei", true)).toBe("r:estudei");
		expect(folderFilesKey("estudei", false)).toBe("f:estudei");
	});

	it("exporta stripFrontmatter", () => {
		expect(stripFrontmatter("corpo")).toBe("corpo");
	});

	it("exporta isFolder", () => {
		expect(isFolder({ children: [], path: "p" } as never)).toBe(true);
		expect(isFolder({ path: "f.md" } as never)).toBe(false);
	});

	it("exporta ReactiveCache", () => {
		const cache = new ReactiveCache(
			(k) => k,
			() => {},
		);
		expect(cache.getSnapshot("x")).toBe("x");
	});
});
