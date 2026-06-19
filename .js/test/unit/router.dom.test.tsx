import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RouteObject } from "react-router";
import { Link, Outlet, useParams } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PersistentRouter } from "@/lib/router";
import { renderWithProviders } from "./testUtils";

// ---------------------------------------------------------------------------
// Route fixtures for the tests
// ---------------------------------------------------------------------------

function Layout() {
	return (
		<div>
			<nav>
				<Link to="/">Home</Link>
				<Link to="/about">About</Link>
				<Link to="/todo/42">Todo 42</Link>
			</nav>
			<Outlet />
		</div>
	);
}

function HomePage() {
	return <p>Home Page</p>;
}

function AboutPage() {
	return <p>About Page</p>;
}

function TodoDetailPage() {
	const { id } = useParams<{ id: string }>();
	return <p>Todo: {id}</p>;
}

const testRoutes: RouteObject[] = [
	{
		children: [
			{ element: <HomePage />, path: "/" },
			{ element: <AboutPage />, path: "/about" },
			{ element: <TodoDetailPage />, path: "/todo/:id" },
		],
		element: <Layout />,
	},
];

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

type WinWithRouter = Window & { __mdRouterPath__?: string };

function win(): WinWithRouter {
	return window as WinWithRouter;
}

beforeEach(() => {
	delete win().__mdRouterPath__;
});

afterEach(() => {
	delete win().__mdRouterPath__;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PersistentRouter", () => {
	it("renders the initial route /", () => {
		renderWithProviders(<PersistentRouter routes={testRoutes} />);
		expect(screen.getByText("Home Page")).toBeInTheDocument();
	});

	it("navigates to /about when the About link is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<PersistentRouter routes={testRoutes} />);

		await user.click(screen.getByText("About"));

		expect(await screen.findByText("About Page")).toBeInTheDocument();
		expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
	});

	it("persists the current route in window.__mdRouterPath__ after navigating", async () => {
		const user = userEvent.setup();
		renderWithProviders(<PersistentRouter routes={testRoutes} />);

		await user.click(screen.getByText("About"));
		await screen.findByText("About Page");

		expect(win().__mdRouterPath__).toBe("/about");
	});

	it("seeds the route from window.__mdRouterPath__ on mount (simulates a Dataview re-eval)", () => {
		win().__mdRouterPath__ = "/about";

		renderWithProviders(<PersistentRouter routes={testRoutes} />);

		expect(screen.getByText("About Page")).toBeInTheDocument();
		expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
	});

	it("renders route parameters in /todo/:id", () => {
		win().__mdRouterPath__ = "/todo/42";

		renderWithProviders(<PersistentRouter routes={testRoutes} />);

		expect(screen.getByText("Todo: 42")).toBeInTheDocument();
	});
});
