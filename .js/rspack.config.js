import path from 'path';
import { rspack } from '@rspack/core';
import { fileURLToPath } from 'url';
import PreactRefreshPlugin from '@rspack/plugin-preact-refresh';
import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';
import postcssPresetMantine from 'postcss-preset-mantine';
import postcssSimpleVars from 'postcss-simple-vars';
import fs from 'fs';

const removePreflightMargin = (root) => {
	root.walkRules((rule) => {
		if (rule.selector === '*,:after,:before,::backdrop') {
			rule.walkDecls('margin', (decl) => {
				decl.remove();
			});
		}
	});
};
// Custom PostCSS plugin to remove `@layer` rules but keep the CSS inside
const removeLayerRules = (root) => {
	root.walkAtRules('layer', (rule) => {
		rule.replaceWith(rule.nodes);
	});
};

// Custom PostCSS plugin to remove `@property` rules
const removePropertyRules = (root) => {
	root.walkAtRules('property', (rule) => {
		rule.remove();
	});
};

// Custom PostCSS plugin to remove `@supports` rules (handle nested)
const removeSupportsRules = (root) => {
	let hasSupports = true;

	while (hasSupports) {
		hasSupports = false;

		root.walkAtRules('supports', (rule) => {
			hasSupports = true;
			rule.replaceWith(rule.nodes);
		});
	}
};

const replaceRootWithHost = (root) => {
	root.walkRules((rule) => {
		const updated = rule.selectors.map((selector) => {
			// Se começa com :root[
			if (selector.startsWith(':root[')) {
				return selector.replace(/^:root\[(.+)\]$/, ':host>div[$1]');
			}
			// Se é só :root
			if (selector === ':root') {
				return ':host>div';
			}
			return selector;
		});
		if (updated.some((s, i) => s !== rule.selectors[i])) {
			rule.selectors = [...rule.selectors, ...updated];
		}
	});
};

// Corrige __dirname e __filename em ambiente ESM:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AddFilePlugin {
	apply(compiler) {
		compiler.hooks.done.tap('AddFilePlugin', () => {
			const outputPath = compiler.options.output.path;
			const filePath = path.join(outputPath, 'a.md');

			// Cria o arquivo dist/a.md e escreve "1"
			fs.mkdirSync(outputPath, { recursive: true });
			const content = fs.readFileSync(filePath);
			if ((content == '')) fs.writeFileSync(filePath, ' ');
			else fs.writeFileSync(filePath, '');
		});
	}
}

export class ReturnLibraryWithCSSPlugin {
	constructor(options = {}) {
		this.name = options.name || 'exports'; // nome interno do objeto da lib
	}

	apply(compiler) {
		compiler.hooks.thisCompilation.tap('ReturnLibraryWithCSSPlugin', (compilation) => {
			compilation.hooks.processAssets.tap(
				{
					name: 'ReturnLibraryWithCSSPlugin',
					stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
				},
				(assets) => {
					let cssSource = '';

					// Pega o CSS gerado (se existir)
					const cssAssetName = Object.keys(assets).find((a) => a.endsWith('.css'));
					if (cssAssetName) {
						cssSource = assets[cssAssetName].source().toString();
						compilation.deleteAsset(cssAssetName);
					}

					// Atualiza o JS
					for (const file of Object.keys(assets)) {
						if (!file.endsWith('.js')) continue;
						const originalSource = assets[file].source().toString();

						const wrapped = `(() => {
${cssSource ? `const __STYLE__ = ${JSON.stringify(cssSource)};\n` : ''}
${originalSource}

// Retorna o export padrão
return typeof ${this.name} !== "undefined" && ${this.name}.default ? ${this.name}.default : ${this.name};
})();`;

						compilation.updateAsset(file, new compiler.webpack.sources.RawSource(wrapped));
					}
				},
			);
		});
	}
}

/** Plugin customizado para embutir o CSS */

export default {
	entry: './src/index.tsx',
	mode: 'development',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'bundle.js',
		library: { name: 'exports', type: 'var' },
	},
	resolve: {
		extensions: ['.ts', '.tsx', '.js'],
		alias: { '@': path.resolve(__dirname, './src') },
	},
	module: {
		rules: [
			{
				test: /\.[jt]sx?$/,
				loader: 'builtin:swc-loader',
				options: {
					jsc: {
						parser: { syntax: 'typescript', tsx: true },
						transform: { react: { runtime: 'automatic' } },
					},
				},
			},
			{
				test: /\.css$/,
				type: 'javascript/auto',
				use: [
					rspack.CssExtractRspackPlugin.loader,
					'css-loader',
					{
						loader: 'postcss-loader',
						options: {
							postcssOptions: {
								plugins: [
									tailwindcss({
										optimize: true,
									}),
									autoprefixer,
									removeLayerRules,
									removePropertyRules,
									removeSupportsRules,
									removePreflightMargin,
									replaceRootWithHost,
									postcssPresetMantine(),
									postcssSimpleVars({
										variables: {
											'mantine-breakpoint-xs': '36em',
											'mantine-breakpoint-sm': '48em',
											'mantine-breakpoint-md': '62em',
											'mantine-breakpoint-lg': '75em',
											'mantine-breakpoint-xl': '88em',
										},
									}),
								],
							},
						},
					},
				],
			},
		],
	},
	plugins: [
		new PreactRefreshPlugin(),
		new rspack.CssExtractRspackPlugin(),
		new ReturnLibraryWithCSSPlugin(),
	],
	cache: true,
	experiments: {
		cache: {
			type: 'persistent',
			storage: {
				type: 'filesystem',
				directory: 'node_modules/.cache/rspack',
			},
		},
	},
};
