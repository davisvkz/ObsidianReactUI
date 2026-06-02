import { describe, expect, it } from "vitest";
import {
	daysBetween,
	formatDuracao,
	formatPercentual,
	isoDay,
	percentBadgeColor,
	sessionFileName,
	weekKey,
} from "@/examples/estudei/format";

// ---------------------------------------------------------------------------
// formatDuracao
// ---------------------------------------------------------------------------

describe("formatDuracao", () => {
	it("0 minutos → '0min'", () => {
		expect(formatDuracao(0)).toBe("0min");
	});

	it("minutos exatos (sem horas) → só 'Xmin'", () => {
		expect(formatDuracao(45)).toBe("45min");
		expect(formatDuracao(1)).toBe("1min");
	});

	it("horas exatas (sem minutos restantes) → só 'Xh'", () => {
		expect(formatDuracao(60)).toBe("1h");
		expect(formatDuracao(120)).toBe("2h");
	});

	it("horas + minutos → 'XhYmin'", () => {
		expect(formatDuracao(90)).toBe("1h30min");
		expect(formatDuracao(2060)).toBe("34h20min");
		expect(formatDuracao(85 * 60 + 20)).toBe("85h20min");
	});

	it("valor negativo retorna '0min'", () => {
		expect(formatDuracao(-5)).toBe("0min");
	});
});

// ---------------------------------------------------------------------------
// formatPercentual
// ---------------------------------------------------------------------------

describe("formatPercentual", () => {
	it("null → '—'", () => {
		expect(formatPercentual(null)).toBe("—");
	});

	it("0 → '0%'", () => {
		expect(formatPercentual(0)).toBe("0%");
	});

	it("arredonda para o inteiro mais próximo", () => {
		expect(formatPercentual(0.7321)).toBe("73%");
		expect(formatPercentual(0.795)).toBe("80%");
		expect(formatPercentual(1)).toBe("100%");
		expect(formatPercentual(0.5)).toBe("50%");
	});

	it("valores > 1 são tratados como percentual bruto (não multiplicado)", () => {
		// 1.5 → 150% (embora raro, não deve lançar)
		expect(formatPercentual(1.5)).toBe("150%");
	});
});

// ---------------------------------------------------------------------------
// percentBadgeColor
// ---------------------------------------------------------------------------

describe("percentBadgeColor", () => {
	it("null → 'gray'", () => {
		expect(percentBadgeColor(null)).toBe("gray");
	});

	it(">= 0.70 → 'green'", () => {
		expect(percentBadgeColor(0.70)).toBe("green");
		expect(percentBadgeColor(0.80)).toBe("green");
		expect(percentBadgeColor(1)).toBe("green");
	});

	it(">= 0.50 e < 0.70 → 'yellow'", () => {
		expect(percentBadgeColor(0.50)).toBe("yellow");
		expect(percentBadgeColor(0.69)).toBe("yellow");
	});

	it("< 0.50 → 'red'", () => {
		expect(percentBadgeColor(0)).toBe("red");
		expect(percentBadgeColor(0.49)).toBe("red");
	});
});

// ---------------------------------------------------------------------------
// isoDay
// ---------------------------------------------------------------------------

describe("isoDay", () => {
	it("formata Date em 'YYYY-MM-DD' (local)", () => {
		// Usando construtor ano/mês/dia (local) para evitar problema de timezone
		expect(isoDay(new Date(2026, 5, 1))).toBe("2026-06-01");
		expect(isoDay(new Date(2026, 0, 1))).toBe("2026-01-01");
		expect(isoDay(new Date(2025, 11, 31))).toBe("2025-12-31");
	});

	it("padding de mês e dia com zero", () => {
		expect(isoDay(new Date(2026, 0, 9))).toBe("2026-01-09");
	});
});

// ---------------------------------------------------------------------------
// weekKey
// ---------------------------------------------------------------------------

describe("weekKey", () => {
	it("2026-06-01 (segunda) → W23", () => {
		expect(weekKey("2026-06-01")).toBe("2026-W23");
	});

	it("dias da mesma semana retornam a mesma chave", () => {
		const mon = weekKey("2026-06-01");
		const fri = weekKey("2026-06-05");
		const sun = weekKey("2026-06-07");
		expect(mon).toBe(fri);
		expect(mon).toBe(sun);
	});

	it("dias de semanas consecutivas retornam chaves distintas", () => {
		expect(weekKey("2026-06-01")).not.toBe(weekKey("2026-06-08"));
	});

	it("2026-01-01 (qui) → W01", () => {
		// Jan 1 2026 is Thursday → week 1
		expect(weekKey("2026-01-01")).toBe("2026-W01");
	});
});

// ---------------------------------------------------------------------------
// daysBetween
// ---------------------------------------------------------------------------

describe("daysBetween", () => {
	it("mesmo dia → 0", () => {
		expect(daysBetween("2026-06-01", "2026-06-01")).toBe(0);
	});

	it("dias consecutivos → 1", () => {
		expect(daysBetween("2026-06-01", "2026-06-02")).toBe(1);
	});

	it("é comutativo (ordem não importa)", () => {
		expect(daysBetween("2026-06-08", "2026-06-01")).toBe(7);
		expect(daysBetween("2026-06-01", "2026-06-08")).toBe(7);
	});

	it("cruzamento de meses", () => {
		expect(daysBetween("2026-05-31", "2026-06-01")).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// sessionFileName
// ---------------------------------------------------------------------------

describe("sessionFileName", () => {
	it("date + time (HH:MM) → 'YYYY-MM-DD-HHMM.md'", () => {
		expect(sessionFileName("2026-06-01", "08:30")).toBe("2026-06-01-0830.md");
	});

	it("hora meia-noite", () => {
		expect(sessionFileName("2026-06-01", "00:00")).toBe("2026-06-01-0000.md");
	});

	it("hora no final do dia", () => {
		expect(sessionFileName("2026-06-01", "23:59")).toBe("2026-06-01-2359.md");
	});
});
