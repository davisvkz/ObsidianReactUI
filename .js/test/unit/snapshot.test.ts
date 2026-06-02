import { describe, expect, it } from "vitest";
import { isFolder, stripFrontmatter } from "@/lib/snapshot";

describe("stripFrontmatter", () => {
	it("devolve o dado intacto quando não há cache", () => {
		expect(stripFrontmatter("corpo do arquivo")).toBe("corpo do arquivo");
	});

	it("devolve o dado intacto quando o cache é null", () => {
		expect(stripFrontmatter("corpo do arquivo", null)).toBe("corpo do arquivo");
	});

	it("devolve o dado intacto quando frontmatterPosition está ausente", () => {
		expect(stripFrontmatter("corpo do arquivo", {} as never)).toBe(
			"corpo do arquivo",
		);
	});

	it("corta o frontmatter usando o offset e remove o \\n inicial", () => {
		const raw = "---\ndone: false\n---\ncorpo aqui";
		const cache = { frontmatterPosition: { end: { offset: 19 } } };
		expect(stripFrontmatter(raw, cache as never)).toBe("corpo aqui");
	});

	it("corta usando offset e remove \\r\\n inicial (Windows)", () => {
		const raw = "---\ndone: false\n---\r\ncorpo aqui";
		const cache = { frontmatterPosition: { end: { offset: 19 } } };
		expect(stripFrontmatter(raw, cache as never)).toBe("corpo aqui");
	});

	it("devolve string vazia quando o arquivo só tem frontmatter", () => {
		const raw = "---\ndone: false\n---";
		const cache = { frontmatterPosition: { end: { offset: 19 } } };
		expect(stripFrontmatter(raw, cache as never)).toBe("");
	});
});

describe("isFolder", () => {
	it("retorna true para objetos com propriedade children definida", () => {
		expect(isFolder({ children: [], path: "pasta" } as never)).toBe(true);
	});

	it("retorna false para objetos sem propriedade children", () => {
		expect(isFolder({ path: "arquivo.md" } as never)).toBe(false);
	});

	it("retorna false quando children é undefined", () => {
		expect(isFolder({ children: undefined, path: "x" } as never)).toBe(false);
	});
});
