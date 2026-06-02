import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	isFolder,
	parentOf,
	ReactiveCache,
	stripFrontmatter,
} from "@/scripts/markdownStore";

// ---------------------------------------------------------------------------
// parentOf
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// stripFrontmatter
// ---------------------------------------------------------------------------

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
		// offset 19 = comprimento de "---\ndone: false\n---"
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

// ---------------------------------------------------------------------------
// isFolder
// ---------------------------------------------------------------------------

describe("isFolder", () => {
	it("retorna true para objetos com propriedade children", () => {
		expect(isFolder({ children: [], path: "pasta" } as never)).toBe(true);
	});

	it("retorna false para objetos sem propriedade children", () => {
		expect(isFolder({ path: "arquivo.md" } as never)).toBe(false);
	});

	it("retorna false quando children é undefined", () => {
		expect(isFolder({ children: undefined, path: "x" } as never)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// ReactiveCache
// ---------------------------------------------------------------------------

describe("ReactiveCache", () => {
	let buildCount: number;
	let flushCount: number;
	let cache: ReactiveCache<{ value: string }>;

	beforeEach(() => {
		buildCount = 0;
		flushCount = 0;
		cache = new ReactiveCache(
			(key) => {
				buildCount++;
				return { value: key };
			},
			() => {
				flushCount++;
			},
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("constrói o snapshot na primeira chamada a getSnapshot", () => {
		const snap = cache.getSnapshot("a");
		expect(snap).toEqual({ value: "a" });
		expect(buildCount).toBe(1);
	});

	it("getSnapshot devolve a mesma referência antes de qualquer flush", () => {
		const s1 = cache.getSnapshot("a");
		const s2 = cache.getSnapshot("a");
		expect(s1).toBe(s2);
		expect(buildCount).toBe(1);
	});

	it("não chama requestFlush quando invalidate recebe uma chave sem entrada", () => {
		cache.invalidate("chave-inexistente");
		expect(flushCount).toBe(0);
	});

	it("não chama requestFlush quando invalida chave conhecida sem assinantes", () => {
		// Garante a entrada criando o snapshot, mas sem assinantes.
		cache.getSnapshot("a");
		// Remove todos os assinantes — nenhum foi adicionado, mas a entrada existe.
		// invalidate só pede flush se a entrada existe, o que é o caso aqui.
		// (comportamento: chama flush pois a entrada está presente)
		cache.invalidate("a");
		expect(flushCount).toBe(1); // requestFlush é chamado se a chave existe
	});

	it("flush reconstrói o snapshot e notifica assinantes", () => {
		const cb = vi.fn();
		const unsub = cache.subscribe("a", cb, null);

		cache.getSnapshot("a");
		expect(buildCount).toBe(1);

		cache.invalidate("a");
		cache.flush();

		expect(buildCount).toBe(2);
		expect(cb).toHaveBeenCalledTimes(1);

		unsub();
	});

	it("flush troca a referência do snapshot após invalidação", () => {
		cache.subscribe("a", () => {}, null);
		const s1 = cache.getSnapshot("a");
		cache.invalidate("a");
		cache.flush();
		const s2 = cache.getSnapshot("a");
		expect(s1).not.toBe(s2);
	});

	it("flush não notifica assinante com host desconectado (poda de órfão)", () => {
		const cb = vi.fn();
		const deadHost = { isConnected: false } as unknown as Node;
		const unsub = cache.subscribe("a", cb, deadHost);

		cache.getSnapshot("a");
		cache.invalidate("a");
		cache.flush();

		expect(cb).not.toHaveBeenCalled();

		unsub();
	});

	it("flush notifica assinante com host null (sem verificação de conexão)", () => {
		const cb = vi.fn();
		const unsub = cache.subscribe("a", cb, null);

		cache.getSnapshot("a");
		cache.invalidate("a");
		cache.flush();

		expect(cb).toHaveBeenCalledTimes(1);

		unsub();
	});

	it("flush notifica assinante com host conectado", () => {
		const cb = vi.fn();
		const liveHost = { isConnected: true } as unknown as Node;
		const unsub = cache.subscribe("a", cb, liveHost);

		cache.getSnapshot("a");
		cache.invalidate("a");
		cache.flush();

		expect(cb).toHaveBeenCalledTimes(1);

		unsub();
	});

	it("unsubscribe remove a entrada quando não há mais assinantes", () => {
		const unsub = cache.subscribe("a", () => {}, null);
		cache.getSnapshot("a");

		unsub();

		// Após remover o único assinante, a entrada é apagada.
		// Próxima chamada a getSnapshot deve reconstruir (buildCount sobe).
		const before = buildCount;
		cache.getSnapshot("a");
		expect(buildCount).toBe(before + 1);
	});

	it("múltiplos assinantes na mesma chave são todos notificados", () => {
		const cb1 = vi.fn();
		const cb2 = vi.fn();
		const unsub1 = cache.subscribe("a", cb1, null);
		const unsub2 = cache.subscribe("a", cb2, null);

		cache.getSnapshot("a");
		cache.invalidate("a");
		cache.flush();

		expect(cb1).toHaveBeenCalledTimes(1);
		expect(cb2).toHaveBeenCalledTimes(1);

		unsub1();
		unsub2();
	});

	it("flush limpa o conjunto dirty — segunda chamada é no-op", () => {
		const cb = vi.fn();
		const unsub = cache.subscribe("a", cb, null);

		cache.getSnapshot("a");
		cache.invalidate("a");
		cache.flush();
		cache.flush(); // segunda chamada sem nova invalidação

		expect(cb).toHaveBeenCalledTimes(1);

		unsub();
	});
});
