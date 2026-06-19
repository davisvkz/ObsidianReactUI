import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, expect } from "@wdio/globals";
import { after, before, describe, it } from "mocha";

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
					if ((el as HTMLElement).shadowRoot)
						walk((el as HTMLElement).shadowRoot as ShadowRoot);
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
		{ timeout: 10_000, timeoutMsg: "expected the home page (input 'New to-do') to appear" },
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
					if ((node as Document | ShadowRoot).querySelector?.('[aria-label="back"]')) return true;
					for (const el of Array.from(node.querySelectorAll("*"))) {
						const sr = (el as HTMLElement).shadowRoot;
						if (sr && walk(sr)) return true;
					}
					return false;
				};
				return walk(document);
			}),
		{ timeout: 10_000, timeoutMsg: "expected the detail page (button 'back') to appear" },
	);
}

/** Clicks the "back" button to return to home. */
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
				if (!app.vault.getAbstractFileByPath(acc)) {
					await app.vault.createFolder(acc);
				}
			}
			await app.vault.create(`${fp}/index.md`, `---\ndone: ${isDone}\n---\n`);
		},
		folderPath,
		done,
	);
}

function makeBareFolder(folderPath: string) {
	return browser.executeObsidian(async ({ app }, fp) => {
		const parts = fp.split("/");
		let acc = "";
		for (const part of parts) {
			acc = acc ? `${acc}/${part}` : part;
			if (!app.vault.getAbstractFileByPath(acc)) {
				await app.vault.createFolder(acc);
			}
		}
	}, folderPath);
}

function removeRoot() {
	return browser.executeObsidian(async ({ app }, root) => {
		if (await app.vault.adapter.exists(root)) {
			await app.vault.adapter.rmdir(root, true);
		}
	}, ROOT);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Nested to-dos (folder-per-todo)", function () {
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

		await removeRoot();
		await browser.executeObsidian(async ({ app, obsidian }, filePath) => {
			const file = app.vault.getAbstractFileByPath(filePath);
			if (file instanceof obsidian.TFile) {
				const leaf = app.workspace.getLeaf(false);
				await leaf.openFile(file, { state: { mode: "preview" } });
			}
		}, "index.md");

		await waitForHome();
	});

	after(async function () {
		await removeRoot();
	});

	it("ignores a subfolder without index.md (does not become a ghost node)", async function () {
		await makeTodoFolder(`${ROOT}/SeamReal`, false);
		await makeBareFolder(`${ROOT}/SeamGhost`);

		await waitForTodos(
			(t) => t.some((x) => x.label === "SeamReal"),
			'expected the to-do "SeamReal" to appear',
		);
		const todos = await readTodos();
		expect(todos.some((x) => x.label === "SeamGhost")).toBe(false);
	});

	it("lists a top-level to-do created in the vault", async function () {
		await makeTodoFolder(`${ROOT}/Buy`, false);
		await waitForTodos(
			(t) => t.some((x) => x.label === "Buy" && !x.checked),
			'expected the checkbox "Buy" (unchecked) to appear',
		);
	});

	it("renders subtasks recursively on the detail page", async function () {
		await makeTodoFolder(`${ROOT}/Buy/Milk`, false);
		await makeTodoFolder(`${ROOT}/Buy/Milk/Yeast`, false);

		await navigateToDetail("Buy");
		await waitForDetail();

		await waitForTodos(
			(t) => {
				const labels = t.map((x) => x.label);
				return labels.includes("Milk") && labels.includes("Yeast");
			},
			'expected "Milk" and "Yeast" to render on the detail page',
		);

		await navigateBack();
		await waitForHome();
	});

	it("reflects a `done` change made externally (home)", async function () {
		await browser.executeObsidian(async ({ app, obsidian }, fp) => {
			const file = app.vault.getAbstractFileByPath(fp);
			if (file instanceof obsidian.TFile) {
				await app.fileManager.processFrontMatter(file, (fm) => {
					fm.done = true;
				});
			}
		}, `${ROOT}/Buy/index.md`);

		await waitForTodos(
			(t) => t.some((x) => x.label === "Buy" && x.checked),
			'expected "Buy" to become checked after editing the frontmatter',
		);
	});

	it("clicking a subtask checkbox writes `done` to the file (round-trip)", async function () {
		await navigateToDetail("Buy");
		await waitForDetail();
		await waitForTodos(
			(t) => t.some((x) => x.label === "Milk"),
			'"Milk" must appear on the detail page',
		);

		await browser.executeObsidian(() => {
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
				const label = root.querySelector(".mantine-Checkbox-label")?.textContent;
				if (label === "Milk") {
					root.querySelector<HTMLInputElement>("input")?.click();
					return;
				}
			}
		});

		await browser.waitUntil(
			async () => {
				const done = await browser.executeObsidian(async ({ app }, fp) => {
					const file = app.vault.getAbstractFileByPath(fp);
					// @ts-expect-error TFile path
					return file ? app.metadataCache.getFileCache(file)?.frontmatter?.done : null;
				}, `${ROOT}/Buy/Milk/index.md`);
				return done === true;
			},
			{ timeout: 15_000, timeoutMsg: "expected done=true written to Milk/index.md" },
		);

		await waitForTodos(
			(t) => t.some((x) => x.label === "Milk" && x.checked),
			'expected the "Milk" checkbox to reflect as checked',
		);

		await navigateBack();
		await waitForHome();
	});

	it("deletes the top-level to-do (and the entire subtree disappears from the vault)", async function () {
		await browser.executeObsidian(async ({ app }, folder) => {
			const dir = app.vault.getFolderByPath(folder);
			if (dir) await app.fileManager.trashFile(dir);
		}, `${ROOT}/Buy`);

		await waitForTodos(
			(t) => !t.some((x) => x.label === "Buy"),
			'expected "Buy" to disappear from home after deletion',
		);
	});
});
