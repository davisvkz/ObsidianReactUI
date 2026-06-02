import {
	type MantineColorScheme,
	MantineProvider,
	type MantineThemeOverride,
} from "@mantine/core";
import type { DataviewInlineApi } from "obsidian-dataview/lib/api/inline-api";
import { AppContext, mountShadowReact } from "@/lib/render";

function resolveApp(dv: DataviewInlineApi): import("obsidian").App {
	return (
		(dv as unknown as { app: import("obsidian").App }).app ??
		(window as unknown as { app: import("obsidian").App }).app
	);
}

export interface MantineRenderOptions {
	/** Esquema de cores padrão (default: `"dark"`). */
	defaultColorScheme?: MantineColorScheme;
	/** Tema Mantine adicional (mesclado sobre o padrão). */
	theme?: MantineThemeOverride;
}

/**
 * Monta React + Mantine num shadow root isolado do Obsidian.
 *
 * Chama `mountShadowReact` (que cuida do cleanup do root anterior, do shadow DOM
 * e do `HostContext`) e envelopa a árvore com `AppContext` + `MantineProvider`.
 */
export function mantineRender(
	dv: DataviewInlineApi,
	children: React.ReactNode,
	options: MantineRenderOptions = {},
): HTMLElement {
	const { theme = {}, defaultColorScheme = "dark" } = options;
	const app = resolveApp(dv);

	return mountShadowReact(dv.container, (mount) => (
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
		</AppContext.Provider>
	));
}
