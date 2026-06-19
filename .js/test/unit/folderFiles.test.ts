import { describe, expect, it } from "vitest";
import { containingFolderKeys } from "@/lib/path";

describe("containingFolderKeys — invalidation key generation", () => {
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

	it("files in different folders generate distinct keys", () => {
		const keysA = containingFolderKeys("studied/Physics/records/session.md");
		const keysB = containingFolderKeys("studied/Law/records/session.md");
		expect(keysA).toContain("f:studied/Physics/records");
		expect(keysB).toContain("f:studied/Law/records");
		expect(keysA).not.toContain("f:studied/Law/records");
		expect(keysB).not.toContain("f:studied/Physics/records");
	});

	it("does not duplicate keys even for shallower paths", () => {
		const keys = containingFolderKeys("studied/index.md");
		const uniq = new Set(keys);
		expect(uniq.size).toBe(keys.length);
	});

	it("each key appears exactly once", () => {
		const keys = containingFolderKeys("a/b/c/d.md");
		for (const key of keys) {
			expect(keys.filter((k) => k === key)).toHaveLength(1);
		}
	});
});
