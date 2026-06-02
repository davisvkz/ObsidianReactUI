import { daysBetween, weekKey } from "@/examples/estudei/format";
import type { Ciclo, Metas, Session, Simulado, SimuladoDisciplina, Topico } from "@/examples/estudei/parse";

// ---------------------------------------------------------------------------
// Agregações — puras, sem Obsidian, fortemente testadas.
// ---------------------------------------------------------------------------

export interface Desempenho {
	acertos: number;
	erros: number;
	percentual: number; // 0–1
	total: number;
}

export interface SeriesPoint {
	acertos: number;
	day: string; // "YYYY-MM-DD"
	erros: number;
	minutos: number;
}

export interface DisciplinaStats {
	desempenho: Desempenho;
	disciplina: string;
	minutos: number;
	/** Fração de tópicos concluídos (0–1). */
	progresso: number;
}

export interface ProgressoMetas {
	horasAlvo: number;
	horasFeitas: number;
	questoesAlvo: number;
	questoesFeitas: number;
}

// ---------------------------------------------------------------------------

/** Soma total de minutos de todas as sessões. */
export function totalDuracaoMin(sessions: Session[]): number {
	return sessions.reduce((acc, s) => acc + s.duracaoMin, 0);
}

/** Agrega acertos, erros e percentual de um conjunto de sessões. */
export function aggregateDesempenho(sessions: Session[]): Desempenho {
	let acertos = 0;
	let erros = 0;
	for (const s of sessions) {
		acertos += s.acertos;
		erros += s.erros;
	}
	const total = acertos + erros;
	return { acertos, erros, percentual: total > 0 ? acertos / total : 0, total };
}

/**
 * Mapa de minutos estudados por dia (`"YYYY-MM-DD"` → minutos).
 * Útil como dado de entrada para o `Heatmap` do `@mantine/charts`.
 */
export function studyMinutesByDay(sessions: Session[]): Map<string, number> {
	const m = new Map<string, number>();
	for (const s of sessions) {
		m.set(s.data, (m.get(s.data) ?? 0) + s.duracaoMin);
	}
	return m;
}

/**
 * Streak em dias contínuos de estudo terminando em `today`.
 * Retorna 0 se `today` não estiver no conjunto (falha hoje, reseta streak).
 */
