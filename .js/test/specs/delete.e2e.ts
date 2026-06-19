import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, expect } from "@wdio/globals";
import { after, before, beforeEach, describe, it } from "mocha";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = path.resolve(__dirname, "../../.obsidian/scripts/bundle.js");
const VAULT_BUNDLE_PATH = ".obsidian/scripts/bundle.js";
const ROOT = "todos";

// ---------------------------------------------------------------------------
// DOM helpers (pierce shadow roots)
// ---------------------------------------------------------------------------

function readTodos() {
	return browser.executeObsidian(() => {
		const deepQueryAll = (selector: string): Element[] => {
			const out: Element[] = [];
			const walk = (node: Document | ShadowRoot) => {
				out.push(...Array.from(node.querySelectorAll(selector)));
				for (const el of Array.from(node.querySelectorAll("*"))) {
					const sr = (el as HTMLElement).shadowRoot;
					if (sr) walk(sr);
				}
			};
			walk(document);
			return out;
		};
		return deepQueryAll("input.mantine-Checkbox-input").map((el) => {
			const inp = el as HTMLInputElement;
			const root = inp.closest(".mantine-Checkbox-root");
			const label = root?.querySelector(".mantine-Checkbox-label")?.textContent ?? "";
			return { label, checked: inp.checked };
		});
	});
}

async function waitForTodos(
	pred: (todos: { label: string; checked: boolean }[]) => boolean,
	message: string,
) {
	await browser.waitUntil(async () => pred(await readTodos()), {
		timeout: 15_000,
		timeoutMsg: message,
	});
}

/** Clicks the action button (by aria-label) on the row whose checkbox has `label`. */
function clickNodeAction(label: string, ariaLabel: string) {
	return browser.executeObsidian(
		(_obs, nodeLabel, aria) => {
			const roots: Element[] = [];
			const walk = (node: Document | ShadowRoot) => {
				roots.push(...Array.from(node.querySelectorAll(".mantine-Checkbox-root")));
				for (const el of Array.from(node.querySelectorAll("*"))) {
					const sr = (el as HTMLElement).shadowRoot;
					if (sr) walk(sr);
				}
			};
			walk(document);
			for (const root of roots) {
				const text = root.querySelector(".mantine-Checkbox-label")?.textContent;
				if (text === nodeLabel) {
					const row = root.parentElement;
					const btn = row?.querySelector<HTMLElement>(`[aria-label="${aria}"]`);
					btn?.click();
					return Boolean(btn);
				}
			}
			return false;
		},
		label,
		ariaLabel,
	);
}

/** Clicks the "view subtasks" button on the row with `label`. */
function navigateToDetail(label: string) {
	return browser.executeObsidian(
		(_obs, nodeLabel) => {
			const roots: Element[] = [];
			const walk = (node: Document | ShadowRoot) => {
				roots.push(...Array.from(node.querySelectorAll(".mantine-Checkbox-root")));
				for (const el of Array.from(node.querySelectorAll("*"))) {
					const sr = (el as HTMLElement).shadowRoot;
					if (sr) walk(sr);
				}
			};
			walk(document);
			for (const root of roots) {
				const text = root.querySelector(".mantine-Checkbox-label")?.textContent;
				if (text === nodeLabel) {
					const row = root.parentElement;
					const btn = row?.querySelector<HTMLElement>('[aria-label="view subtasks"]');
					btn?.click();
					return Boolean(btn);
				}
			}
			return false;
		},
		label,
	);
}

/** Waits for the detail page (the "back" button is present). */
async function waitForDetail() {
	await browser.waitUntil(
		async () =>
			browser.executeObsidian(() => {
				const walk = (node: Document | ShadowRoot): boolean => {
					if ((node as ShadowRoot).querySelector?.('[aria-label="back"]')) return true;
					for (const el of Array.from(node.querySelectorAll("*"))) {
						const sr = (el as HTMLElement).shadowRoot;
						if (sr && walk(sr)) return true;
					}
					return false;
				};
				return walk(document);
			}),
		{ timeout: 10_000, timeoutMsg: "expected the detail page to appear" },
	);
}

