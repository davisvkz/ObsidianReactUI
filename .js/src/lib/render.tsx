import type React from "react";
import { createContext } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";

/** The Obsidian `App`, made available to the entire React tree. */
export const AppContext = createContext<import("obsidian").App | null>(null);

/**
 * The shadow root mount node (the `<div>` immediately inside the shadow),
 * used as `host` for pruning orphaned subscribers in the reactive hooks.
 * Provided automatically by `mountShadowReact`.
 */
export const HostContext = createContext<Node | null>(null);

/**
 * Generic shadow-DOM + React mount primitive.
 *
 * - Unmounts the previous root (`window.__mdRoot__`) to ensure effect cleanups
 *   run even when Dataview swaps the container without unmounting React.
 * - Creates a `host > shadow > mount` and injects `__STYLE__` (CSS inlined by the build).
 * - Exposes `mount` via `HostContext` so hooks can use it as an orphan-subscriber
 *   sentinel (`mount.isConnected === false` after Dataview removes the container).
 * - `renderTree(mount)` must return the `ReactNode` to render — receives `mount`
 *   so external wrappers (e.g. MantineProvider) can reference the element.
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
			/* root already unmounted */
		}
	}

	container.innerHTML = "";
	const host = document.createElement("div");
	container.appendChild(host);
	const shadow = host.attachShadow({ mode: "open" });

	const style = document.createElement("style");
	style.textContent = __STYLE__;
	shadow.appendChild(style);

	// `mount` is the `:host>div` that the transformed CSS selectors target.
	const mount = document.createElement("div");
	shadow.appendChild(mount);

	const root = createRoot(mount);
	w.__mdRoot__ = root;
	root.render(<HostContext.Provider value={mount}>{renderTree(mount)}</HostContext.Provider>);

	return container;
}
