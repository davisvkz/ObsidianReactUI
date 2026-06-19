import { createElement } from "react";
import type { RouteObject } from "react-router";

interface RouteModule {
	default: React.ComponentType;
}

// "./todo/[id].tsx" → "/todo/:id"
// "./index.tsx"     → "/"
// "./about.tsx"     → "/about"
function keyToPath(key: string): string {
	return (
		"/" +
		key
			.replace(/^\.\//, "")
			.replace(/\.(tsx?|jsx?)$/, "")
			.replace(/(\/|^)index$/, "")
			.replace(/\[([^\]]+)\]/g, ":$1")
	);
}

function dirOf(key: string): string {
	const parts = key.replace(/^\.\//, "").split("/");
	return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
}

function baseName(key: string): string {
	return (
		key
			.replace(/^\.\//, "")
			.replace(/\.(tsx?|jsx?)$/, "")
			.split("/")
			.pop() ?? ""
	);
}

/**
 * Converts a `require.context` into `RouteObject[]` for react-router.
 *
 * File convention for `src/routes/`:
 *   _layout.tsx        → pathless layout (wrapper via <Outlet />)
 *   index.tsx          → path "/"
 *   about.tsx          → path "/about"
 *   [param].tsx        → path "/:param"
 *   todo/[id].tsx      → path "/todo/:id"
 *   todo/_layout.tsx   → layout wrapping all routes inside todo/
 *
 * Usage:
 *   const routes = createFsRoutes(
 *     require.context("../routes", true, /\.(tsx|ts)$/)
 *   )
 */
export function createFsRoutes(ctx: RequireContext): RouteObject[] {
	const keys = ctx.keys();

	const layoutMap = new Map<string, React.ComponentType>();
	const pageKeys: string[] = [];

	for (const key of keys) {
		if (baseName(key) === "_layout") {
			const mod = ctx(key) as RouteModule;
			layoutMap.set(dirOf(key), mod.default);
		} else {
			pageKeys.push(key);
		}
	}

	const groupMap = new Map<string, RouteObject>();
	const rootChildren: RouteObject[] = [];

	for (const key of pageKeys) {
		const mod = ctx(key) as RouteModule;
		const dir = dirOf(key);
		const route: RouteObject = {
			element: createElement(mod.default),
			path: keyToPath(key),
		};

		const dirLayout = dir ? layoutMap.get(dir) : undefined;
		if (dirLayout) {
			if (!groupMap.has(dir)) {
				const group: RouteObject = {
					children: [],
					element: createElement(dirLayout),
				};
				groupMap.set(dir, group);
				rootChildren.push(group);
			}
			groupMap.get(dir)?.children?.push(route);
		} else {
			rootChildren.push(route);
		}
	}

	const rootLayout = layoutMap.get("");
	if (rootLayout) {
		return [{ children: rootChildren, element: createElement(rootLayout) }];
	}

	return rootChildren;
}
