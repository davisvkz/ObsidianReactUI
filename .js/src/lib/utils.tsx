import {
	type MantineColorScheme,
	MantineProvider,
	type MantineThemeOverride,
} from "@mantine/core";
import type { App } from "obsidian";
import type { DataviewInlineApi } from "obsidian-dataview/lib/api/inline-api";
import type React from "react";
import { createContext, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";

/** O `App` do Obsidian, disponibilizado a toda a árvore React. */
export const AppContext = createContext<App | null>(null);

function resolveApp(dv: DataviewInlineApi): App {
	return (
		(dv as unknown as { app: App }).app ??
		(window as unknown as { app: App }).app
	);
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

export interface MantineRenderOptions {
	/** Esquema de cores padrão (default: `"dark"`). */
	defaultColorScheme?: MantineColorScheme;
	/** Tema Mantine adicional (mesclado sobre o padrão). */
	theme?: MantineThemeOverride;
}

export function mantineRender(
	dv: DataviewInlineApi,
	children: React.ReactNode,
	options: MantineRenderOptions = {},
) {
	const { theme = {}, defaultColorScheme = "dark" } = options;
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

	// Shadow DOM: isola o CSS (Tailwind/Mantine) do resto do Obsidian E injeta o
	// `__STYLE__` embutido — sem isso os componentes Mantine ficam sem estilo
	// (ex.: o ícone do checkbox renderiza em tamanho gigante).
	dv.container.innerHTML = "";
	const host = document.createElement("div");
	dv.container.appendChild(host);
	const shadow = host.attachShadow({ mode: "open" });

	const style = document.createElement("style");
	style.textContent = __STYLE__;
	shadow.appendChild(style);

	// `mount` é o `:host>div` para onde os seletores transformados apontam
	// (variáveis Mantine + atributo de color-scheme).
	const mount = document.createElement("div");
	shadow.appendChild(mount);

	const root = createRoot(mount);
	w.__mdRoot__ = root;
	root.render(
		<AppContext.Provider value={app}>
			<MantineProvider
				cssVariablesSelector=":host > div"
				defaultColorScheme={defaultColorScheme}
				getRootElement={() => mount}
				theme={{
					...theme,
					components: {
						Portal: { defaultProps: { target: mount } },
						...theme.components,
					},
				}}
			>
				{children}
			</MantineProvider>
		</AppContext.Provider>,
	);
	return dv.container;
}
