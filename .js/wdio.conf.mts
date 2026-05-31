import * as path from "node:path";
import { env } from "node:process";
import { parseObsidianVersions } from "wdio-obsidian-service";

// O wdio-obsidian-service baixa as versões do Obsidian para este diretório (cacheado entre runs).
const cacheDir = path.resolve(".obsidian-cache");

// Versões do Obsidian a testar. Sobrescreva com OBSIDIAN_VERSIONS="earliest/earliest latest/latest".
const versions = await parseObsidianVersions(
	env.OBSIDIAN_VERSIONS ?? "latest/latest",
	{ cacheDir },
);

export const config: WebdriverIO.Config = {
	runner: "local",
	framework: "mocha",

	specs: ["./test/specs/**/*.e2e.ts"],

	// Quantas instâncias do Obsidian rodar em paralelo.
	maxInstances: Number(env.WDIO_MAX_INSTANCES || 1),

	capabilities: versions.map<WebdriverIO.Capabilities>(
		([appVersion, installerVersion]) => ({
			browserName: "obsidian",
			"wdio:obsidianOptions": {
				appVersion,
				installerVersion,
				// Este projeto NÃO é um plugin: é um snippet Dataview JS. Instalamos o
				// plugin da comunidade Dataview no vault sandbox para avaliar o snippet.
				plugins: [{ id: "dataview" }],
				vault: "./test/vaults/simple",
			},
		}),
	),

	services: ["obsidian"],
	// obsidian-reporter é um wrapper do spec-reporter que mostra a versão do Obsidian.
	reporters: ["obsidian"],

	mochaOpts: {
		ui: "bdd",
		timeout: 60 * 1000,
	},
	waitforInterval: 250,
	waitforTimeout: 10 * 1000,
	logLevel: "warn",

	cacheDir,

	// Importar describe/expect/browser explicitamente.
	injectGlobals: false,
};
