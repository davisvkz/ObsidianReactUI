import { MantineProvider } from "@mantine/core";
import { type RenderOptions, render } from "@testing-library/react";

/**
 * Wraps the UI under test in `MantineProvider`.
 * Does not use shadow DOM (jsdom renders directly into `document.body`).
 */
function AllProviders({ children }: { children: React.ReactNode }) {
	return <MantineProvider>{children}</MantineProvider>;
}

export function renderWithProviders(
	ui: React.ReactElement,
	options?: Omit<RenderOptions, "wrapper">,
) {
	return render(ui, { wrapper: AllProviders, ...options });
}
