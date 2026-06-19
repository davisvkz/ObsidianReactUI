import { useEffect } from "react";
import type { RouteObject } from "react-router";
import { MemoryRouter, useLocation, useRoutes } from "react-router";

// ---------------------------------------------------------------------------
// Persist the current route in `window.__mdRouterPath__`
//
// Dataview re-evaluates the bundle and `mountShadowReact` unmounts/remounts the
// React root on every render. Without persistence, MemoryRouter would always
// return to the initial route. Following the pattern of `window.__mdRoot__` /
// `window.__mdStore__`, we store the current path here and restore it on the
// next mount.
// ---------------------------------------------------------------------------

type WinWithRouter = Window & { __mdRouterPath__?: string };

function readPersistedPath(): string {
	return (window as WinWithRouter).__mdRouterPath__ ?? "/";
}

// ---------------------------------------------------------------------------
// Internal component: tracks route changes and persists them to window
// ---------------------------------------------------------------------------

function LocationTracker({ routes }: { routes: RouteObject[] }) {
	const location = useLocation();
	const element = useRoutes(routes);

	useEffect(() => {
		(window as WinWithRouter).__mdRouterPath__ =
			location.pathname + location.search + location.hash;
	}, [location]);

	return element;
}

// ---------------------------------------------------------------------------
// PersistentRouter
// ---------------------------------------------------------------------------

export interface PersistentRouterProps {
	routes: RouteObject[];
}

/**
 * Memory-based router that survives Dataview re-evals.
 *
 * - Uses `MemoryRouter` (no browser URL dependency; no data-router fetch pipeline,
 *   which would conflict in the Obsidian/eval environment).
 * - Accepts `RouteObject[]` (same format as `createMemoryRouter`); renders via
 *   `useRoutes` — supports nested routes, `Outlet`, `useParams`, etc.
 * - Seeds the initial route from `window.__mdRouterPath__` (default `"/"`), which
 *   is updated on every navigation. Full cycle:
 *   navigate → `useEffect` updates `window.__mdRouterPath__` → next Dataview re-eval
 *   mounts the router at the correct route.
 *
 * Must be rendered **inside** `MantineProvider` so that portals
 * (modals, popovers) continue to target the shadow root mount.
 */
export function PersistentRouter({ routes }: PersistentRouterProps) {
	const initialPath = readPersistedPath();
	return (
		<MemoryRouter initialEntries={[initialPath]} initialIndex={0}>
			<LocationTracker routes={routes} />
		</MemoryRouter>
	);
}
