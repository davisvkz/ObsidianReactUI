import type { Session } from "@/examples/estudei/parse";

// ---------------------------------------------------------------------------
// Revisão espaçada — derivada, sem estado persistido (v1).
// ---------------------------------------------------------------------------

export type RevisaoStatus = "programada" | "atrasada";

export interface RevisaoOcorrencia {
	/** Data agendada da revisão (`"YYYY-MM-DD"`). */
	data: string;
	offsetDias: number;
	registroId: string;
	status: RevisaoStatus;
	topicoId?: string;
}

const DEFAULT_OFFSETS = [1, 7, 14, 30, 60] as const;

/** Avança `isoDay` em `days` dias (em UTC). */
function addDays(isoDay: string, days: number): string {
	const [y, m, d] = isoDay.split("-").map(Number);
	const next = new Date(Date.UTC(y, m - 1, d + days));
	return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Projeta o calendário de revisões espaçadas de uma sessão de estudo.
 * Retorna [] quando `session.geraRevisao === false`.
 *
 * @param session   Sessão de estudo original.
 * @param registroId  Identificador estável do registro (path/filename).
 * @param today     Data de referência `"YYYY-MM-DD"` para calcular status.
 * @param offsets   Intervalos em dias (padrão: [1, 7, 14, 30, 60]).
 */
export function projectRevisoes(
	session: Session,
	registroId: string,
	today: string,
	offsets: readonly number[] = DEFAULT_OFFSETS,
): RevisaoOcorrencia[] {
	if (!session.geraRevisao) return [];
	return offsets.map((offsetDias) => {
		const data = addDays(session.data, offsetDias);
		return {
			data,
			offsetDias,
			registroId,
			status: data < today ? "atrasada" : "programada",
			topicoId: session.topicoId,
		};
	});
}

/**
 * Retorna todas as revisões pendentes (programadas ou atrasadas) para a data
 * `today`, cruzando todas as sessões fornecidas.
 */
export function revisoesPendentes(
	sessions: { session: Session; id: string }[],
	today: string,
): RevisaoOcorrencia[] {
	return sessions.flatMap(({ session, id }) =>
		projectRevisoes(session, id, today),
	);
}
