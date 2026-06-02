import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			// Stub defensivo: markdownStore.ts só usa `import type` do obsidian,
			// mas este alias garante que um import de runtime acidental não quebre.
			obsidian: path.resolve(__dirname, "./test/unit/__mocks__/obsidian.ts"),
		},
	},
	test: {
		environment: "node",
		include: ["test/unit/**/*.test.ts"],
	},
});
