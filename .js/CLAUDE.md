# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

This is **not** an Obsidian plugin. It is a single **Dataview JS snippet**, bundled as one file. This repo (`.js/`) lives *inside* a live Obsidian vault (`obsidian.rm/`); the vault's `index.md` contains one inline snippet that reads and `eval`s the build output on every render:

```
`$=const lib = await eval(await app.vault.adapter.read('.js/dist/bundle.js'));lib(dv)`
```

So `npm run build` directly updates what the vault renders — `dist/` is the deploy target (gitignored, but present and live).

## Commands

- **Install:** `npm install` (both `package-lock.json` and `bun.lock` are committed; `bun install` also works)
- **Build:** `npm run build` → writes `dist/bundle.js`. The bundler is **rspack** (`rspack.config.js`), *not* Vite — ignore the `vite-project` package name and stray vite devDeps.
- **Test:** `npm test` — runs WebdriverIO e2e against a real Obsidian. `pretest` builds first, so tests always run against fresh `dist/`.
- **Single spec:** `npx wdio run ./wdio.conf.mts --spec ./test/specs/todos.e2e.ts` (build first if source changed: `npm run build`).
- **Lint/format:** `npx @biomejs/biome check .` / `npx @biomejs/biome format --write .` (Biome 2.4.9; tabs, double quotes, import + key/prop sorting enforced). There is no eslint config despite eslint devDeps.
- **Typecheck:** `npx tsc --noEmit` (src) and `npx tsc --noEmit -p test/tsconfig.json` (specs).

Test env vars: `OBSIDIAN_VERSIONS` (default `latest/latest`, e.g. `earliest/earliest`), `WDIO_MAX_INSTANCES` (parallel Obsidian instances, default 1). Downloaded Obsidian builds are cached in `.obsidian-cache/`.

**NixOS:** the prebuilt Electron/Chromedriver binaries `wdio-obsidian-service` downloads need an FHS environment to run (`test/.fhs-result` is the related artifact). Run the test command inside your FHS wrapper.

## The eval/re-eval execution model (drives most design decisions)

Dataview `eval`s the entire bundle **on every render**, so the bundle must be a self-returning expression and nothing may assume it runs once:

- **Bundle shape:** rspack emits a `var` library named `exports`; the custom `ReturnLibraryWithCSSPlugin` (in `rspack.config.js`) wraps the whole bundle in an IIFE that **returns the default export** — the `(dv) => ...` function the snippet calls. `src/index.tsx`'s default export is that entry.
- **No runtime `import` of `obsidian`:** the `obsidian` module isn't available to `eval`. Only `import type` is allowed. Consequences in `markdownStore.ts`: a local `debounce`, and a structural type guard `isFolder` instead of `instanceof TFolder`.
- **State survives re-evals via `window`:** the reactive store is a singleton on `window.__mdStore__` so global vault listeners register **once**; the previous React root is kept on `window.__mdRoot__` and unmounted before remount (`mantineRender` in `utils.tsx`) because Dataview may swap the container without unmounting React. `globals.d.ts` declares these globals plus `__STYLE__`.

## Build pipeline specifics

- **CSS is inlined into the JS** as the `__STYLE__` string constant (Mantine + Tailwind). `ReturnLibraryWithCSSPlugin` extracts the emitted CSS asset and injects it as a constant — there is no separate `.css` file to load at runtime.
- **Shadow DOM isolation:** `mantineRender`/`render` mount React inside a shadow root and inject `__STYLE__` there, isolating Mantine/Tailwind from Obsidian's CSS. PostCSS transforms in `rspack.config.js` make this work: `replaceRootWithHost` rewrites `:root` → `:host>div` so Mantine CSS variables resolve inside the shadow root; other custom PostCSS plugins strip `@layer`/`@property`/`@supports` and the Tailwind preflight `margin` reset.
- Path alias `@/` → `./src` (set in both `tsconfig.json` and `rspack.config.js`).

## Reactive store architecture

`src/scripts/markdownStore.ts` + `useMarkdownFile.tsx` implement a `useSyncExternalStore`-backed view of the vault:

- **`ReactiveCache<T>`** — a string-keyed reactive collection. Two instances live in the store: `files` (`MdSnapshot` per `.md` path) and `subfolders` (`Subfolder[]` per folder). Snapshots are **referentially stable** — rebuilt only on invalidation.
- **Coalescing:** all invalidations flush through one shared 24ms `debounce`, so a burst of vault events becomes a single flush → at most one render per affected key.
- **Global listeners → invalidation:** `metadataCache.on("changed")` invalidates one file; `vault.on("create"/"delete"/"rename")` are structural and invalidate both the path's snapshot *and* its parent folder's subfolder listing. `parentOf(path)` parses the parent from the string because delete events can arrive with `file.parent` already detached (local-trash case).
- **Orphan subscriber pruning:** Dataview can remove the container DOM without React unmounting (effect cleanups never run), so subscribers carry a `host: Node`; the cache drops any whose `host.isConnected` is false. Hooks expose a `hostRef` to anchor a hidden `<span>` for this.
- **Hooks** (`useMarkdownFile`, `useSubfolders`) go through `useStoreValue`, which stabilizes the subscribe fn with `useCallback` (otherwise React re-subscribes every render → loop).
- **Mutations** go through Obsidian APIs: `updateFrontmatter` uses `processFrontMatter` so one batch = one write = one event = one render. Full round-trip: UI write → vault event → invalidation → debounced flush → re-render.

## Core vs. example separation (keep this boundary)

- `src/scripts/` (store, hooks, `utils`) is **generic**: no domain conventions, lists *all* subfolders, reads *any* frontmatter.
- `src/examples/todo.tsx` owns the to-do convention: *a to-do = a folder with `index.md` holding `done`; children = subfolders*. `src/index.tsx` wires `<TodoApp root="todos" />`.
- When extending, put new conventions in `examples/`, not in `scripts/`.

## Testing model (`wdio-obsidian-service`)

- Specs run a real downloaded Obsidian against the sandbox vault `test/vaults/simple`, with the **Dataview community plugin** installed (configured in `wdio.conf.mts`).
- Each spec's `before` reads the freshly built `dist/bundle.js` from disk and writes it into the sandbox vault at `.js/dist/bundle.js` (the production path), then opens `index.md` in preview mode so Dataview evaluates the `$=` snippet. Source changes are invisible to tests until rebuilt.
- Because the UI renders in a **Shadow DOM**, helpers recursively drill shadow roots (`deepQueryAll`/`walk`) to query `.mantine-Checkbox-*` nodes. `injectGlobals: false`, so import `describe`/`it`/`expect`/`browser` explicitly.
- `delete.e2e.ts` deliberately exercises `trashOption=local`, where the delete event's file is already detached from its parent — the reason the store keys parents by string rather than `file.parent`.
