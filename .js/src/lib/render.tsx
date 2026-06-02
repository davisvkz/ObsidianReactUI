import type { Root } from "react-dom/client";
import { createContext } from "react";
import { createRoot } from "react-dom/client";
import type React from "react";

/** O `App` do Obsidian, disponibilizado a toda a árvore React. */
export const AppContext = createContext<import("obsidian").App | null>(null);

/**
 * O nó de montagem do shadow root (o `<div>` imediatamente dentro do shadow),
 * usado como `host` para a poda de assinantes órfãos nos hooks reativos.
 * Disponibilizado automaticamente por `mountShadowReact`.
 */
export const HostContext = createContext<Node | null>(null);

/**
 * Primitiva genérica de montagem shadow-DOM + React.
 *
 * - Desmonta o root anterior (`window.__mdRoot__`) para garantir que os cleanups
 *   de efeitos rodem mesmo quando o Dataview troca o container sem desmontar React.
 * - Cria um `host > shadow > mount` e injeta `__STYLE__` (CSS inlined pelo build).
 * - Expõe o `mount` via `HostContext` para que os hooks usem como sentinela de
 *   assinante órfão (`mount.isConnected === false` após o Dataview remover o container).
 * - `renderTree(mount)` deve retornar o `ReactNode` a renderizar — recebe o `mount`
 *   para que wrappers externos (ex: MantineProvider) possam referenciar o elemento.
 */
export function mountShadowReact(
	container: HTMLElement,
	renderTree: (mount: HTMLElement) => React.ReactNode,
): HTMLElement {
	const w = window as unknown as { __mdRoot__?: Root };
	if (w.__mdRoot__) {
		try {
			w.__mdRoot__.unmount();
		} catch {
			/* root já desmontado */
		}
	}

	container.innerHTML = "";
	const host = document.createElement("div");
	container.appendChild(host);
	const shadow = host.attachShadow({ mode: "open" });

	const style = document.createElement("style");
	style.textContent = __STYLE__;
	shadow.appendChild(style);

	// `mount` é o `:host>div` para onde os seletores CSS transformados apontam.
	const mount = document.createElement("div");
	shadow.appendChild(mount);

	const root = createRoot(mount);
	w.__mdRoot__ = root;
	root.render(
		<HostContext.Provider value={mount}>
			{renderTree(mount)}
		</HostContext.Provider>,
	);

	return container;
}
