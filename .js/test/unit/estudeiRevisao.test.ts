import { describe, expect, it } from "vitest";
import type { Session } from "@/examples/estudei/parse";
import { projectRevisoes, revisoesPendentes } from "@/examples/estudei/revisao";

function mkSession(overrides: Partial<Session> = {}): Session {
	return {
		data: "2026-06-01",
		categoria: "TEORIA",
		duracaoMin: 60,
		acertos: 10,
		erros: 2,
		paginasLidas: 0,
		videos: 0,
		geraRevisao: true,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// projectRevisoes
// ---------------------------------------------------------------------------

describe("projectRevisoes", () => {
	it("retorna [] quando geraRevisao=false", () => {
		const s = mkSession({ geraRevisao: false });
		expect(projectRevisoes(s, "reg-1", "2026-06-01")).toEqual([]);
	});

	it("gera uma revisão por offset (default [1,7,14,30,60])", () => {
		const s = mkSession({ data: "2026-06-01", geraRevisao: true });
		const revs = projectRevisoes(s, "reg-1", "2026-06-08");
		expect(revs).toHaveLength(5);
	});

	it("offsets corretos: data + N dias", () => {
		const s = mkSession({ data: "2026-06-01", geraRevisao: true });
		const revs = projectRevisoes(s, "reg-1", "2026-06-08");
		const dates = revs.map((r) => r.data);
		expect(dates).toContain("2026-06-02"); // +1
		expect(dates).toContain("2026-06-08"); // +7
		expect(dates).toContain("2026-06-15"); // +14
		expect(dates).toContain("2026-07-01"); // +30
		expect(dates).toContain("2026-07-31"); // +60
	});

	it("status 'atrasada' para datas passadas (antes de today)", () => {
		const s = mkSession({ data: "2026-06-01", geraRevisao: true });
		const revs = projectRevisoes(s, "reg-1", "2026-06-08");
		const rev1d = revs.find((r) => r.offsetDias === 1);
		expect(rev1d?.status).toBe("atrasada"); // 6/2 < 6/8 → atrasada
	});

	it("status 'programada' para data futura (>= today)", () => {
		const s = mkSession({ data: "2026-06-01", geraRevisao: true });
		const revs = projectRevisoes(s, "reg-1", "2026-06-08");
		const rev7d = revs.find((r) => r.offsetDias === 7); // 6/8 === today
		expect(rev7d?.status).toBe("programada"); // mesmo dia = programada
		const rev14d = revs.find((r) => r.offsetDias === 14); // 6/15 > 6/8 → futura
		expect(rev14d?.status).toBe("programada");
	});

	it("registroId e topicoId são propagados", () => {
		const s = mkSession({ topicoId: "1.2", geraRevisao: true });
		const revs = projectRevisoes(s, "meu-registro", "2026-06-08");
		expect(revs[0].registroId).toBe("meu-registro");
		expect(revs[0].topicoId).toBe("1.2");
	});

	it("aceita offsets customizados", () => {
		const s = mkSession({ data: "2026-06-01", geraRevisao: true });
		const revs = projectRevisoes(s, "r", "2026-06-10", [3, 10]);
		expect(revs).toHaveLength(2);
		expect(revs.map((r) => r.data)).toContain("2026-06-04");
		expect(revs.map((r) => r.data)).toContain("2026-06-11");
	});
});

// ---------------------------------------------------------------------------
// revisoesPendentes
// ---------------------------------------------------------------------------

describe("revisoesPendentes", () => {
	it("retorna [] sem sessões", () => {
		expect(revisoesPendentes([], "2026-06-08")).toEqual([]);
	});

	it("inclui revisões programadas e atrasadas, exclui futuras após a janela", () => {
		const sessions = [
			{
				session: mkSession({ data: "2026-06-01", geraRevisao: true }),
				id: "r1",
			},
		];
		const today = "2026-06-08";
		const all = revisoesPendentes(sessions, today);
		// 5 revisões geradas (offsets 1,7,14,30,60)
		// -1d=6/2 atrasada, +7d=6/8 programada, +14d=6/15 programada, etc.
		expect(all.length).toBe(5);
	});

	it("ignora sessões com geraRevisao=false", () => {
		const sessions = [
			{
				session: mkSession({ geraRevisao: false }),
				id: "r2",
			},
		];
		expect(revisoesPendentes(sessions, "2026-06-08")).toEqual([]);
	});
});