/** Clicks the "back" button to return to home. No-op if already on home. */
function navigateBack() {
	return browser.executeObsidian(() => {
		const walk = (node: Document | ShadowRoot): boolean => {
			const btn = (node as ShadowRoot).querySelector?.<HTMLElement>('[aria-label="back"]');
			if (btn) { btn.click(); return true; }
			for (const el of Array.from(node.querySelectorAll("*"))) {
				const sr = (el as HTMLElement).shadowRoot;
				if (sr && walk(sr)) return true;
			}
			return false;
		};
		walk(document);
	});
}

/** Waits for the "New to-do" input to appear (we are on home). */
async function waitForHome() {
	await browser.waitUntil(
		async () =>
			browser.executeObsidian(() => {
				const walk = (node: Document | ShadowRoot): boolean => {
					for (const inp of Array.from(node.querySelectorAll<HTMLInputElement>("input"))) {
						if (inp.placeholder.startsWith("New to-do")) return true;
					}
					for (const el of Array.from(node.querySelectorAll("*"))) {
						const sr = (el as HTMLElement).shadowRoot;
						if (sr && walk(sr)) return true;
					}
					return false;
				};
				return walk(document);
			}),
		{ timeout: 10_000, timeoutMsg: "expected the home page to appear" },
	);
}

// ---------------------------------------------------------------------------
// Vault helpers
// ---------------------------------------------------------------------------

function makeTodoFolder(folderPath: string, done: boolean) {
	return browser.executeObsidian(
		async ({ app }, fp, isDone) => {
			const parts = fp.split("/");
			let acc = "";
			for (const part of parts) {
				acc = acc ? `${acc}/${part}` : part;
				if (!app.vault.getAbstractFileByPath(acc)) await app.vault.createFolder(acc);
			}
			await app.vault.create(`${fp}/index.md`, `---\ndone: ${isDone}\n---\n`);
		},
		folderPath,
		done,
	);
}

