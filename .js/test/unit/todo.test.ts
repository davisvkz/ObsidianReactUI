import { describe, expect, it, vi } from "vitest";
import { createTodoFolder } from "@/examples/todo";

// ---------------------------------------------------------------------------
// Minimal Obsidian App mock
// ---------------------------------------------------------------------------

function makeApp(existingPaths: Set<string> = new Set()) {
	const created: string[] = [];
	const app = {
		vault: {
			getAbstractFileByPath: vi.fn((p: string) =>
				existingPaths.has(p) ? { path: p } : null,
			),
			getFolderByPath: vi.fn((p: string) =>
				existingPaths.has(p) ? { path: p } : null,
			),
			createFolder: vi.fn(async (p: string) => {
				existingPaths.add(p);
				created.push(p);
			}),
			create: vi.fn(async () => {}),
		},
	};
	return { app, created };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createTodoFolder", () => {
	it("creates the folder and index.md when the name is free", async () => {
		const { app, created } = makeApp();
		const result = await createTodoFolder(app as never, "todos", "My Task");
		expect(created).toContain("todos/My Task");
		expect(result).toBe("todos/My Task");
		expect(app.vault.create).toHaveBeenCalledWith(
			"todos/My Task/index.md",
			"---\ndone: false\n---\n",
		);
	});

	it("appends suffix ' 2' when the name already exists", async () => {
		const { app, created } = makeApp(new Set(["todos/X"]));
		const result = await createTodoFolder(app as never, "todos", "X");
		expect(created).toContain("todos/X 2");
		expect(result).toBe("todos/X 2");
	});

	it("increments until it finds the next free name", async () => {
		const { app, created } = makeApp(new Set(["todos/X", "todos/X 2", "todos/X 3"]));
		const result = await createTodoFolder(app as never, "todos", "X");
		expect(created).toContain("todos/X 4");
		expect(result).toBe("todos/X 4");
	});

	it("creates the parent folder (ensureFolder) when it does not exist", async () => {
		const { app, created } = makeApp();
		await createTodoFolder(app as never, "todos", "Task");
		expect(created).toContain("todos");
	});

	it("does not recreate the parent folder when it already exists", async () => {
		const { app, created } = makeApp(new Set(["todos"]));
		await createTodoFolder(app as never, "todos", "Task");
		expect(created).not.toContain("todos");
		expect(created).toContain("todos/Task");
	});

	it("sanitizes the name before creating (invalid characters become '-')", async () => {
		const { app, created } = makeApp();
		const result = await createTodoFolder(app as never, "todos", "a/b:c");
		expect(created).toContain("todos/a-b-c");
		expect(result).toBe("todos/a-b-c");
	});
});
