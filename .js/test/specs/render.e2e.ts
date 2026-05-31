import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, expect } from "@wdio/globals";
import { describe, it } from "mocha";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = path.resolve(__dirname, "../../dist/bundle.js");
// Mesmo caminho que o snippet de produção lê (relativo à raiz do vault).
const VAULT_BUNDLE_PATH = ".js/dist/bundle.js";

describe("Snippet Dataview JS", function () {
	before(async function () {
		// Injeta o bundle recém-buildado no vault sandbox, no mesmo caminho que o
		// snippet `$=` espera. Lemos do disco (Node) e gravamos via API do Obsidian.
		const bundle = await fs.readFile(BUNDLE_PATH, "utf-8");

		await browser.executeObsidian(
			async ({ app }, vaultPath, content) => {
				const adapter = app.vault.adapter;
				const dir = vaultPath.split("/").slice(0, -1).join("/");
				if (dir && !(await adapter.exists(dir))) {
					// cria as pastas intermediárias (.js, .js/dist)
					const parts = dir.split("/");
					let acc = "";
					for (const part of parts) {
						acc = acc ? `${acc}/${part}` : part;
						if (!(await adapter.exists(acc))) {
							await adapter.mkdir(acc);
						}
					}
				}
				await adapter.write(vaultPath, content);
			},
			VAULT_BUNDLE_PATH,
			bundle,
		);
	});

	it("tem o plugin Dataview habilitado", async function () {
		const dataviewReady = await browser.executeObsidian(({ app }) => {
			// @ts-expect-error API interna de plugins
			return !!app.plugins.plugins.dataview;
		});
		expect(dataviewReady).toBe(true);
	});

	it("o bundle avalia para uma função (mesmo caminho do snippet)", async function () {
		const result = await browser.executeObsidian(
			async ({ app }, vaultPath) => {
				const source = await app.vault.adapter.read(vaultPath);
				// biome-ignore lint/security/noGlobalEval: espelha o que o snippet `$=` faz
				const lib = await eval(source);
				return typeof lib;
			},
			VAULT_BUNDLE_PATH,
		);
		expect(result).toBe("function");
	});

	it("renderiza index.md sem erro do Dataview", async function () {
		// Abre o note em modo leitura para o Dataview avaliar o inline `$=`.
		await browser.executeObsidian(async ({ app, obsidian }, filePath) => {
			const file = app.vault.getAbstractFileByPath(filePath);
			if (file instanceof obsidian.TFile) {
				const leaf = app.workspace.getLeaf(false);
				await leaf.openFile(file, { state: { mode: "preview" } });
			}
		}, "index.md");

		// Dataview marca erros de avaliação com a classe `.dataview-error`.
		const errorEl = browser.$(".dataview-error");
		await expect(errorEl).not.toExist();
	});
});
