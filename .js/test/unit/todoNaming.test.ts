import { describe, expect, it } from "vitest";
import { sanitizeFolderName } from "@/examples/todoNaming";

describe("sanitizeFolderName", () => {
	it("returns the name unchanged when it is valid", () => {
		expect(sanitizeFolderName("my task")).toBe("my task");
	});

	it("trims leading and trailing spaces", () => {
		expect(sanitizeFolderName("  shopping  ")).toBe("shopping");
	});

	it("returns 'untitled' for an empty string", () => {
		expect(sanitizeFolderName("")).toBe("untitled");
	});

	it("returns 'untitled' for a string of only spaces", () => {
		expect(sanitizeFolderName("   ")).toBe("untitled");
	});

	it("replaces each invalid character with '-'", () => {
		expect(sanitizeFolderName("a\\b")).toBe("a-b");
		expect(sanitizeFolderName("a/b")).toBe("a-b");
		expect(sanitizeFolderName("a:b")).toBe("a-b");
		expect(sanitizeFolderName("a*b")).toBe("a-b");
		expect(sanitizeFolderName("a?b")).toBe("a-b");
		expect(sanitizeFolderName('a"b')).toBe("a-b");
		expect(sanitizeFolderName("a<b")).toBe("a-b");
		expect(sanitizeFolderName("a>b")).toBe("a-b");
		expect(sanitizeFolderName("a|b")).toBe("a-b");
	});

	it("replaces multiple invalid characters in the same name", () => {
		expect(sanitizeFolderName('folder: "new" / 2024')).toBe(
			"folder- -new- - 2024",
		);
	});

	it("returns 'untitled' when the name is only invalid characters (they become '-', trim does not remove them)", () => {
		// After substitution: "---"; not an empty string, so returns "---"
		expect(sanitizeFolderName("///")).toBe("---");
	});
});
