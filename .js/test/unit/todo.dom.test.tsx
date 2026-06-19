import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RouteObject } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersistentRouter } from "@/lib/router";
import { renderWithProviders } from "./testUtils";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdate = vi.fn();
const mockApp = {};

vi.mock("@/lib", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib")>();
	return {
		...actual,
		useApp: vi.fn(() => mockApp),
		useSubfolders: vi.fn(() => ({ items: [] })),
		useMarkdownFile: vi.fn(() => ({
			exists: true,
			frontmatter: { done: false },
			update: mockUpdate,
			updateBody: vi.fn(),
			file: null,
			body: "",
		})),
		trashPath: vi.fn(),
		ensureFolder: vi.fn(),
	};
});

const mockCreateTodoFolder = vi.fn();

vi.mock("@/examples/todo", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/examples/todo")>();
	return {
		...actual,
		createTodoFolder: (...args: unknown[]) => mockCreateTodoFolder(...args),
	};
});

import { useMarkdownFile, useSubfolders } from "@/lib";
import TodoDetail from "@/routes/[id]";
import HomePage from "@/routes/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const routes: RouteObject[] = [
	{ element: <HomePage />, path: "/" },
	{ element: <TodoDetail />, path: "/:id" },
];

type WinWithRouter = Window & { __mdRouterPath__?: string };

function setPath(path: string) {
	(window as WinWithRouter).__mdRouterPath__ = path;
}

