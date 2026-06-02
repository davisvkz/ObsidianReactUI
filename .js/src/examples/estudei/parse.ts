// ---------------------------------------------------------------------------
// Tipos de domínio + parsers tolerantes (sem Obsidian, fortemente testados).
// ---------------------------------------------------------------------------

export type Categoria =
	| "TEORIA"
	| "REVISAO"
	| "QUESTOES"
	| "LEITURA_LEI"
	| "VIDEOAULA"
	| "RESUMO";

const CATEGORIAS: Set<string> = new Set<Categoria>([
	"TEORIA",
	"REVISAO",
	"QUESTOES",
	"LEITURA_LEI",
	"VIDEOAULA",
	"RESUMO",
]);

export interface Session {
	acertos: number;
	categoria: Categoria;
	comentario?: string;
	data: string;
	/** Duração em minutos (unidade canônica; formatação é derivada). */
	duracaoMin: number;
	erros: number;
	geraRevisao: boolean;
	inicio?: string;
	material?: string;
	paginasLidas: number;
	topicoId?: string;
	videos: number;
}

export interface Topico {
	acertos: number;
	concluido: boolean;
	erros: number;
	id: string;
	materiais: string[];
	nivel: number;
	titulo: string;
	ultimoEstudo: string | null;
}

export interface Metas {
	horasSemanaisAlvo: number;
	questoesSemanaisAlvo: number;
}

// ---------------------------------------------------------------------------
// Helpers de coerção (nunca lançam)

function num(v: unknown, fallback = 0): number {
	const n = Number(v);
	return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
	if (v == null) return fallback;
	return String(v);
}

function bool(v: unknown, fallback = false): boolean {
	if (typeof v === "boolean") return v;
	return fallback;
}

// ---------------------------------------------------------------------------

/**
 * Parseia o frontmatter de um arquivo de registro.
 * Retorna `null` se `tipo !== "registro"`.
 * Tolerante: nunca lança, usa defaults para campos ausentes ou de tipo errado.
 */
export function parseSession(
	fm: Record<string, unknown>,
	_path: string,
): Session | null {
	if (fm.tipo !== "registro") return null;

	const cat = str(fm.categoria);
	const categoria: Categoria = CATEGORIAS.has(cat)
		? (cat as Categoria)
		: "TEORIA";

	const topicoId = fm.topicoId != null ? str(fm.topicoId) : undefined;
	const inicio = fm.inicio != null ? str(fm.inicio) : undefined;
	const material = fm.material != null ? str(fm.material) : undefined;
	const comentario = fm.comentario != null ? str(fm.comentario) : undefined;

	return {
		acertos: num(fm.acertos),
		categoria,
		comentario,
		data: str(fm.data, "1970-01-01"),
		duracaoMin: num(fm.duracaoMin),
		erros: num(fm.erros),
		geraRevisao: bool(fm.geraRevisao),
		inicio,
		material,
		paginasLidas: num(fm.paginasLidas),
		topicoId,
		videos: num(fm.videos),
	};
}

/** Parseia o array `topicos` do frontmatter de uma disciplina. */
export function parseTopicos(fm: Record<string, unknown>): Topico[] {
	if (!Array.isArray(fm.topicos)) return [];
	return (fm.topicos as unknown[]).map((item) => {
		const t = (item ?? {}) as Record<string, unknown>;
		return {
			acertos: num(t.acertos),
			concluido: bool(t.concluido),
			erros: num(t.erros),
			id: str(t.id, ""),
			materiais: Array.isArray(t.materiais)
				? (t.materiais as unknown[]).map((m) => str(m))
				: [],
			nivel: num(t.nivel, 1),
			titulo: str(t.titulo, ""),
			ultimoEstudo: t.ultimoEstudo != null ? str(t.ultimoEstudo) : null,
		};
	});
}

/** Parseia o frontmatter de `_config/metas.md`. */
export function parseMetas(fm: Record<string, unknown>): Metas {
	return {
		horasSemanaisAlvo: num(fm.horasSemanaisAlvo, 25),
		questoesSemanaisAlvo: num(fm.questoesSemanaisAlvo, 500),
	};
}

// ---------------------------------------------------------------------------
// Ciclo (planejamento por ciclos de estudo)

