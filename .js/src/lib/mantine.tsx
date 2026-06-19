import { type MantineColorScheme, MantineProvider, type MantineThemeOverride } from "@mantine/core";
import type { DataviewInlineApi } from "obsidian-dataview/lib/api/inline-api";
import { AppContext, mountShadowReact } from "@/lib/render";

function resolveApp(dv: DataviewInlineApi): import("obsidian").App {
	return (
		(dv as unknown as { app: import("obsidian").App }).app ??
		(window as unknown as { app: import("obsidian").App }).app
	);
}

export interface MantineRenderOptions {
	/** Default color scheme (default: `"dark"`). */
	defaultColorScheme?: MantineColorScheme;
	/** Additional Mantine theme (merged on top of the default). */
	theme?: MantineThemeOverride;
}

/**
 * Mounts React + Mantine in an isolated shadow root inside Obsidian.
 *
 * Calls `mountShadowReact` (which handles previous root cleanup, shadow DOM
 * setup, and `HostContext`) and wraps the tree with `AppContext` + `MantineProvider`.
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
