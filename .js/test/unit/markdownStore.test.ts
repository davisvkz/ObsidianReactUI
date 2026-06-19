/**
 * Tests for the @/lib barrel — verifies that all public symbols
 * are correctly re-exported by the internal modules.
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
	it("exports parentOf", () => {
		expect(parentOf("a/b.md")).toBe("a");
	});

	it("exports containingFolderKeys", () => {
		const keys = containingFolderKeys("a/b.md");
		expect(keys).toContain("f:a");
		expect(keys).toContain("r:/");
	});

	it("exports folderFilesKey", () => {
		expect(folderFilesKey("studied", true)).toBe("r:studied");
		expect(folderFilesKey("studied", false)).toBe("f:studied");
	});

	it("exports stripFrontmatter", () => {
		expect(stripFrontmatter("body")).toBe("body");
	});

	it("exports isFolder", () => {
		expect(isFolder({ children: [], path: "p" } as never)).toBe(true);
		expect(isFolder({ path: "f.md" } as never)).toBe(false);
	});

	it("exports ReactiveCache", () => {
		const cache = new ReactiveCache(
			(k) => k,
			() => {},
		);
		expect(cache.getSnapshot("x")).toBe("x");
	});
});
