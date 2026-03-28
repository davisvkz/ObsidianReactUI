import { MantineProvider } from "@mantine/core";
import type { DataviewInlineApi } from "obsidian-dataview/lib/api/inline-api";
import type React from "react";
import { createContext, useContext, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

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
	const root = createRoot(dv.container);
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
	root.render(<Mantinewrapper>{children}</Mantinewrapper>);
	return dv.container;
}
