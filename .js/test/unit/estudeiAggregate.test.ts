import { describe, expect, it } from "vitest";
import type { Session, Topico } from "@/examples/estudei/parse";
import {
	aggregateByDisciplina,
	aggregateDesempenho,
	buildTimeSeries,
	computeStreak,
	editalProgresso,
	progressoSemanal,
	studyMinutesByDay,
	topicoPercentual,
	totalDuracaoMin,
} from "@/examples/estudei/aggregate";
import type { Metas } from "@/examples/estudei/parse";

// Helper — cria sessão mínima
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
// totalDuracaoMin
// ---------------------------------------------------------------------------

describe("totalDuracaoMin", () => {
	it("array vazio → 0", () => {
		expect(totalDuracaoMin([])).toBe(0);
	});

	it("soma os minutos de todas as sessões", () => {
		expect(totalDuracaoMin([mkSession({ duracaoMin: 45 }), mkSession({ duracaoMin: 90 })])).toBe(135);
	});
});

// ---------------------------------------------------------------------------
// aggregateDesempenho
// ---------------------------------------------------------------------------

describe("aggregateDesempenho", () => {
	it("array vazio → zeros", () => {
		const d = aggregateDesempenho([]);
		expect(d.acertos).toBe(0);
		expect(d.erros).toBe(0);
		expect(d.total).toBe(0);
		expect(d.percentual).toBe(0);
	});

	it("soma acertos, erros e calcula percentual", () => {
		const sessions = [
			mkSession({ acertos: 15, erros: 5 }),
			mkSession({ acertos: 25, erros: 5 }),
		];
		const d = aggregateDesempenho(sessions);
		expect(d.acertos).toBe(40);
		expect(d.erros).toBe(10);
		expect(d.total).toBe(50);
		expect(d.percentual).toBeCloseTo(0.8, 5);
	});

	it("percentual 0 quando total 0", () => {
		const d = aggregateDesempenho([mkSession({ acertos: 0, erros: 0 })]);
		expect(d.percentual).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// studyMinutesByDay
// ---------------------------------------------------------------------------

describe("studyMinutesByDay", () => {
	it("retorna Map vazio para array vazio", () => {
		expect(studyMinutesByDay([])).toEqual(new Map());
	});

	it("agrupa sessões do mesmo dia", () => {
		const sessions = [
			mkSession({ data: "2026-06-01", duracaoMin: 30 }),
			mkSession({ data: "2026-06-01", duracaoMin: 45 }),
			mkSession({ data: "2026-06-02", duracaoMin: 60 }),
		];
		const m = studyMinutesByDay(sessions);
		expect(m.get("2026-06-01")).toBe(75);
		expect(m.get("2026-06-02")).toBe(60);
	});
});

// ---------------------------------------------------------------------------
// computeStreak
// ---------------------------------------------------------------------------

describe("computeStreak", () => {
	it("0 dias estudados → streak 0", () => {
		expect(computeStreak(new Set(), "2026-06-01")).toBe(0);
	});

	it("só hoje → streak 1", () => {
		expect(computeStreak(new Set(["2026-06-01"]), "2026-06-01")).toBe(1);
	});

	it("dias consecutivos incluindo hoje", () => {
		const days = new Set(["2026-05-30", "2026-05-31", "2026-06-01"]);
		expect(computeStreak(days, "2026-06-01")).toBe(3);
	});

	it("gap ontem quebra a streak", () => {
		// Estudou 5/31 e 6/1 mas não 5/30 (irrelevante — streak conta de hoje p/ trás)
		const days = new Set(["2026-05-29", "2026-05-31", "2026-06-01"]);
		// De 6/1 para trás: 6/1 ✓ 5/31 ✓ 5/30 ✗ → streak 2
		expect(computeStreak(days, "2026-06-01")).toBe(2);
	});

	it("hoje não estudado → streak 0 mesmo tendo ontem", () => {
		const days = new Set(["2026-05-31"]);
		expect(computeStreak(days, "2026-06-01")).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// buildTimeSeries
// ---------------------------------------------------------------------------

describe("buildTimeSeries", () => {
	it("retorna array vazio quando de>para", () => {
		expect(buildTimeSeries([], "2026-06-05", "2026-06-01")).toEqual([]);
	});

	it("zero-fill dias sem sessão", () => {
		// Só 6/1 tem sessão; 6/2, 6/3 devem aparecer zerados
		const sessions = [mkSession({ data: "2026-06-01", duracaoMin: 45, acertos: 5, erros: 1 })];
		const series = buildTimeSeries(sessions, "2026-06-01", "2026-06-03");
		expect(series).toHaveLength(3);
		expect(series[0]).toMatchObject({ day: "2026-06-01", minutos: 45, acertos: 5, erros: 1 });
		expect(series[1]).toMatchObject({ day: "2026-06-02", minutos: 0, acertos: 0, erros: 0 });
		expect(series[2]).toMatchObject({ day: "2026-06-03", minutos: 0, acertos: 0, erros: 0 });
	});

	it("agrega múltiplas sessões no mesmo dia", () => {
		const sessions = [
			mkSession({ data: "2026-06-01", duracaoMin: 30, acertos: 5, erros: 1 }),
			mkSession({ data: "2026-06-01", duracaoMin: 40, acertos: 8, erros: 2 }),
		];
		const [pt] = buildTimeSeries(sessions, "2026-06-01", "2026-06-01");
		expect(pt.minutos).toBe(70);
		expect(pt.acertos).toBe(13);
		expect(pt.erros).toBe(3);
	});
});

// ---------------------------------------------------------------------------
// editalProgresso
// ---------------------------------------------------------------------------

describe("editalProgresso", () => {
	it("0 tópicos → 0", () => {
		expect(editalProgresso([])).toBe(0);
	});

	it("todos concluídos → 1", () => {
		const tpcs: Topico[] = [
			{ id: "1", titulo: "A", nivel: 1, concluido: true, acertos: 5, erros: 0, ultimoEstudo: null, materiais: [] },
			{ id: "2", titulo: "B", nivel: 1, concluido: true, acertos: 3, erros: 0, ultimoEstudo: null, materiais: [] },
		];
		expect(editalProgresso(tpcs)).toBe(1);
	});

	it("metade concluída → 0.5", () => {
		const tpcs: Topico[] = [
			{ id: "1", titulo: "A", nivel: 1, concluido: true, acertos: 5, erros: 0, ultimoEstudo: null, materiais: [] },
			{ id: "2", titulo: "B", nivel: 1, concluido: false, acertos: 0, erros: 0, ultimoEstudo: null, materiais: [] },
		];
		expect(editalProgresso(tpcs)).toBe(0.5);
	});
});

// ---------------------------------------------------------------------------
// topicoPercentual
// ---------------------------------------------------------------------------

describe("topicoPercentual", () => {
	it("null quando acertos + erros = 0", () => {
		const t: Topico = { id: "1", titulo: "A", nivel: 1, concluido: false, acertos: 0, erros: 0, ultimoEstudo: null, materiais: [] };
		expect(topicoPercentual(t)).toBeNull();
	});

	it("calcula acertos / total", () => {
		const t: Topico = { id: "1", titulo: "A", nivel: 1, concluido: false, acertos: 8, erros: 2, ultimoEstudo: null, materiais: [] };
		expect(topicoPercentual(t)).toBeCloseTo(0.8, 5);
	});
});

// ---------------------------------------------------------------------------
// aggregateByDisciplina
// ---------------------------------------------------------------------------

describe("aggregateByDisciplina", () => {
	it("retorna array vazio para entrada vazia", () => {
		expect(aggregateByDisciplina([])).toEqual([]);
	});

	it("calcula stats de uma disciplina", () => {
		const tpcs: Topico[] = [
			{ id: "1", titulo: "A", nivel: 1, concluido: true, acertos: 5, erros: 1, ultimoEstudo: null, materiais: [] },
			{ id: "2", titulo: "B", nivel: 1, concluido: false, acertos: 0, erros: 0, ultimoEstudo: null, materiais: [] },
		];
		const sessions = [
			mkSession({ duracaoMin: 60, acertos: 8, erros: 2 }),
			mkSession({ duracaoMin: 30, acertos: 12, erros: 3 }),
		];
		const [stats] = aggregateByDisciplina([
			{ disciplina: "Física", sessions, topicos: tpcs },
		]);
		expect(stats.disciplina).toBe("Física");
		expect(stats.minutos).toBe(90);
		expect(stats.desempenho.acertos).toBe(20);
		expect(stats.desempenho.erros).toBe(5);
		expect(stats.progresso).toBe(0.5); // 1/2 concluído
	});
});

// ---------------------------------------------------------------------------
// progressoSemanal
// ---------------------------------------------------------------------------

describe("progressoSemanal", () => {
	const metas: Metas = { horasSemanaisAlvo: 10, questoesSemanaisAlvo: 200 };

	it("semana sem sessões → zeros", () => {
		const p = progressoSemanal([], metas, "2026-06-01");
		expect(p.horasFeitas).toBe(0);
		expect(p.questoesFeitas).toBe(0);
		expect(p.horasAlvo).toBe(10);
		expect(p.questoesAlvo).toBe(200);
	});

	it("conta só sessões da mesma semana ISO", () => {
		const sessions = [
			// Semana de 2026-06-01 (W23)
			mkSession({ data: "2026-06-01", duracaoMin: 60, acertos: 10, erros: 5 }),
			mkSession({ data: "2026-06-03", duracaoMin: 120, acertos: 20, erros: 5 }),
			// Semana de 2026-06-08 (W24) — não deve entrar
			mkSession({ data: "2026-06-08", duracaoMin: 90, acertos: 15, erros: 0 }),
		];
		const p = progressoSemanal(sessions, metas, "2026-06-01");
		expect(p.horasFeitas).toBeCloseTo(3, 5); // 180 min = 3h
		expect(p.questoesFeitas).toBe(40); // 10+5+20+5
	});
});
