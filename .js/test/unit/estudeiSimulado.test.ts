import { describe, expect, it } from "vitest";
import type { Simulado } from "@/examples/estudei/parse";
import { parseSimulado } from "@/examples/estudei/parse";
import { aggregateSimulados } from "@/examples/estudei/aggregate";

// ---------------------------------------------------------------------------
// Helpers

function mkFm(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		tipo: "simulado",
		nome: "Simulado 01",
		data: "2024-11-22",
		formato: "MULTIPLA_ESCOLHA",
		banca: "FCC",
		duracaoMin: 200,
		disciplinas: [
			{ nome: "Direito Administrativo", peso: 1, total: 8, acertos: 6, erros: 2, brancos: 0 },
			{ nome: "Direito Constitucional", peso: 2, total: 10, acertos: 8, erros: 2, brancos: 0 },
		],
		...overrides,
	};
}

function mkSim(
	disciplinas: Simulado["disciplinas"] = [
		{ nome: "Disc A", peso: 1, total: 10, acertos: 8, erros: 2, brancos: 0 },
	],
): Simulado {
	return {
		nome: "Simulado X",
		data: "2024-11-22",
		formato: "MULTIPLA_ESCOLHA",
		duracaoMin: 100,
		disciplinas,
	};
}

// ---------------------------------------------------------------------------
// parseSimulado

describe("parseSimulado", () => {
	it("retorna null se tipo !== 'simulado'", () => {
		expect(parseSimulado({ tipo: "registro" }, "p")).toBeNull();
		expect(parseSimulado({ tipo: "ciclo" }, "p")).toBeNull();
		expect(parseSimulado({}, "p")).toBeNull();
	});

	it("parseia campos básicos corretamente", () => {
		const sim = parseSimulado(mkFm(), "p")!;
		expect(sim.nome).toBe("Simulado 01");
		expect(sim.data).toBe("2024-11-22");
		expect(sim.banca).toBe("FCC");
		expect(sim.duracaoMin).toBe(200);
	});

	it("formato padrão MULTIPLA_ESCOLHA quando inválido ou ausente", () => {
		expect(parseSimulado(mkFm({ formato: "INVALIDO" }), "p")!.formato).toBe("MULTIPLA_ESCOLHA");
		expect(parseSimulado(mkFm({ formato: undefined }), "p")!.formato).toBe("MULTIPLA_ESCOLHA");
	});

	it("aceita CERTO_ERRADO como formato", () => {
		expect(parseSimulado(mkFm({ formato: "CERTO_ERRADO" }), "p")!.formato).toBe("CERTO_ERRADO");
	});

	it("parseia disciplinas corretamente", () => {
		const sim = parseSimulado(mkFm(), "p")!;
		expect(sim.disciplinas).toHaveLength(2);
		const d0 = sim.disciplinas[0];
		expect(d0.nome).toBe("Direito Administrativo");
		expect(d0.acertos).toBe(6);
		expect(d0.erros).toBe(2);
		expect(d0.brancos).toBe(0);
		expect(d0.total).toBe(8);
		expect(d0.peso).toBe(1);
	});

	it("lista de disciplinas vazia quando campo ausente", () => {
		const sim = parseSimulado({ tipo: "simulado" }, "p")!;
		expect(sim.disciplinas).toEqual([]);
	});

	it("uses defaults para campos ausentes", () => {
		const sim = parseSimulado({ tipo: "simulado" }, "p")!;
		expect(sim.data).toBe("1970-01-01");
		expect(sim.duracaoMin).toBe(0);
		expect(sim.banca).toBeUndefined();
		expect(sim.comentario).toBeUndefined();
		expect(sim.nome).toBe("Simulado");
	});

	it("banca undefined quando ausente, string quando presente", () => {
		expect(parseSimulado({ tipo: "simulado" }, "p")!.banca).toBeUndefined();
		expect(parseSimulado(mkFm({ banca: "CESPE" }), "p")!.banca).toBe("CESPE");
	});

	it("comentario undefined quando ausente", () => {
		expect(parseSimulado({ tipo: "simulado" }, "p")!.comentario).toBeUndefined();
		expect(parseSimulado(mkFm({ comentario: "foi bem" }), "p")!.comentario).toBe("foi bem");
	});

	it("disciplina com campos inválidos usa defaults (peso=1, resto=0)", () => {
		const sim = parseSimulado(
			mkFm({ disciplinas: [{ nome: "X" }] }),
			"p",
		)!;
		expect(sim.disciplinas[0].peso).toBe(1);
		expect(sim.disciplinas[0].acertos).toBe(0);
		expect(sim.disciplinas[0].total).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// aggregateSimulados

describe("aggregateSimulados", () => {
	it("array vazio → []", () => {
		expect(aggregateSimulados([])).toEqual([]);
	});

	it("soma acertos, erros, brancos e total de todas as disciplinas", () => {
		const sim = mkSim([
			{ nome: "A", peso: 1, total: 10, acertos: 8, erros: 2, brancos: 0 },
			{ nome: "B", peso: 2, total: 10, acertos: 6, erros: 3, brancos: 1 },
		]);
		const [agg] = aggregateSimulados([sim]);
		expect(agg.acertos).toBe(14);
		expect(agg.erros).toBe(5);
		expect(agg.brancos).toBe(1);
		expect(agg.total).toBe(20);
	});

	it("desempenho = acertos / (acertos + erros)", () => {
		const sim = mkSim([{ nome: "A", peso: 1, total: 10, acertos: 8, erros: 2, brancos: 0 }]);
		const [agg] = aggregateSimulados([sim]);
		expect(agg.desempenho).toBeCloseTo(0.8);
	});

	it("desempenho 0 quando sem questões respondidas (só brancos)", () => {
		const sim = mkSim([{ nome: "A", peso: 1, total: 10, acertos: 0, erros: 0, brancos: 10 }]);
		const [agg] = aggregateSimulados([sim]);
		expect(agg.desempenho).toBe(0);
	});

	it("desempenho 0 quando sem nenhuma questão", () => {
		const sim = mkSim([{ nome: "A", peso: 1, total: 0, acertos: 0, erros: 0, brancos: 0 }]);
		const [agg] = aggregateSimulados([sim]);
		expect(agg.desempenho).toBe(0);
	});

	it("preserva campos originais (nome, data, formato, etc.)", () => {
		const sim = mkSim();
		const [agg] = aggregateSimulados([sim]);
		expect(agg.nome).toBe("Simulado X");
		expect(agg.data).toBe("2024-11-22");
		expect(agg.formato).toBe("MULTIPLA_ESCOLHA");
		expect(agg.duracaoMin).toBe(100);
	});

	it("agrega múltiplos simulados independentemente", () => {
		const sims = [
			mkSim([{ nome: "A", peso: 1, total: 10, acertos: 8, erros: 2, brancos: 0 }]),
			mkSim([{ nome: "A", peso: 1, total: 10, acertos: 5, erros: 5, brancos: 0 }]),
		];
		const agg = aggregateSimulados(sims);
		expect(agg).toHaveLength(2);
		expect(agg[0].desempenho).toBeCloseTo(0.8);
		expect(agg[1].desempenho).toBeCloseTo(0.5);
	});
});
