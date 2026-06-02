import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { browser, expect } from "@wdio/globals";
import { after, before, describe, it } from "mocha";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = path.resolve(__dirname, "../../dist/todo.js");
const VAULT_BUNDLE_PATH = ".js/dist/todo.js";
const ROOT = "todos";
const INDEX_MD = "`$=const lib = await eval(await app.vault.adapter.read('.js/dist/todo.js'));lib(dv)`\n";
const INDEX_MD_ORIG = "`$=const lib = await eval(await app.vault.adapter.read('.js/dist/bundle.js'));lib(dv)`\n";

/** Lê os checkboxes renderizados pelo TodoApp: `{ label, checked }` por nó.
 *  O TodoApp renderiza dentro de um Shadow DOM, então perfuramos os shadow roots. */
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
			const label =
				root?.querySelector(".mantine-Checkbox-label")?.textContent ?? "";
			return { label, checked: inp.checked };
		});
	});
}

/** Espera até que `pred(labels)` seja verdadeiro, re-lendo o DOM a cada intervalo. */
async function waitForTodos(
	pred: (todos: { label: string; checked: boolean }[]) => boolean,
	message: string,
) {
	await browser.waitUntil(async () => pred(await readTodos()), {
		timeout: 15_000,
		timeoutMsg: message,
	});
}

/** Cria uma pasta-to-do `folderPath` com `index.md` contendo `done`. */
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

/** Cria uma pasta "pelada" (sem `index.md`) — não é um to-do, só uma subpasta. */
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

describe("To-dos aninhados (pasta-por-to-do)", function () {
	before(async function () {
		// Injeta o bundle recém-buildado no mesmo caminho que o snippet `$=` lê.
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

		// Estado limpo e render do index.md em modo leitura.
		await removeRoot();
		await browser.executeObsidian(async ({ app, obsidian }, filePath) => {
			const file = app.vault.getAbstractFileByPath(filePath);
			if (file instanceof obsidian.TFile) {
				const leaf = app.workspace.getLeaf(false);
				await leaf.openFile(file, { state: { mode: "preview" } });
			}
		}, "index.md");

		// Espera o TodoApp montar (input de adicionar presente, dentro do shadow).
		await browser.waitUntil(
			async () =>
				browser.executeObsidian(() => {
					const walk = (node: Document | ShadowRoot): boolean => {
						for (const inp of Array.from(
							node.querySelectorAll<HTMLInputElement>("input"),
						)) {
							if (inp.placeholder.startsWith("Novo to-do")) return true;
						}
						for (const el of Array.from(node.querySelectorAll("*"))) {
							const sr = (el as HTMLElement).shadowRoot;
							if (sr && walk(sr)) return true;
						}
						return false;
					};
					return walk(document);
				}),
			{ timeout: 15_000, timeoutMsg: "TodoApp não montou" },
		);
	});

	after(async function () {
		await removeRoot();
		await browser.executeObsidian(async ({ app }, content) => {
			await app.vault.adapter.write("index.md", content);
		}, INDEX_MD_ORIG);
	});

	it("ignora subpasta sem index.md (não vira nó-fantasma)", async function () {
		// O core lista TODAS as subpastas; é o TodoNode que se auto-oculta quando o
		// próprio index.md não existe. Uma pasta "pelada" não deve aparecer como to-do.
		await makeTodoFolder(`${ROOT}/SeamReal`, false);
		await makeBareFolder(`${ROOT}/SeamGhost`);

		await waitForTodos(
			(t) => t.some((x) => x.label === "SeamReal"),
			'esperava o to-do "SeamReal" (com index.md) aparecer',
		);
		// "SeamGhost" (sem index.md) jamais deve renderizar um checkbox.
		const todos = await readTodos();
		expect(todos.some((x) => x.label === "SeamGhost")).toBe(false);
	});

	it("lista um to-do de topo criado no vault", async function () {
		await makeTodoFolder(`${ROOT}/Comprar`, false);
		await waitForTodos(
			(t) => t.some((x) => x.label === "Comprar" && !x.checked),
			'esperava o checkbox "Comprar" (desmarcado) aparecer',
		);
	});

	it("renderiza filho e neto recursivamente", async function () {
		// `todos/Comprar/Leite` e `todos/Comprar/Leite/Fermento`.
		await makeTodoFolder(`${ROOT}/Comprar/Leite`, false);
		await makeTodoFolder(`${ROOT}/Comprar/Leite/Fermento`, false);

		// O topo só lista filhos de `todos`; "Leite" e "Fermento" só aparecem
		// se a recursão (useSubfolders por nível) estiver funcionando.
		await waitForTodos(
			(t) => {
				const labels = t.map((x) => x.label);
				return (
					labels.includes("Comprar") &&
					labels.includes("Leite") &&
					labels.includes("Fermento")
				);
			},
			'esperava "Leite" e "Fermento" renderizados recursivamente',
		);
	});

	it("reflete mudança de `done` feita por fora", async function () {
		await browser.executeObsidian(async ({ app, obsidian }, fp) => {
			const file = app.vault.getAbstractFileByPath(fp);
			if (file instanceof obsidian.TFile) {
				await app.fileManager.processFrontMatter(file, (fm) => {
					fm.done = true;
				});
			}
		}, `${ROOT}/Comprar/index.md`);

		await waitForTodos(
			(t) => t.some((x) => x.label === "Comprar" && x.checked),
			'esperava "Comprar" ficar marcado após editar o frontmatter',
		);
	});

	it("clicar no checkbox escreve `done` no arquivo (round-trip)", async function () {
		// Clica no checkbox de "Leite" (estava desmarcado) e confirma a escrita.
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
				if (label === "Leite") {
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
				}, `${ROOT}/Comprar/Leite/index.md`);
				return done === true;
			},
			{ timeout: 15_000, timeoutMsg: "esperava done=true gravado em Leite/index.md" },
		);

		await waitForTodos(
			(t) => t.some((x) => x.label === "Leite" && x.checked),
			'esperava o checkbox "Leite" refletir marcado',
		);
	});

	it("exclui em cascata (subárvore some de uma vez)", async function () {
		await browser.executeObsidian(async ({ app }, folder) => {
			const dir = app.vault.getFolderByPath(folder);
			if (dir) await app.fileManager.trashFile(dir);
		}, `${ROOT}/Comprar`);

		// "Comprar" e toda a subárvore (Leite, Fermento) devem sumir.
		await waitForTodos(
			(t) => {
				const labels = t.map((x) => x.label);
				return (
					!labels.includes("Comprar") &&
					!labels.includes("Leite") &&
					!labels.includes("Fermento")
				);
			},
			"esperava a subárvore inteira sumir após exclusão em cascata",
		);
	});
});
