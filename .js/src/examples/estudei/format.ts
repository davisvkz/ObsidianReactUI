// ---------------------------------------------------------------------------
// Funções de formatação — puras, sem Obsidian, fortemente testadas.
// ---------------------------------------------------------------------------

/** Formata minutos em string legível: `"34h20min"`, `"2h"`, `"45min"`, `"0min"`. */
export function formatDuracao(min: number): string {
	if (min <= 0) return "0min";
	const h = Math.floor(min / 60);
	const m = min % 60;
	if (h === 0) return `${m}min`;
	if (m === 0) return `${h}h`;
	return `${h}h${m}min`;
}

/** Formata um percentual (0–1) como `"73%"`, ou `"—"` para `null`. */
export function formatPercentual(p: number | null): string {
	if (p === null) return "—";
	return `${Math.round(p * 100)}%`;
}

/**
 * Cor Mantine para badge de desempenho:
 * `"green"` ≥ 70 % · `"yellow"` ≥ 50 % · `"red"` < 50 % · `"gray"` para null.
 */
export function percentBadgeColor(
	p: number | null,
): "green" | "yellow" | "red" | "gray" {
	if (p === null) return "gray";
	if (p >= 0.7) return "green";
	if (p >= 0.5) return "yellow";
	return "red";
}

/** Data local `Date` → string `"YYYY-MM-DD"`. */
export function isoDay(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/**
 * Chave de semana ISO (`"YYYY-Www"`) para uma data `"YYYY-MM-DD"`.
 * Usa o algoritmo padrão: semana 1 contém a primeira quinta-feira do ano.
 */
export function weekKey(isoDay: string): string {
	const [y, m, d] = isoDay.split("-").map(Number);
	// Trabalha em UTC para evitar problemas de timezone
	const date = new Date(Date.UTC(y, m - 1, d));
	const dow = date.getUTCDay() || 7; // 1=seg … 7=dom
	// Avança até a quinta-feira mais próxima
	date.setUTCDate(date.getUTCDate() + 4 - dow);
	const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
	const weekNo = Math.ceil(
		((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
	);
	return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Número absoluto de dias entre duas datas `"YYYY-MM-DD"`. */
export function daysBetween(a: string, b: string): number {
	const parse = (s: string) => {
		const [y, m, d] = s.split("-").map(Number);
		return Date.UTC(y, m - 1, d);
	};
	return Math.abs(Math.round((parse(a) - parse(b)) / 86_400_000));
}

/**
 * Nome do arquivo de registro: `"YYYY-MM-DD-HHMM.md"`.
 * @param date  ISO date `"YYYY-MM-DD"`
 * @param time  hora `"HH:MM"`
 */
export function sessionFileName(date: string, time: string): string {
	const hhmm = time.replace(":", "");
	return `${date}-${hhmm}.md`;
}