function removeRoot() {
	return browser.executeObsidian(async ({ app }, root) => {
		if (await app.vault.adapter.exists(root)) await app.vault.adapter.rmdir(root, true);
	}, ROOT);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Deletion reflects in the UI", function () {
	before(async function () {
		const bundle = await fs.readFile(BUNDLE_PATH, "utf-8");
		await browser.executeObsidian(
			async ({ app }, vaultPath, content) => {
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
		await browser.executeObsidian(async ({ app, obsidian }, filePath) => {
			const file = app.vault.getAbstractFileByPath(filePath);
			if (file instanceof obsidian.TFile) {
				await app.workspace.getLeaf(false).openFile(file, {
					state: { mode: "preview" },
				});
			}
		}, "index.md");
		await waitForHome();
	});

	beforeEach(async function () {
		await navigateBack();
		await removeRoot();
		// Tree: Buy > (Milk, Bread > Yeast)
		await makeTodoFolder(`${ROOT}/Buy`, false);
		await makeTodoFolder(`${ROOT}/Buy/Milk`, false);
		await makeTodoFolder(`${ROOT}/Buy/Bread`, false);
		await makeTodoFolder(`${ROOT}/Buy/Bread/Yeast`, false);
		await waitForTodos(
			(t) => t.some((x) => x.label === "Buy"),
			"to-do Buy did not appear on home",
		);
	});

	after(async function () {
		await navigateBack();
		await removeRoot();
		// Restore system trash and clean up any local `.trash` created during tests.
		await browser.executeObsidian(async ({ app }) => {
			(app.vault as unknown as { setConfig(k: string, v: string): void }).setConfig(
				"trashOption",
				"system",
			);
			if (await app.vault.adapter.exists(".trash"))
				await app.vault.adapter.rmdir(".trash", true);
		});
	});

	it("removes a nested node when deleted manually (vault)", async function () {
		await navigateToDetail("Buy");
		await waitForDetail();
		await waitForTodos(
			(t) => t.some((x) => x.label === "Milk"),
			'"Milk" should appear on the detail page',
		);

		await browser.executeObsidian(async ({ app }, folder) => {
			const dir = app.vault.getFolderByPath(folder);
			if (dir) await app.fileManager.trashFile(dir);
		}, `${ROOT}/Buy/Milk`);

		await waitForTodos(
			(t) => !t.some((x) => x.label === "Milk") && t.some((x) => x.label === "Buy"),
			'"Milk" should disappear after manual deletion',
		);
	});

	it("removes a nested node when the trash icon is clicked (UI)", async function () {
		await navigateToDetail("Buy");
		await waitForDetail();
		await waitForTodos(
			(t) => t.some((x) => x.label === "Bread"),
			'"Bread" should appear on the detail page',
		);

		const clicked = await clickNodeAction("Bread", "delete");
		expect(clicked).toBe(true);

		await waitForTodos(
			(t) =>
				!t.some((x) => x.label === "Bread") &&
				!t.some((x) => x.label === "Yeast") &&
				t.some((x) => x.label === "Buy"),
			'"Bread" and "Yeast" should disappear after clicking the trash icon',
		);
	});

	it("removes a top-level node when the trash icon is clicked (home)", async function () {
		const clicked = await clickNodeAction("Buy", "delete");
		expect(clicked).toBe(true);

		await waitForTodos(
			(t) => t.length === 0,
			"the entire tree should disappear when the top-level node is deleted",
		);
	});

	it("removes a node when only its index.md note is deleted (leaf)", async function () {
		await navigateToDetail("Buy");
		await waitForDetail();
		await waitForTodos(
			(t) => t.some((x) => x.label === "Milk"),
			'"Milk" should appear on the detail page',
		);

		await browser.executeObsidian(async ({ app, obsidian }, fp) => {
			const file = app.vault.getAbstractFileByPath(fp);
			if (file instanceof obsidian.TFile) await app.fileManager.trashFile(file);
		}, `${ROOT}/Buy/Milk/index.md`);

		await waitForTodos(
			(t) => !t.some((x) => x.label === "Milk") && t.some((x) => x.label === "Buy"),
			'"Milk" should disappear when its index.md note is deleted',
		);
	});

	it("removes a subtree when the index.md of a parent node is deleted", async function () {
		await navigateToDetail("Buy");
		await waitForDetail();
		await waitForTodos(
			(t) => t.some((x) => x.label === "Bread"),
			'"Bread" should appear on the detail page',
		);

		await browser.executeObsidian(async ({ app, obsidian }, fp) => {
			const file = app.vault.getAbstractFileByPath(fp);
			if (file instanceof obsidian.TFile) await app.fileManager.trashFile(file);
		}, `${ROOT}/Buy/Bread/index.md`);

		await waitForTodos(
			(t) =>
				!t.some((x) => x.label === "Bread") &&
				!t.some((x) => x.label === "Yeast") &&
				t.some((x) => x.label === "Buy"),
			'"Bread" and its child should disappear when the parent note is deleted',
		);
	});

	it("removes a nested node with local trash (.trash)", async function () {
		await navigateToDetail("Buy");
		await waitForDetail();
		await waitForTodos(
			(t) => t.some((x) => x.label === "Milk"),
			'"Milk" should appear on the detail page',
		);

		// Reproduces the scenario: with `trashOption=local`, the delete event
		// arrives with the file already detached from its parent (file.parent === null).
		await browser.executeObsidian(({ app }) => {
			(app.vault as unknown as { setConfig(k: string, v: string): void }).setConfig(
				"trashOption",
				"local",
			);
		});

		await browser.executeObsidian(async ({ app }, folder) => {
			const dir = app.vault.getFolderByPath(folder);
			if (dir) await app.fileManager.trashFile(dir);
		}, `${ROOT}/Buy/Milk`);

		await waitForTodos(
			(t) => !t.some((x) => x.label === "Milk") && t.some((x) => x.label === "Buy"),
			'"Milk" should disappear even with local trash',
		);
	});
});
