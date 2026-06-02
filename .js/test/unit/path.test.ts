import { describe, expect, it } from "vitest";
import { containingFolderKeys, parentOf } from "@/lib/path";

describe("parentOf", () => {
	it("retorna a pasta-pai de um path com uma barra", () => {
		expect(parentOf("a/b.md")).toBe("a");
	});

	it("retorna a pasta-pai de um path com várias barras", () => {
		expect(parentOf("a/b/c.md")).toBe("a/b");
	});

	it("retorna '/' para um path sem barra (raiz)", () => {
		expect(parentOf("index.md")).toBe("/");
	});

	it("retorna a pasta-pai de um path com barra no final do segmento", () => {
		expect(parentOf("todos/minha-tarefa/index.md")).toBe("todos/minha-tarefa");
	});
});

describe("containingFolderKeys", () => {
	it("gera chaves f: e r: de TODAS as pastas ancestrais, da mais próxima à raiz", () => {
		const keys = containingFolderKeys(
			"estudei/Direito Constitucional/registros/2026-06-01-0830.md",
		);
		expect(keys).toContain("f:estudei/Direito Constitucional/registros");
		expect(keys).toContain("r:estudei/Direito Constitucional/registros");
		expect(keys).toContain("f:estudei/Direito Constitucional");
		expect(keys).toContain("r:estudei/Direito Constitucional");
		expect(keys).toContain("f:estudei");
		expect(keys).toContain("r:estudei");
		expect(keys).toContain("f:/");
		expect(keys).toContain("r:/");
	});

	it("ordena do pai imediato para a raiz", () => {
		const keys = containingFolderKeys("a/b/c.md");
		expect(keys.indexOf("f:a/b")).toBeLessThan(keys.indexOf("f:a"));
		expect(keys.indexOf("f:a")).toBeLessThan(keys.indexOf("f:/"));
	});

	it("arquivo na raiz gera somente f:/ e r:/", () => {
		const keys = containingFolderKeys("index.md");
		expect(keys).toEqual(["f:/", "r:/"]);
	});

	it("arquivo uma pasta abaixo da raiz gera dois pares", () => {
		const keys = containingFolderKeys("estudei/index.md");
		expect(keys).toEqual(["f:estudei", "r:estudei", "f:/", "r:/"]);
	});

	it("cada chave aparece exatamente uma vez", () => {
		const keys = containingFolderKeys("a/b/c/d.md");
		for (const key of keys) {
			expect(keys.filter((k) => k === key)).toHaveLength(1);
		}
	});
});
