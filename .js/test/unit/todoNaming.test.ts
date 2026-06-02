import { describe, expect, it } from "vitest";
import { sanitizeFolderName } from "@/examples/todoNaming";

describe("sanitizeFolderName", () => {
	it("retorna o nome sem modificação quando é válido", () => {
		expect(sanitizeFolderName("minha tarefa")).toBe("minha tarefa");
	});

	it("remove espaços no início e no fim (trim)", () => {
		expect(sanitizeFolderName("  compras  ")).toBe("compras");
	});

	it("retorna 'untitled' para string vazia", () => {
		expect(sanitizeFolderName("")).toBe("untitled");
	});

	it("retorna 'untitled' para string só com espaços", () => {
		expect(sanitizeFolderName("   ")).toBe("untitled");
	});

	it("substitui cada caractere inválido por '-'", () => {
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

	it("substitui múltiplos caracteres inválidos no mesmo nome", () => {
		expect(sanitizeFolderName('pasta: "nova" / 2024')).toBe(
			"pasta- -nova- - 2024",
		);
	});

	it("retorna 'untitled' quando o nome é só caracteres inválidos (viram '-', trim os apaga não)", () => {
		// Após substituição: "---"; não é string vazia, então retorna "---"
		expect(sanitizeFolderName("///")).toBe("---");
	});
});