export interface CicloDisciplina {
	minutosAlvo: number;
	nome: string;
}

export interface Ciclo {
	cicloConcluido: number;
	disciplinas: CicloDisciplina[];
	/** Data ISO a partir da qual as sessões contam para o ciclo atual. */
	iniciado: string | null;
	nome: string;
}

/** Parseia `_config/ciclo.md`. Retorna `null` se `tipo !== "ciclo"`. */
export function parseCiclo(fm: Record<string, unknown>): Ciclo | null {
	if (fm.tipo !== "ciclo") return null;
	const disciplinas: CicloDisciplina[] = [];
	if (Array.isArray(fm.disciplinas)) {
		for (const item of fm.disciplinas as unknown[]) {
			const d = ((item ?? {}) as Record<string, unknown>);
			disciplinas.push({ minutosAlvo: num(d.minutosAlvo, 45), nome: str(d.nome) });
		}
	}
	return {
		cicloConcluido: num(fm.cicloConcluido, 0),
		disciplinas,
		iniciado: fm.iniciado != null ? str(fm.iniciado) : null,
		nome: str(fm.nome, "Meu Ciclo"),
	};
}

// ---------------------------------------------------------------------------
// Simulado

export type FormatoSimulado = "MULTIPLA_ESCOLHA" | "CERTO_ERRADO";

export interface SimuladoDisciplina {
	acertos: number;
	brancos: number;
	erros: number;
	nome: string;
	peso: number;
	total: number;
}

export interface Simulado {
	banca?: string;
	comentario?: string;
	data: string;
	disciplinas: SimuladoDisciplina[];
	duracaoMin: number;
	formato: FormatoSimulado;
	nome: string;
}

/**
 * Parseia o frontmatter de um arquivo de simulado.
 * Retorna `null` se `tipo !== "simulado"`.
 */
export function parseSimulado(
	fm: Record<string, unknown>,
	_path: string,
): Simulado | null {
	if (fm.tipo !== "simulado") return null;
	const formato: FormatoSimulado =
		fm.formato === "CERTO_ERRADO" ? "CERTO_ERRADO" : "MULTIPLA_ESCOLHA";
	const disciplinas: SimuladoDisciplina[] = [];
	if (Array.isArray(fm.disciplinas)) {
		for (const item of fm.disciplinas as unknown[]) {
			const d = ((item ?? {}) as Record<string, unknown>);
			disciplinas.push({
				acertos: num(d.acertos),
				brancos: num(d.brancos),
				erros: num(d.erros),
				nome: str(d.nome),
				peso: num(d.peso, 1),
				total: num(d.total),
			});
		}
	}
	return {
		banca: fm.banca != null ? str(fm.banca) : undefined,
		comentario: fm.comentario != null ? str(fm.comentario) : undefined,
		data: str(fm.data, "1970-01-01"),
		disciplinas,
		duracaoMin: num(fm.duracaoMin),
		formato,
		nome: str(fm.nome, "Simulado"),
	};
}

// ---------------------------------------------------------------------------
// Revisões — configuração de ignoradas/concluídas

export interface RevisaoKey {
	offsetDias: number;
	registroId: string;
}

export interface RevisoesConfig {
	concluidas: RevisaoKey[];
	ignoradas: RevisaoKey[];
}

/** Codifica uma chave de revisão: `"registroId:offsetDias"`. */
export function revisaoKey(registroId: string, offsetDias: number): string {
	return `${registroId}:${offsetDias}`;
}

/** Parseia `_config/revisoes.md` (tolerante, sem verificar `tipo`). */
export function parseRevisoesConfig(fm: Record<string, unknown>): RevisoesConfig {
	const decode = (arr: unknown): RevisaoKey[] => {
		if (!Array.isArray(arr)) return [];
		return (arr as unknown[]).flatMap((item) => {
			const s = String(item ?? "");
			const idx = s.lastIndexOf(":");
			if (idx <= 0) return [];
			const registroId = s.slice(0, idx);
			const offsetDias = Number(s.slice(idx + 1));
			if (!registroId || !Number.isFinite(offsetDias)) return [];
			return [{ offsetDias, registroId }];
		});
	};
	return { concluidas: decode(fm.concluidas), ignoradas: decode(fm.ignoradas) };
}
