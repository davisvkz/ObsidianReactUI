import { describe, expect, it } from "vitest";
import type { Session } from "@/examples/estudei/parse";
import { parseCiclo, parseRevisoesConfig, revisaoKey } from "@/examples/estudei/parse";
import { cicloProgresso } from "@/examples/estudei/aggregate";

// ---------------------------------------------------------------------------
// Helpers

function mkSession(overrides: Partial<Session> = {}): Session {
	return {
		data: "2026-06-01",
		categoria: "TEORIA",
		duracaoMin: 60,
		acertos: 10,
		erros: 2,
		paginasLidas: 0,
		videos: 0,
		geraRevisao: false,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// parseCiclo

describe("parseCiclo", () => {
	it("retorna null se tipo !== 'ciclo'", () => {
		expect(parseCiclo({ tipo: "registro" })).toBeNull();
		expect(parseCiclo({ tipo: "simulado" })).toBeNull();
		expect(parseCiclo({})).toBeNull();
	});

	it("parseia nome, iniciado e cicloConcluido", () => {
		const ciclo = parseCiclo({
			tipo: "ciclo",
			nome: "Ciclo 01",
			iniciado: "2026-05-01",
			cicloConcluido: 3,
		})!;
		expect(ciclo.nome).toBe("Ciclo 01");
		expect(ciclo.iniciado).toBe("2026-05-01");
		expect(ciclo.cicloConcluido).toBe(3);
	});

	it("iniciado null quando ausente", () => {
		expect(parseCiclo({ tipo: "ciclo" })!.iniciado).toBeNull();
	});

	it("parseia lista de disciplinas com nome e minutosAlvo", () => {
		const ciclo = parseCiclo({
			tipo: "ciclo",
			disciplinas: [
				{ nome: "Física", minutosAlvo: 75 },
				{ nome: "Química", minutosAlvo: 45 },
			],
		})!;
		expect(ciclo.disciplinas).toHaveLength(2);
		expect(ciclo.disciplinas[0].nome).toBe("Física");
		expect(ciclo.disciplinas[0].minutosAlvo).toBe(75);
		expect(ciclo.disciplinas[1].nome).toBe("Química");
		expect(ciclo.disciplinas[1].minutosAlvo).toBe(45);
	});

	it("disciplina com minutosAlvo ausente usa default 45", () => {
		const ciclo = parseCiclo({
			tipo: "ciclo",
			disciplinas: [{ nome: "Física" }],
		})!;
		expect(ciclo.disciplinas[0].minutosAlvo).toBe(45);
	});

	it("defaults: nome 'Meu Ciclo', cicloConcluido 0, disciplinas []", () => {
		const ciclo = parseCiclo({ tipo: "ciclo" })!;
		expect(ciclo.nome).toBe("Meu Ciclo");
		expect(ciclo.cicloConcluido).toBe(0);
		expect(ciclo.disciplinas).toEqual([]);
	});

	it("disciplinas aceita itens nulos/inválidos com tolerância", () => {
		const ciclo = parseCiclo({
			tipo: "ciclo",
			disciplinas: [null, { nome: "X", minutosAlvo: 30 }, undefined],
		})!;
		expect(ciclo.disciplinas).toHaveLength(3);
		expect(ciclo.disciplinas[1].nome).toBe("X");
	});
});

// ---------------------------------------------------------------------------
// cicloProgresso

describe("cicloProgresso", () => {
	const cicloBase = {
		nome: "C1",
		iniciado: null as string | null,
		cicloConcluido: 0,
		disciplinas: [
			{ nome: "Física", minutosAlvo: 60 },
			{ nome: "Química", minutosAlvo: 90 },
		],
	};

	it("progresso 0 sem sessões", () => {
		const prog = cicloProgresso(cicloBase, []);
		expect(prog.progresso).toBe(0);
		expect(prog.minutosFeitos).toBe(0);
		expect(prog.minutosTotal).toBe(150);
	});

	it("minutosTotal = soma de todos os minutosAlvo", () => {
		const prog = cicloProgresso(cicloBase, []);
		expect(prog.minutosTotal).toBe(60 + 90);
	});

	it("calcula minutosFeitos com cap por item", () => {
		const sessoesByDisc = [
			{ disciplina: "Física", sessions: [mkSession({ duracaoMin: 45 })] },
			{ disciplina: "Química", sessions: [mkSession({ duracaoMin: 90 })] },
		];
		const prog = cicloProgresso(cicloBase, sessoesByDisc);
		// Física: min(45, 60) = 45; Química: min(90, 90) = 90
		expect(prog.minutosFeitos).toBe(45 + 90);
		expect(prog.progresso).toBeCloseTo(135 / 150);
	});

	it("minutosFeitos do item é o raw (não capeado), progresso usa cap", () => {
		const sessoesByDisc = [
			{ disciplina: "Física", sessions: [mkSession({ duracaoMin: 120 })] },
		];
		const prog = cicloProgresso(cicloBase, sessoesByDisc);
		expect(prog.itens[0].minutosFeitos).toBe(120); // raw: mais que o alvo
		expect(prog.minutosFeitos).toBe(60); // capeado em 60 + 0 = 60
	});

	it("item concluido quando minutosFeitos >= minutosAlvo", () => {
		const sessoesByDisc = [
			{ disciplina: "Física", sessions: [mkSession({ duracaoMin: 60 })] },
			{ disciplina: "Química", sessions: [mkSession({ duracaoMin: 80 })] },
		];
		const prog = cicloProgresso(cicloBase, sessoesByDisc);
		expect(prog.itens[0].concluido).toBe(true);  // 60 >= 60
		expect(prog.itens[1].concluido).toBe(false); // 80 < 90
	});

	it("filtra sessões pela data iniciado (inclusive)", () => {
		const cicloComIniciado = { ...cicloBase, iniciado: "2026-06-01" };
		const sessoesByDisc = [
			{
				disciplina: "Física",
				sessions: [
					mkSession({ data: "2026-05-31", duracaoMin: 60 }), // antes → ignorado
					mkSession({ data: "2026-06-01", duracaoMin: 30 }), // exatamente → inclui
					mkSession({ data: "2026-06-05", duracaoMin: 20 }), // depois → inclui
				],
			},
		];
		const prog = cicloProgresso(cicloComIniciado, sessoesByDisc);
		expect(prog.itens[0].minutosFeitos).toBe(50); // 30 + 20
	});

	it("disciplina não encontrada nas sessões → minutosFeitos 0", () => {
		const prog = cicloProgresso(cicloBase, [
			{ disciplina: "Outra", sessions: [mkSession({ duracaoMin: 100 })] },
		]);
		expect(prog.itens[0].minutosFeitos).toBe(0);
		expect(prog.itens[1].minutosFeitos).toBe(0);
	});

	it("progresso 1.0 quando todos os itens completos", () => {
		const sessoesByDisc = [
			{ disciplina: "Física", sessions: [mkSession({ duracaoMin: 60 })] },
			{ disciplina: "Química", sessions: [mkSession({ duracaoMin: 90 })] },
		];
		const prog = cicloProgresso(cicloBase, sessoesByDisc);
		expect(prog.progresso).toBeCloseTo(1.0);
	});

	it("ciclo sem disciplinas → progresso 0", () => {
		const prog = cicloProgresso({ ...cicloBase, disciplinas: [] }, []);
		expect(prog.progresso).toBe(0);
		expect(prog.minutosTotal).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// parseRevisoesConfig

describe("parseRevisoesConfig", () => {
	it("arrays vazios quando campos ausentes", () => {
		const cfg = parseRevisoesConfig({});
		expect(cfg.ignoradas).toEqual([]);
		expect(cfg.concluidas).toEqual([]);
	});

	it("parseia ignoradas corretamente", () => {
		const cfg = parseRevisoesConfig({
			ignoradas: ["estudei/Física/r1.md:7", "estudei/Dir/r2.md:14"],
		});
		expect(cfg.ignoradas).toHaveLength(2);
		expect(cfg.ignoradas[0]).toEqual({ registroId: "estudei/Física/r1.md", offsetDias: 7 });
		expect(cfg.ignoradas[1]).toEqual({ registroId: "estudei/Dir/r2.md", offsetDias: 14 });
	});

	it("ignora entradas malformadas", () => {
		const cfg = parseRevisoesConfig({ ignoradas: ["sem-dois-pontos", ":7", ""] });
		expect(cfg.ignoradas).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// revisaoKey

describe("revisaoKey", () => {
	it("formata como 'registroId:offsetDias'", () => {
		expect(revisaoKey("estudei/Física/r1.md", 7)).toBe("estudei/Física/r1.md:7");
	});
});
