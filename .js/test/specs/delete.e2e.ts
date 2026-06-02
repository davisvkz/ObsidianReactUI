import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, expect } from "@wdio/globals";
import { after, before, beforeEach, describe, it } from "mocha";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = path.resolve(__dirname, "../../dist/todo.js");
const VAULT_BUNDLE_PATH = ".js/dist/todo.js";
const ROOT = "todos";
const INDEX_MD = "`$=const lib = await eval(await app.vault.adapter.read('.js/dist/todo.js'));lib(dv)`\n";
const INDEX_MD_ORIG = "`$=const lib = await eval(await app.vault.adapter.read('.js/dist/bundle.js'));lib(dv)`\n";

/** Lê os checkboxes do TodoApp perfurando os shadow roots. */
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
			const label =
				root?.querySelector(".mantine-Checkbox-label")?.textContent ?? "";
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

/** Clica no botão de ação (por aria-label) da linha cujo checkbox tem `label`. */
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

describe("Exclusão reflete na UI", function () {
	before(async function () {
		const bundle = await fs.readFile(BUNDLE_PATH, "utf-8");
		await browser.executeObsidian(
			async ({ app }, vaultPath, content, indexContent) => {
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
				await adapter.write("index.md", indexContent);
			},
			VAULT_BUNDLE_PATH,
			bundle,
			INDEX_MD,
		);
		await browser.executeObsidian(async ({ app, obsidian }, filePath) => {
			const file = app.vault.getAbstractFileByPath(filePath);
			if (file instanceof obsidian.TFile) {
				await app.workspace.getLeaf(false).openFile(file, {
					state: { mode: "preview" },
				});
			}
		}, "index.md");
	});

	beforeEach(async function () {
		await removeRoot();
		// Árvore: Comprar > (Leite, Pão > Fermento)
		await makeTodoFolder(`${ROOT}/Comprar`, false);
		await makeTodoFolder(`${ROOT}/Comprar/Leite`, false);
		await makeTodoFolder(`${ROOT}/Comprar/Pao`, false);
		await makeTodoFolder(`${ROOT}/Comprar/Pao/Fermento`, false);
		await waitForTodos(
			(t) => ["Comprar", "Leite", "Pao", "Fermento"].every((n) =>
				t.some((x) => x.label === n),
			),
			"árvore inicial não renderizou",
		);
	});

	after(async function () {
		await removeRoot();
		await browser.executeObsidian(async ({ app }, content) => {
			await app.vault.adapter.write("index.md", content);
		}, INDEX_MD_ORIG);
	});

	it("remove nó aninhado ao excluir manualmente (vault)", async function () {
		await browser.executeObsidian(async ({ app }, folder) => {
			const dir = app.vault.getFolderByPath(folder);
			if (dir) await app.fileManager.trashFile(dir);
		}, `${ROOT}/Comprar/Leite`);

		await waitForTodos(
			(t) => !t.some((x) => x.label === "Leite") && t.some((x) => x.label === "Comprar"),
			'"Leite" deveria sumir após exclusão manual',
		);
	});

	it("remove nó aninhado ao clicar na lixeira (interface)", async function () {
		const clicked = await clickNodeAction("Pao", "excluir");
		expect(clicked).toBe(true);

		await waitForTodos(
			(t) =>
				!t.some((x) => x.label === "Pao") &&
				!t.some((x) => x.label === "Fermento") &&
				t.some((x) => x.label === "Comprar"),
			'"Pao" e "Fermento" deveriam sumir após clique na lixeira',
		);
	});

	it("remove nó de topo ao clicar na lixeira (interface)", async function () {
		const clicked = await clickNodeAction("Comprar", "excluir");
		expect(clicked).toBe(true);

		await waitForTodos(
			(t) => t.length === 0,
			"a árvore inteira deveria sumir ao excluir o nó de topo",
		);
	});

	it("remove nó ao excluir só a nota index.md (leaf)", async function () {
		// Cenário "manual": deletar a nota do to-do (não a pasta) deve sumir o nó.
		await browser.executeObsidian(async ({ app, obsidian }, fp) => {
			const file = app.vault.getAbstractFileByPath(fp);
			if (file instanceof obsidian.TFile) await app.fileManager.trashFile(file);
		}, `${ROOT}/Comprar/Leite/index.md`);

		await waitForTodos(
			(t) => !t.some((x) => x.label === "Leite") && t.some((x) => x.label === "Comprar"),
			'"Leite" deveria sumir ao deletar sua nota index.md',
		);
	});

	it("remove subárvore ao excluir a nota index.md de um nó-pai", async function () {
		await browser.executeObsidian(async ({ app, obsidian }, fp) => {
			const file = app.vault.getAbstractFileByPath(fp);
			if (file instanceof obsidian.TFile) await app.fileManager.trashFile(file);
		}, `${ROOT}/Comprar/Pao/index.md`);

		await waitForTodos(
			(t) =>
				!t.some((x) => x.label === "Pao") &&
				!t.some((x) => x.label === "Fermento") &&
				t.some((x) => x.label === "Comprar"),
			'"Pao" e seu filho deveriam sumir ao deletar a nota do pai',
		);
	});

	it("remove nó aninhado com lixeira local (.trash)", async function () {
		// Reproduz o cenário do usuário: com `trashOption=local`, o evento de exclusão
		// chega com o arquivo já destacado do pai (file.parent === null).
		await browser.executeObsidian(({ app }) => {
			(app.vault as unknown as {
				setConfig(k: string, v: string): void;
			}).setConfig("trashOption", "local");
		});

		await browser.executeObsidian(async ({ app }, folder) => {
			const dir = app.vault.getFolderByPath(folder);
			if (dir) await app.fileManager.trashFile(dir);
		}, `${ROOT}/Comprar/Leite`);

		await waitForTodos(
			(t) =>
				!t.some((x) => x.label === "Leite") && t.some((x) => x.label === "Comprar"),
			'"Leite" deveria sumir mesmo com lixeira local',
		);
	});

	after(async function () {
		// Restaura a lixeira do sistema e limpa o `.trash` local criado nos testes.
		await browser.executeObsidian(async ({ app }) => {
			(app.vault as unknown as {
				setConfig(k: string, v: string): void;
			}).setConfig("trashOption", "system");
			if (await app.vault.adapter.exists(".trash"))
				await app.vault.adapter.rmdir(".trash", true);
		});
	});
});
