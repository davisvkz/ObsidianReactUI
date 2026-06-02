import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, expect } from "@wdio/globals";
import { after, before, describe, it } from "mocha";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = path.resolve(__dirname, "../../dist/bundle.js");
const VAULT_BUNDLE_PATH = ".js/dist/bundle.js";
const ROOT = "estudei";

// ---------------------------------------------------------------------------
// Helpers de acesso ao Shadow DOM

/** Perfura todos os shadow roots e retorna todos os elementos que batem com `selector`. */
function deepQueryAll(selector: string) {
	return browser.executeObsidian((_, sel: string) => {
		const out: Element[] = [];
		const walk = (node: Document | ShadowRoot) => {
			out.push(...Array.from(node.querySelectorAll(sel)));
			for (const el of Array.from(node.querySelectorAll("*"))) {
				const sr = (el as HTMLElement).shadowRoot;
				if (sr) walk(sr);
			}
		};
		walk(document);
		return out.map((el) => ({
			tag: el.tagName.toLowerCase(),
			text: (el as HTMLElement).innerText ?? el.textContent ?? "",
			ariaLabel: (el as HTMLElement).getAttribute("aria-label") ?? "",
		}));
	}, selector);
}

/** Lê os checkboxes de tópico do edital (`.mantine-Checkbox-input`). */
function readTopicCheckboxes() {
	return browser.executeObsidian(() => {
		const out: { label: string; checked: boolean }[] = [];
		const walk = (node: Document | ShadowRoot) => {
			for (const inp of Array.from(
				node.querySelectorAll<HTMLInputElement>("input.mantine-Checkbox-input"),
			)) {
				const root = inp.closest(".mantine-Checkbox-root");
				const label =
					root?.querySelector(".mantine-Checkbox-label")?.textContent ?? "";
				out.push({ label, checked: inp.checked });
			}
			for (const el of Array.from(node.querySelectorAll("*"))) {
				const sr = (el as HTMLElement).shadowRoot;
				if (sr) walk(sr);
			}
		};
		walk(document);
		return out;
	});
}

// ---------------------------------------------------------------------------
// Setup do vault de teste

/** Cria a estrutura básica do estudei com uma disciplina e dois registros. */
async function setupVault() {
	await browser.executeObsidian(async ({ app }, root: string) => {
		// Remove se existir
		const existing = app.vault.getFolderByPath(root);
		if (existing) await app.fileManager.trashFile(existing);

		// Cria plano raiz
		await app.vault.createFolder(root);
		await app.vault.create(
			`${root}/index.md`,
			"---\ntipo: plano\nnome: Plano PRF\nbanca: CESPE\ndataProva: 2027-03-01\n---\n",
		);

		// Cria _config/metas
		await app.vault.createFolder(`${root}/_config`);
		await app.vault.create(
			`${root}/_config/metas.md`,
			"---\ntipo: metas\nhorasSemanaisAlvo: 25\nquestoesSemanaisAlvo: 500\n---\n",
		);

		// Disciplina Física
		await app.vault.createFolder(`${root}/Física`);
		await app.vault.create(
			`${root}/Física/index.md`,
			[
				"---",
				"tipo: disciplina",
				"nome: Física",
				"cor: '#4C6EF5'",
				"peso: 2",
				"topicos:",
				"  - id: '1'",
				"    titulo: 'Cinemática'",
				"    nivel: 1",
				"    concluido: false",
				"    acertos: 0",
				"    erros: 0",
				"    ultimoEstudo: null",
				"    materiais: []",
				"  - id: '2'",
				"    titulo: 'Dinâmica'",
				"    nivel: 1",
				"    concluido: false",
				"    acertos: 5",
				"    erros: 2",
				"    ultimoEstudo: '2026-06-01'",
				"    materiais: []",
				"---\n",
			].join("\n"),
		);

		// Registros de estudo
		await app.vault.createFolder(`${root}/Física/registros`);
		await app.vault.create(
			`${root}/Física/registros/2026-06-01-0900.md`,
			[
				"---",
				"tipo: registro",
				"data: '2026-06-01'",
				"inicio: '09:00'",
				"categoria: TEORIA",
				"duracaoMin: 90",
				"topicoId: '1'",
				"acertos: 12",
				"erros: 3",
				"paginasLidas: 15",
				"videos: 0",
				"geraRevisao: true",
				"---\n",
			].join("\n"),
		);
		await app.vault.create(
			`${root}/Física/registros/2026-06-01-1400.md`,
			[
				"---",
				"tipo: registro",
				"data: '2026-06-01'",
				"inicio: '14:00'",
				"categoria: QUESTOES",
				"duracaoMin: 60",
				"topicoId: '2'",
				"acertos: 5",
				"erros: 2",
				"paginasLidas: 0",
				"videos: 0",
				"geraRevisao: false",
				"---\n",
			].join("\n"),
		);
	}, ROOT);
}

// ---------------------------------------------------------------------------
// Spec

