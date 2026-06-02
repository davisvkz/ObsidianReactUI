import { describe, expect, it } from "vitest";
import { containingFolderKeys } from "@/lib/path";

describe("containingFolderKeys — geração de chaves de invalidação", () => {
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

	it("dois arquivos em pastas distintas geram chaves distintas", () => {
		const keysA = containingFolderKeys("estudei/Física/registros/session.md");
		const keysB = containingFolderKeys("estudei/Direito/registros/session.md");
		expect(keysA).toContain("f:estudei/Física/registros");
		expect(keysB).toContain("f:estudei/Direito/registros");
		expect(keysA).not.toContain("f:estudei/Direito/registros");
		expect(keysB).not.toContain("f:estudei/Física/registros");
	});

	it("não duplica chaves mesmo para paths mais rasos", () => {
		const keys = containingFolderKeys("estudei/index.md");
		const uniq = new Set(keys);
		expect(uniq.size).toBe(keys.length);
	});

	it("cada chave aparece exatamente uma vez", () => {
		const keys = containingFolderKeys("a/b/c/d.md");
		for (const key of keys) {
			expect(keys.filter((k) => k === key)).toHaveLength(1);
		}
	});
});