export function computeStreak(days: Set<string>, today: string): number {
	let count = 0;
	let cursor = today;
	while (days.has(cursor)) {
		count++;
		// Recua um dia em UTC
		const [y, m, d] = cursor.split("-").map(Number);
		const prev = new Date(Date.UTC(y, m - 1, d - 1));
		cursor = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(prev.getUTCDate()).padStart(2, "0")}`;
	}
	return count;
}

/**
 * Série temporal diária entre `from` e `to` (inclusive).
 * Dias sem sessão recebem zeros. Ordem cronológica crescente.
 */
export function buildTimeSeries(
	sessions: Session[],
	from: string,
	to: string,
): SeriesPoint[] {
	if (from > to) return [];

	// Agrupa por dia
	const byDay = new Map<
		string,
		{ minutos: number; acertos: number; erros: number }
	>();
	for (const s of sessions) {
		const existing = byDay.get(s.data);
		if (existing) {
			existing.minutos += s.duracaoMin;
			existing.acertos += s.acertos;
			existing.erros += s.erros;
		} else {
			byDay.set(s.data, {
				acertos: s.acertos,
				erros: s.erros,
				minutos: s.duracaoMin,
			});
		}
	}

	// Itera todos os dias do intervalo
	const result: SeriesPoint[] = [];
	let cursor = from;
	while (cursor <= to) {
		const data = byDay.get(cursor);
		result.push({
			acertos: data?.acertos ?? 0,
			day: cursor,
			erros: data?.erros ?? 0,
			minutos: data?.minutos ?? 0,
		});
		// Avança um dia
		const [y, m, d] = cursor.split("-").map(Number);
		const next = new Date(Date.UTC(y, m - 1, d + 1));
		cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
	}
	return result;
}

/** Fração de tópicos concluídos do edital (0–1). */
export function editalProgresso(topicos: Topico[]): number {
	if (topicos.length === 0) return 0;
	return topicos.filter((t) => t.concluido).length / topicos.length;
}

/**
 * % de questões acertadas de um tópico.
 * Retorna `null` quando ainda não há questões registradas.
 */
export function topicoPercentual(t: Topico): number | null {
	const total = t.acertos + t.erros;
	return total > 0 ? t.acertos / total : null;
}

/** Agrega stats de cada disciplina para o painel da Home. */
export function aggregateByDisciplina(
	input: { disciplina: string; sessions: Session[]; topicos: Topico[] }[],
): DisciplinaStats[] {
	return input.map(({ disciplina, sessions, topicos }) => ({
		desempenho: aggregateDesempenho(sessions),
		disciplina,
		minutos: totalDuracaoMin(sessions),
		progresso: editalProgresso(topicos),
	}));
}

// ---------------------------------------------------------------------------
// Simulado

export interface SimuladoAgg extends Simulado {
	acertos: number;
	brancos: number;
	desempenho: number; // 0–1  acertos / (acertos + erros)
	erros: number;
	total: number;
}

/** Agrega os campos numéricos de cada simulado a partir de suas disciplinas. */
export function aggregateSimulados(simulados: Simulado[]): SimuladoAgg[] {
	return simulados.map((sim) => {
		const acertos = sim.disciplinas.reduce((acc, d) => acc + d.acertos, 0);
		const erros = sim.disciplinas.reduce((acc, d) => acc + d.erros, 0);
		const brancos = sim.disciplinas.reduce((acc, d) => acc + d.brancos, 0);
		const total = sim.disciplinas.reduce((acc, d) => acc + d.total, 0);
		const questoesRespondidas = acertos + erros;
		return {
			...sim,
			acertos,
			brancos,
			desempenho: questoesRespondidas > 0 ? acertos / questoesRespondidas : 0,
			erros,
			total,
		};
	});
}

// ---------------------------------------------------------------------------
// Ciclo (planejamento)

export interface CicloItemProgress {
	concluido: boolean;
	minutosAlvo: number;
	/** Minutos reais estudados (sem cap — pode exceder minutosAlvo). */
	minutosFeitos: number;
	nome: string;
}

export interface CicloProgresso {
	itens: CicloItemProgress[];
	/** Soma de min(minutosFeitos, minutosAlvo) para cada item. */
	minutosFeitos: number;
	minutosTotal: number;
	progresso: number; // 0–1
}

/**
 * Calcula o progresso de um ciclo em relação às sessões por disciplina.
 * `sessionsByDisc`: array de { disciplina: nome, sessions: Session[] }.
 */
export function cicloProgresso(
	ciclo: Ciclo,
	sessionsByDisc: { disciplina: string; sessions: Session[] }[],
): CicloProgresso {
	const startDate = ciclo.iniciado;

	// Minutos totais por nome de disciplina (filtrados pela data de início)
	const minutesByDisc: Record<string, number> = {};
	for (const { disciplina, sessions } of sessionsByDisc) {
		const filtered = startDate
			? sessions.filter((s) => s.data >= startDate)
			: sessions;
		minutesByDisc[disciplina] = totalDuracaoMin(filtered);
	}

	const itens: CicloItemProgress[] = ciclo.disciplinas.map((d) => {
		const feitos = minutesByDisc[d.nome] ?? 0;
		return {
			concluido: feitos >= d.minutosAlvo,
			minutosAlvo: d.minutosAlvo,
			minutosFeitos: feitos,
			nome: d.nome,
		};
	});

	const minutosTotal = itens.reduce((acc, i) => acc + i.minutosAlvo, 0);
	const minutosFeitos = itens.reduce(
		(acc, i) => acc + Math.min(i.minutosFeitos, i.minutosAlvo),
		0,
	);

	return {
		itens,
		minutosFeitos,
		minutosTotal,
		progresso: minutosTotal > 0 ? minutosFeitos / minutosTotal : 0,
	};
}

// ---------------------------------------------------------------------------
// Estatísticas

export interface EstatisticasAgg {
	constancia: number; // 0–1 (diasEstudados / diasTotais)
	desempenho: Desempenho;
	diasEstudados: number;
	diasTotais: number;
	paginasLidas: number;
	paginasPorHora: number;
	totalMin: number;
	videoaulaMin: number;
}

/**
 * Agrega métricas gerais de desempenho para a tela de Estatísticas.
 * `from` e `to` delimitam o período de constância (ISO dates).
 */
export function aggregateEstatisticas(
	sessions: Session[],
	from: string,
	to: string,
): EstatisticasAgg {
	const byDay = studyMinutesByDay(sessions);
	const diasEstudados = byDay.size;
	const diasTotais = Math.max(1, daysBetween(from, to) + 1);
	const desempenho = aggregateDesempenho(sessions);
	const totalMin = totalDuracaoMin(sessions);
	const paginasLidas = sessions.reduce((acc, s) => acc + s.paginasLidas, 0);
	const videoaulaMin = sessions
		.filter((s) => s.categoria === "VIDEOAULA")
		.reduce((acc, s) => acc + s.duracaoMin, 0);
	const horasEstudadas = totalMin / 60;
	const paginasPorHora = horasEstudadas > 0 ? paginasLidas / horasEstudadas : 0;
	return {
		constancia: diasEstudados / diasTotais,
		desempenho,
		diasEstudados,
		diasTotais,
		paginasLidas,
		paginasPorHora,
		totalMin,
		videoaulaMin,
	};
}

// ---------------------------------------------------------------------------

/** Progresso em relação às metas da semana ISO que contém `weekRef`. */
export function progressoSemanal(
	sessions: Session[],
	metas: Metas,
	weekRef: string,
): ProgressoMetas {
	const targetWeek = weekKey(weekRef);
	const weekSessions = sessions.filter((s) => weekKey(s.data) === targetWeek);
	const minutos = totalDuracaoMin(weekSessions);
	const questoes = weekSessions.reduce(
		(acc, s) => acc + s.acertos + s.erros,
		0,
	);
	return {
		horasAlvo: metas.horasSemanaisAlvo,
		horasFeitas: minutos / 60,
		questoesAlvo: metas.questoesSemanaisAlvo,
		questoesFeitas: questoes,
	};
}
