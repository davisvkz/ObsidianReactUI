/**
 * Testa o comportamento do store quando o metadataCache.getCache() retorna null
 * mas o evento "changed" já forneceu o CachedMetadata correto.
 *
 * Cenário real: estudei/index.md é criado mas o Obsidian ainda não indexou o
 * arquivo quando buildFolderFiles é chamado pela primeira vez. O metadataCache
 * dispara "changed" em algum momento, mas pode ser DEPOIS do primeiro flush
 * causado pelos arquivos de sessão — e se getCache() continuar retornando null
 * nesse momento, o nome do plano fica vazio.
 *
 * A correção é guardar o CachedMetadata recebido no callback "changed" (terceiro
 * argumento) e usá-lo como fonte primária em buildSnapshot.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getFolderFiles,
	getSnapshot,
	subscribeFolderFiles,
} from "@/lib/store";

// ---------------------------------------------------------------------------
// Helpers de mock
// ---------------------------------------------------------------------------

type ChangedCb = (
	file: { path: string },
	data: string,
	cache: Record<string, unknown>,
) => void;

function makeApp(overrides?: {
	getCache?: (path: string) => Record<string, unknown> | null;
	folderChildren?: { path: string; name: string }[];
}) {
	const changedListeners: ChangedCb[] = [];

	const app = {
		metadataCache: {
			on: vi.fn((event: string, cb: ChangedCb) => {
				if (event === "changed") changedListeners.push(cb);
				return {};
			}),
			getCache: vi.fn(overrides?.getCache ?? (() => null)),
		},
		vault: {
			on: vi.fn(() => ({})),
			getFolderByPath: vi.fn((folder: string) => {
				if (folder !== "estudei") return null;
				return {
					children: overrides?.folderChildren ?? [
						{ path: "estudei/index.md", name: "index.md" },
					],
				};
			}),
			getAbstractFileByPath: vi.fn((path: string) => ({
				path,
				name: path.split("/").pop(),
			})),
		},
		fireChanged(path: string, data: string, cache: Record<string, unknown>) {
			for (const cb of changedListeners) cb({ path }, data, cache);
		},
	};

	return app as unknown as ReturnType<typeof makeApp>;
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.useFakeTimers();
	// Garante store limpo entre testes (singleton em globalThis)
	delete (globalThis as unknown as Record<string, unknown>).__mdStore__;
});

afterEach(() => {
	vi.useRealTimers();
});

describe("store — lastCache: usa CachedMetadata do evento 'changed'", () => {
	it("getSnapshot reflete frontmatter do evento 'changed' mesmo quando getCache retorna null", () => {
		// getCache sempre retorna null — simula arquivo ainda não indexado
		const app = makeApp({ getCache: () => null });

		// Cria a entrada no cache via subscribe (força ensure)
		const unsub = subscribeFolderFiles(
			app as never,
			"estudei",
			() => {},
			null,
			true,
		);

		// Acessa snapshot (cria entry em files via getSnapshot)
		const snap0 = getSnapshot(app as never, "estudei/index.md");
		expect(snap0.frontmatter).toEqual({}); // ainda vazio

		// Obsidian processa o arquivo e dispara "changed" com o cache completo
		app.fireChanged("estudei/index.md", "---\nnome: Plano PRF\n---\n", {
			frontmatter: { nome: "Plano PRF" },
		});
		vi.advanceTimersByTime(100); // dispara o debounce de 24ms

		// Após flush, snapshot deve ter o nome correto
		const snap1 = getSnapshot(app as never, "estudei/index.md");
		expect(snap1.frontmatter.nome).toBe("Plano PRF");

		unsub();
	});

	it("getFolderFiles reflete frontmatter do evento 'changed' mesmo quando getCache retorna null", () => {
		const app = makeApp({
			getCache: () => null,
			folderChildren: [
				{ path: "estudei/index.md", name: "index.md" },
				{ path: "estudei/Física/registros/sessao.md", name: "sessao.md" },
			],
		});

		// Força criação do entry folderFiles
		const unsub = subscribeFolderFiles(
			app as never,
			"estudei",
			() => {},
			null,
			true,
		);

		// Estado inicial: tudo vazio (getCache retorna null)
		const files0 = getFolderFiles(app as never, "estudei", true);
		expect(files0.find((f) => f.file?.path === "estudei/index.md")?.frontmatter).toEqual({});

		// Sessão indexada (getCache continua null para estudei/index.md)
		app.fireChanged(
			"estudei/Física/registros/sessao.md",
			"---\ntipo: registro\nduracaoMin: 90\n---\n",
			{ frontmatter: { tipo: "registro", duracaoMin: 90 } },
		);
		vi.advanceTimersByTime(100); // primeiro flush (sessão)

		// Plano indexado posteriormente: "changed" com cache correto, mas getCache ainda null
		app.fireChanged("estudei/index.md", "---\nnome: Plano PRF\n---\n", {
			frontmatter: { nome: "Plano PRF" },
		});
		vi.advanceTimersByTime(100); // segundo flush (plano)

		// Após o flush o plano deve aparecer
		const files1 = getFolderFiles(app as never, "estudei", true);
		const plano = files1.find((f) => f.file?.path === "estudei/index.md");
		expect(plano?.frontmatter.nome).toBe("Plano PRF");

		unsub();
	});
});
