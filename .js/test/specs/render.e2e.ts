import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, expect } from "@wdio/globals";
import { describe, it } from "mocha";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = path.resolve(__dirname, "../../.obsidian/scripts/bundle.js");
// Same path the production snippet reads (relative to the vault root).
const VAULT_BUNDLE_PATH = ".obsidian/scripts/bundle.js";

describe("Dataview JS Snippet", function () {
	before(async function () {
		// Injects the freshly-built bundle into the sandbox vault, at the same
		// path the `$=` snippet expects. We read from disk (Node) and write via
		// the Obsidian API.
		const bundle = await fs.readFile(BUNDLE_PATH, "utf-8");

		await browser.executeObsidian(
			async ({ app }, vaultPath, content) => {
				const adapter = app.vault.adapter;
				const dir = vaultPath.split("/").slice(0, -1).join("/");
				if (dir && !(await adapter.exists(dir))) {
					// Create intermediate directories (.obsidian, .obsidian/scripts)
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

	it("has the Dataview plugin enabled", async function () {
		const dataviewReady = await browser.executeObsidian(({ app }) => {
			// @ts-expect-error internal plugin API
			return !!app.plugins.plugins.dataview;
		});
		expect(dataviewReady).toBe(true);
	});

	it("the bundle evaluates to a function (same path as the snippet)", async function () {
		const result = await browser.executeObsidian(
			async ({ app }, vaultPath) => {
				const source = await app.vault.adapter.read(vaultPath);
				// biome-ignore lint/security/noGlobalEval: mirrors what the `$=` snippet does
				const lib = await eval(source);
				return typeof lib;
			},
			VAULT_BUNDLE_PATH,
		);
		expect(result).toBe("function");
	});

	it("renders index.md without a Dataview error", async function () {
		// Opens the note in read mode so Dataview evaluates the inline `$=`.
		await browser.executeObsidian(async ({ app, obsidian }, filePath) => {
			const file = app.vault.getAbstractFileByPath(filePath);
			if (file instanceof obsidian.TFile) {
				const leaf = app.workspace.getLeaf(false);
				await leaf.openFile(file, { state: { mode: "preview" } });
			}
		}, "index.md");

		// Dataview marks evaluation errors with the `.dataview-error` class.
		const errorEl = browser.$(".dataview-error");
		await expect(errorEl).not.toExist();
	});
});
