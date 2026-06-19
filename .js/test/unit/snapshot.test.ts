import { describe, expect, it } from "vitest";
import { isFolder, stripFrontmatter } from "@/lib/snapshot";

describe("stripFrontmatter", () => {
	it("returns the data unchanged when there is no cache", () => {
		expect(stripFrontmatter("file body")).toBe("file body");
	});

	it("returns the data unchanged when the cache is null", () => {
		expect(stripFrontmatter("file body", null)).toBe("file body");
	});

	it("returns the data unchanged when frontmatterPosition is absent", () => {
		expect(stripFrontmatter("file body", {} as never)).toBe(
			"file body",
		);
	});

	it("strips the frontmatter using the offset and removes the leading \\n", () => {
		const raw = "---\ndone: false\n---\nbody here";
		const cache = { frontmatterPosition: { end: { offset: 19 } } };
		expect(stripFrontmatter(raw, cache as never)).toBe("body here");
	});

	it("strips using offset and removes leading \\r\\n (Windows)", () => {
		const raw = "---\ndone: false\n---\r\nbody here";
		const cache = { frontmatterPosition: { end: { offset: 19 } } };
		expect(stripFrontmatter(raw, cache as never)).toBe("body here");
	});

	it("returns an empty string when the file contains only frontmatter", () => {
		const raw = "---\ndone: false\n---";
		const cache = { frontmatterPosition: { end: { offset: 19 } } };
		expect(stripFrontmatter(raw, cache as never)).toBe("");
	});
});

describe("isFolder", () => {
	it("returns true for objects with a defined children property", () => {
		expect(isFolder({ children: [], path: "folder" } as never)).toBe(true);
	});

	it("returns false for objects without a children property", () => {
		expect(isFolder({ path: "file.md" } as never)).toBe(false);
	});

	it("returns false when children is undefined", () => {
		expect(isFolder({ children: undefined, path: "x" } as never)).toBe(false);
	});
});