describe("EstudeiApp — Home + Edital (e2e)", function () {
	before(async function () {
		// Injeta o bundle recém-buildado
		const bundle = await fs.readFile(BUNDLE_PATH, "utf-8");
		await browser.executeObsidian(
			async ({ app }, vaultPath: string, content: string) => {
				const adapter = app.vault.adapter;
				const dir = vaultPath.split("/").slice(0, -1).join("/");
				if (dir) {
					const parts = dir.split("/");
					let acc = "";
					for (const part of parts) {
						acc = acc ? `${acc}/${part}` : part;
						if (!(await adapter.exists(acc))) await adapter.mkdir(acc);
					}
				}
				await adapter.write(vaultPath, content);
			},
			VAULT_BUNDLE_PATH,
			bundle,
		);

		// Monta o vault de teste
		await setupVault();

		// Abre index.md em preview
		await browser.executeObsidian(async ({ app, obsidian }) => {
			const file = app.vault.getAbstractFileByPath("index.md");
			if (file instanceof obsidian.TFile) {
				const leaf = app.workspace.getLeaf(false);
				await leaf.openFile(file, { state: { mode: "preview" } });
			}
		});

		// Aguarda o app montar (tabs Home/Início devem aparecer)
		await browser.waitUntil(
			async () => {
				const tabs = await deepQueryAll("[data-value='home']");
				return tabs.length > 0;
			},
			{ timeout: 15_000, timeoutMsg: "EstudeiApp não montou — tab Home não apareceu" },
		);
	});

	after(async function () {
		await browser.executeObsidian(async ({ app }, root: string) => {
			const folder = app.vault.getFolderByPath(root);
			if (folder) await app.fileManager.trashFile(folder);
		}, ROOT);
	});

	// ---------------------------------------------------------------------------

	it("renderiza as abas Home e Edital", async function () {
		const tabs = await deepQueryAll("[role='tab']");
		const labels = tabs.map((t) => t.text.toLowerCase().trim());
		expect(labels.some((l) => l.includes("início") || l.includes("home"))).toBe(true);
		expect(labels.some((l) => l.includes("edital"))).toBe(true);
	});

	it("Home exibe o nome do plano ('Plano PRF')", async function () {
		await browser.waitUntil(
			async () => {
				const badges = await deepQueryAll(".mantine-Badge-root");
				return badges.some((b) => b.text.includes("Plano PRF"));
			},
			{ timeout: 15_000, timeoutMsg: "Badge 'Plano PRF' não apareceu na Home" },
		);
	});

	it("Home exibe tempo de estudo acumulado dos registros", async function () {
		// 90 + 60 = 150 min = 2h30min
		await browser.waitUntil(
			async () => {
				const texts = await deepQueryAll(".mantine-Card-root");
				return texts.some((t) => t.text.includes("2h30min"));
			},
			{ timeout: 15_000, timeoutMsg: "'2h30min' não apareceu no card de tempo" },
		);
	});

	it("Edital exibe tópicos da disciplina Física", async function () {
		// Clica na aba Edital
		await browser.executeObsidian(() => {
			const walk = (node: Document | ShadowRoot) => {
				for (const tab of Array.from(node.querySelectorAll("[role='tab']"))) {
					if ((tab as HTMLElement).innerText?.toLowerCase().includes("edital")) {
						(tab as HTMLElement).click();
						return true;
					}
				}
				for (const el of Array.from(node.querySelectorAll("*"))) {
					const sr = (el as HTMLElement).shadowRoot;
					if (sr && walk(sr)) return true;
				}
				return false;
			};
			walk(document);
		});

		// Aguarda os checkboxes de tópico
		await browser.waitUntil(
			async () => {
				const cbs = await readTopicCheckboxes();
				return cbs.some((c) => c.label.includes("Cinemática"));
			},
			{ timeout: 15_000, timeoutMsg: "Tópico 'Cinemática' não apareceu no Edital" },
		);
	});

	it("marcar tópico no Edital escreve 'concluido: true' no arquivo (round-trip)", async function () {
		// Clica no checkbox do tópico "Cinemática"
		await browser.executeObsidian(() => {
			const walk = (node: Document | ShadowRoot) => {
				for (const root of Array.from(
					node.querySelectorAll(".mantine-Checkbox-root"),
				)) {
					const label = root.querySelector(".mantine-Checkbox-label")?.textContent;
					if (label?.includes("Cinemática")) {
						root.querySelector<HTMLInputElement>("input")?.click();
						return true;
					}
				}
				for (const el of Array.from(node.querySelectorAll("*"))) {
					const sr = (el as HTMLElement).shadowRoot;
					if (sr && walk(sr)) return true;
				}
				return false;
			};
			walk(document);
		});

		// Verifica que o frontmatter foi gravado
		await browser.waitUntil(
			async () => {
				const concluido = await browser.executeObsidian(
					async ({ app }, fp: string) => {
						const file = app.vault.getAbstractFileByPath(fp);
						// biome-ignore lint: obsidian cache types
						return file
							// @ts-expect-error getFileCache
							? app.metadataCache.getFileCache(file)?.frontmatter?.topicos?.[0]
								  ?.concluido
							: null;
					},
					`${ROOT}/Física/index.md`,
				);
				return concluido === true;
			},
			{
				timeout: 15_000,
				timeoutMsg: "esperava topicos[0].concluido=true no arquivo",
			},
		);

		// Checkbox deve refletir estado marcado na UI
		await browser.waitUntil(
			async () => {
				const cbs = await readTopicCheckboxes();
				return cbs.some((c) => c.label.includes("Cinemática") && c.checked);
			},
			{
				timeout: 15_000,
				timeoutMsg: "checkbox 'Cinemática' não ficou checked",
			},
		);
	});
});
