import { describe, expect, it } from "vitest";
import {
	parseMetas,
	parseSession,
	parseTopicos,
} from "@/examples/estudei/parse";

// ---------------------------------------------------------------------------
// parseSession
// ---------------------------------------------------------------------------

describe("parseSession", () => {
	const baseFm = {
		tipo: "registro",
		data: "2026-06-01",
		inicio: "08:30",
		categoria: "TEORIA",
		duracaoMin: 45,
		acertos: 15,
		erros: 3,
		topicoId: "1.1",
		material: "Aula 5",
		paginasLidas: 10,
		videos: 1,
		comentario: "bom",
		geraRevisao: true,
	};

	it("retorna Session preenchida quando tipo=registro", () => {
		const s = parseSession(baseFm, "estudei/Disc/registros/s.md");
		expect(s).not.toBeNull();
		expect(s?.data).toBe("2026-06-01");
		expect(s?.categoria).toBe("TEORIA");
		expect(s?.duracaoMin).toBe(45);
		expect(s?.acertos).toBe(15);
		expect(s?.erros).toBe(3);
		expect(s?.topicoId).toBe("1.1");
		expect(s?.geraRevisao).toBe(true);
	});

	it("retorna null quando tipo ≠ 'registro'", () => {
		expect(parseSession({ tipo: "disciplina" }, "x.md")).toBeNull();
		expect(parseSession({}, "x.md")).toBeNull();
		expect(parseSession({ tipo: "plano" }, "x.md")).toBeNull();
	});

	it("usa defaults para campos ausentes", () => {
		const s = parseSession({ tipo: "registro", data: "2026-06-01" }, "x.md");
		expect(s).not.toBeNull();
		expect(s?.duracaoMin).toBe(0);
		expect(s?.acertos).toBe(0);
		expect(s?.erros).toBe(0);
		expect(s?.paginasLidas).toBe(0);
		expect(s?.videos).toBe(0);
		expect(s?.geraRevisao).toBe(false);
		expect(s?.topicoId).toBeUndefined();
		expect(s?.comentario).toBeUndefined();
		expect(s?.material).toBeUndefined();
	});

	it("categoria inválida → 'TEORIA'", () => {
		const s = parseSession({ tipo: "registro", data: "2026-06-01", categoria: "INVALIDA" }, "x.md");
		expect(s?.categoria).toBe("TEORIA");
	});

	it("todas as categorias válidas são aceitas", () => {
		const cats = ["TEORIA", "REVISAO", "QUESTOES", "LEITURA_LEI", "VIDEOAULA", "RESUMO"] as const;
		for (const cat of cats) {
			const s = parseSession({ tipo: "registro", data: "2026-06-01", categoria: cat }, "x.md");
			expect(s?.categoria).toBe(cat);
		}
	});

	it("não lança para frontmatter completamente vazio", () => {
		expect(() => parseSession({}, "x.md")).not.toThrow();
	});

	it("não lança para campos com tipos errados", () => {
		const weirdFm = {
			tipo: "registro",
			data: "2026-06-01",
			duracaoMin: "not a number",
			acertos: null,
			erros: [],
			geraRevisao: "yes",
		};
		expect(() => parseSession(weirdFm, "x.md")).not.toThrow();
		const s = parseSession(weirdFm, "x.md");
		expect(s?.duracaoMin).toBe(0);
		expect(s?.acertos).toBe(0);
		expect(s?.erros).toBe(0);
		expect(s?.geraRevisao).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// parseTopicos
// ---------------------------------------------------------------------------

describe("parseTopicos", () => {
	it("retorna [] quando topicos está ausente", () => {
		expect(parseTopicos({})).toEqual([]);
	});

	it("retorna [] quando topicos não é array", () => {
		expect(parseTopicos({ topicos: "string" })).toEqual([]);
		expect(parseTopicos({ topicos: 42 })).toEqual([]);
	});

	it("parseia um tópico completo", () => {
		const fm = {
			topicos: [
				{
					id: "1",
					titulo: "Princípios",
					nivel: 1,
					concluido: true,
					acertos: 10,
					erros: 2,
					ultimoEstudo: "2026-05-28",
					materiais: ["https://x.com"],
				},
			],
		};
		const [t] = parseTopicos(fm);
		expect(t.id).toBe("1");
		expect(t.titulo).toBe("Princípios");
		expect(t.nivel).toBe(1);
		expect(t.concluido).toBe(true);
		expect(t.acertos).toBe(10);
		expect(t.erros).toBe(2);
		expect(t.ultimoEstudo).toBe("2026-05-28");
		expect(t.materiais).toEqual(["https://x.com"]);
	});

	it("usa defaults para campos ausentes em cada tópico", () => {
		const fm = { topicos: [{ id: "1", titulo: "T" }] };
		const [t] = parseTopicos(fm);
		expect(t.nivel).toBe(1);
		expect(t.concluido).toBe(false);
		expect(t.acertos).toBe(0);
		expect(t.erros).toBe(0);
		expect(t.ultimoEstudo).toBeNull();
		expect(t.materiais).toEqual([]);
	});

	it("não lança para itens com campos de tipos errados", () => {
		const fm = {
			topicos: [
				{ id: 42, titulo: null, nivel: "dois", concluido: "yes" },
			],
		};
		expect(() => parseTopicos(fm)).not.toThrow();
		const [t] = parseTopicos(fm);
		expect(t.id).toBe("42"); // coerce number para string
		expect(t.titulo).toBe(""); // coerce null para string vazia
	});
});

// ---------------------------------------------------------------------------
// parseMetas
// ---------------------------------------------------------------------------

describe("parseMetas", () => {
	it("parseia campos presentes", () => {
		const m = parseMetas({ horasSemanaisAlvo: 30, questoesSemanaisAlvo: 500 });
		expect(m.horasSemanaisAlvo).toBe(30);
		expect(m.questoesSemanaisAlvo).toBe(500);
	});

	it("usa defaults quando campos estão ausentes", () => {
		const m = parseMetas({});
		expect(m.horasSemanaisAlvo).toBe(25);
		expect(m.questoesSemanaisAlvo).toBe(500);
	});

	it("usa defaults para campos com tipo errado", () => {
		const m = parseMetas({ horasSemanaisAlvo: "trinta", questoesSemanaisAlvo: null });
		expect(typeof m.horasSemanaisAlvo).toBe("number");
		expect(typeof m.questoesSemanaisAlvo).toBe("number");
	});
});
