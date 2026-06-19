import { describe, expect, it } from "vitest";
import { containingFolderKeys, parentOf } from "@/lib/path";

describe("parentOf", () => {
	it("returns the parent folder of a path with one slash", () => {
		expect(parentOf("a/b.md")).toBe("a");
	});

	it("returns the parent folder of a path with multiple slashes", () => {
		expect(parentOf("a/b/c.md")).toBe("a/b");
	});

	it("returns '/' for a path with no slash (root)", () => {
		expect(parentOf("index.md")).toBe("/");
	});

	it("returns the parent folder of a path with a slash at the end of a segment", () => {
		expect(parentOf("todos/my-task/index.md")).toBe("todos/my-task");
	});
});

describe("containingFolderKeys", () => {
	it("generates f: and r: keys for ALL ancestor folders, from nearest to root", () => {
		const keys = containingFolderKeys(
			"studied/Constitutional Law/records/2026-06-01-0830.md",
		);
		expect(keys).toContain("f:studied/Constitutional Law/records");
		expect(keys).toContain("r:studied/Constitutional Law/records");
		expect(keys).toContain("f:studied/Constitutional Law");
		expect(keys).toContain("r:studied/Constitutional Law");
		expect(keys).toContain("f:studied");
		expect(keys).toContain("r:studied");
		expect(keys).toContain("f:/");
		expect(keys).toContain("r:/");
	});

	it("orders from the immediate parent to the root", () => {
		const keys = containingFolderKeys("a/b/c.md");
		expect(keys.indexOf("f:a/b")).toBeLessThan(keys.indexOf("f:a"));
		expect(keys.indexOf("f:a")).toBeLessThan(keys.indexOf("f:/"));
	});

	it("a file at the root generates only f:/ and r:/", () => {
		const keys = containingFolderKeys("index.md");
		expect(keys).toEqual(["f:/", "r:/"]);
	});

	it("a file one folder below the root generates two pairs", () => {
		const keys = containingFolderKeys("studied/index.md");
		expect(keys).toEqual(["f:studied", "r:studied", "f:/", "r:/"]);
	});

	it("each key appears exactly once", () => {
		const keys = containingFolderKeys("a/b/c/d.md");
		for (const key of keys) {
			expect(keys.filter((k) => k === key)).toHaveLength(1);
		}
	});
});