afterEach(() => {
	delete (window as WinWithRouter).__mdRouterPath__;
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Home (route /)
// ---------------------------------------------------------------------------

describe("Home — to-do list", () => {
	it("shows empty state when there are no to-dos", () => {
		vi.mocked(useSubfolders).mockReturnValue({ items: [] });
		renderWithProviders(<PersistentRouter routes={routes} />);
		expect(screen.getByText(/No to-dos yet/i)).toBeInTheDocument();
	});

	it("renders an existing to-do with its checkbox", () => {
		vi.mocked(useSubfolders).mockImplementation((folder) => {
			if (folder === "todos") return { items: [{ path: "todos/Buy", name: "Buy" }] };
			return { items: [] };
		});
		vi.mocked(useMarkdownFile).mockReturnValue({
			exists: true,
			frontmatter: { done: false },
			update: mockUpdate,
			updateBody: vi.fn(),
			file: null,
			body: "",
		});
		renderWithProviders(<PersistentRouter routes={routes} />);
		const checkbox = screen.getByRole("checkbox", { name: "Buy" });
		expect(checkbox).toBeInTheDocument();
		expect(checkbox).not.toBeChecked();
	});

	it("to-do with done=true has a checked checkbox", () => {
		vi.mocked(useSubfolders).mockImplementation((folder) => {
			if (folder === "todos") return { items: [{ path: "todos/Done", name: "Done" }] };
			return { items: [] };
		});
		vi.mocked(useMarkdownFile).mockReturnValue({
			exists: true,
			frontmatter: { done: true },
			update: mockUpdate,
			updateBody: vi.fn(),
			file: null,
			body: "",
		});
		renderWithProviders(<PersistentRouter routes={routes} />);
		expect(screen.getByRole("checkbox", { name: "Done" })).toBeChecked();
	});

	it("calls createTodoFolder when the form is submitted with Enter", async () => {
		const user = userEvent.setup();
		vi.mocked(useSubfolders).mockReturnValue({ items: [] });
		renderWithProviders(<PersistentRouter routes={routes} />);

		await user.type(screen.getByPlaceholderText("New to-do…"), "New Task{Enter}");

		expect(mockCreateTodoFolder).toHaveBeenCalledWith(mockApp, "todos", "New Task");
	});

	it("calls createTodoFolder when the Add button is clicked", async () => {
		const user = userEvent.setup();
		vi.mocked(useSubfolders).mockReturnValue({ items: [] });
		renderWithProviders(<PersistentRouter routes={routes} />);

		await user.type(screen.getByPlaceholderText("New to-do…"), "Another Task");
		await user.click(screen.getByRole("button", { name: /add/i }));

		expect(mockCreateTodoFolder).toHaveBeenCalledWith(mockApp, "todos", "Another Task");
	});
});

// ---------------------------------------------------------------------------
// Detail (route /:id)
// ---------------------------------------------------------------------------

describe("Detail — to-do details", () => {
	beforeEach(() => setPath("/Buy"));

	it("shows 'not found' when the to-do does not exist", () => {
		vi.mocked(useMarkdownFile).mockReturnValue({
			exists: false,
			frontmatter: {},
			update: mockUpdate,
			updateBody: vi.fn(),
			file: null,
			body: "",
		});
		vi.mocked(useSubfolders).mockReturnValue({ items: [] });
		renderWithProviders(<PersistentRouter routes={routes} />);
		expect(screen.getByText(/not found/i)).toBeInTheDocument();
	});

	it("shows the to-do name when it exists", () => {
		vi.mocked(useMarkdownFile).mockReturnValue({
			exists: true,
			frontmatter: { done: false },
			update: mockUpdate,
			updateBody: vi.fn(),
			file: null,
			body: "",
		});
		vi.mocked(useSubfolders).mockReturnValue({ items: [] });
		renderWithProviders(<PersistentRouter routes={routes} />);
		expect(screen.getByText("Buy")).toBeInTheDocument();
	});

	it("shows the empty-list message when there are no subtasks", () => {
		vi.mocked(useMarkdownFile).mockReturnValue({
			exists: true,
			frontmatter: { done: false },
			update: mockUpdate,
			updateBody: vi.fn(),
			file: null,
			body: "",
		});
		vi.mocked(useSubfolders).mockReturnValue({ items: [] });
		renderWithProviders(<PersistentRouter routes={routes} />);
		expect(screen.getByText(/No subtasks/i)).toBeInTheDocument();
	});

	it("renders subtasks when they exist", () => {
		vi.mocked(useMarkdownFile).mockReturnValue({
			exists: true,
			frontmatter: { done: false },
			update: mockUpdate,
			updateBody: vi.fn(),
			file: null,
			body: "",
		});
		vi.mocked(useSubfolders).mockImplementation((folder) => {
			if (folder === "todos/Buy")
				return { items: [{ path: "todos/Buy/Milk", name: "Milk" }] };
			return { items: [] };
		});
		renderWithProviders(<PersistentRouter routes={routes} />);
		expect(screen.getByRole("checkbox", { name: "Milk" })).toBeInTheDocument();
	});
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe("Navigation home ↔ detail", () => {
	it("navigates to the detail page when 'view subtasks' is clicked", async () => {
		const user = userEvent.setup();
		vi.mocked(useSubfolders).mockImplementation((folder) => {
			if (folder === "todos") return { items: [{ path: "todos/Buy", name: "Buy" }] };
			return { items: [] };
		});
		vi.mocked(useMarkdownFile).mockReturnValue({
			exists: true,
			frontmatter: { done: false },
			update: mockUpdate,
			updateBody: vi.fn(),
			file: null,
			body: "",
		});

		renderWithProviders(<PersistentRouter routes={routes} />);
		expect(screen.getByRole("checkbox", { name: "Buy" })).toBeInTheDocument();

		await user.click(screen.getByLabelText("view subtasks"));

		await waitFor(() => {
			expect(screen.getByText(/No subtasks/i)).toBeInTheDocument();
		});
	});

	it("returns to home when 'back' is clicked", async () => {
		const user = userEvent.setup();
		setPath("/Buy");
		vi.mocked(useMarkdownFile).mockReturnValue({
			exists: true,
			frontmatter: { done: false },
			update: mockUpdate,
			updateBody: vi.fn(),
			file: null,
			body: "",
		});
		vi.mocked(useSubfolders).mockReturnValue({ items: [] });

		renderWithProviders(<PersistentRouter routes={routes} />);
		expect(screen.getByText(/No subtasks/i)).toBeInTheDocument();

		await user.click(screen.getByLabelText("back"));

		await waitFor(() => {
			expect(screen.getByText(/No to-dos yet/i)).toBeInTheDocument();
		});
	});
});
