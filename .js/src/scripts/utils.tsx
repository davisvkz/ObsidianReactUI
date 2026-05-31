import { MantineProvider } from "@mantine/core";
import type { App } from "obsidian";
import type { DataviewInlineApi } from "obsidian-dataview/lib/api/inline-api";
import type React from "react";
import { createContext, useContext, useEffect, useRef } from "react";
import { type Root, createRoot } from "react-dom/client";

/** O `App` do Obsidian, disponibilizado a toda a árvore React. */
export const AppContext = createContext<App | null>(null);

function resolveApp(dv: DataviewInlineApi): App {
	return (dv as unknown as { app: App }).app ?? (window as unknown as { app: App }).app;
}

function ShadowRoot({ children }: { children: React.ReactNode }) {
	const hostRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!hostRef.current) return;

		const shadow = hostRef.current.attachShadow({ mode: "open" });

		const mountPoint = document.createElement("div");
		shadow.appendChild(mountPoint);

		const style = document.createElement("style");
		style.textContent = __STYLE__;
		shadow.appendChild(style);

		const root = createRoot(mountPoint);
		root.render(
			<ShadowPortalContext.Provider value={mountPoint}>
				{children}
			</ShadowPortalContext.Provider>,
		);

		return () => root.unmount();
	}, [children]);

	return <div ref={hostRef} />;
}

export function render(dv: DataviewInlineApi, children: React.ReactNode) {
	const root = createRoot(dv.container);
	root.render(<ShadowRoot>{children}</ShadowRoot>);
}

const ShadowPortalContext = createContext<HTMLElement | null>(null);

export function mantineRender(
	dv: DataviewInlineApi,
	children: React.ReactNode,
) {
	const app = resolveApp(dv);

	// Desmonta o root do render anterior (o Dataview pode remover o container sem
	// desmontar o React), garantindo que os cleanups de efeitos rodem de fato.
	const w = window as unknown as { __mdRoot__?: Root };
	if (w.__mdRoot__) {
		try {
			w.__mdRoot__.unmount();
		} catch {
			/* root já desmontado */
		}
	}

	const root = createRoot(dv.container);
	w.__mdRoot__ = root;

	function Mantinewrapper(props: { children: React.ReactNode }) {
		const root = useContext(ShadowPortalContext);
		return (
			<MantineProvider
				defaultColorScheme="dark"
				getRootElement={() => root}
				theme={{ components: { Portal: { defaultProps: { target: root } } } }}
			>
				{props.children}
			</MantineProvider>
		);
	}
	root.render(
		<AppContext.Provider value={app}>
			<Mantinewrapper>{children}</Mantinewrapper>
		</AppContext.Provider>,
	);
	return dv.container;
}
