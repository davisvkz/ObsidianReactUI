import { createTheme, type MantineColorsTuple } from "@mantine/core";

// ---------------------------------------------------------------------------
// Paleta verde-menta do Estudei (baseada em #2bbf9e como cor primária).
// ---------------------------------------------------------------------------

const mint: MantineColorsTuple = [
	"#f0fdf9", // 0 — fundo muito claro
	"#dcfaf2", // 1
	"#b0f5e3", // 2
	"#7aedce", // 3
	"#4addb5", // 4
	"#2bbf9e", // 5 — cor principal da marca
	"#22a88c", // 6 — sombra padrão para botões (light mode primaryShade)
	"#1b8a72", // 7
	"#116c59", // 8
	"#074d3f", // 9 — mais escuro
];

export const estudeiTheme = createTheme({
	colors: { mint },
	defaultRadius: "md",
	fontFamily:
		"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
	primaryColor: "mint",
	primaryShade: { dark: 6, light: 5 },
});
