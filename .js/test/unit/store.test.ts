/**
 * Tests for store behaviour when metadataCache.getCache() returns null
 * but the "changed" event has already supplied the correct CachedMetadata.
 *
 * Real-world scenario: studied/index.md is created but Obsidian has not yet
 * indexed the file when buildFolderFiles is called for the first time. The
 * metadataCache fires "changed" at some point, but it may arrive AFTER the
 * first flush triggered by session files — and if getCache() keeps returning
 * null at that moment, the plan name ends up empty.
 *
 * The fix is to store the CachedMetadata received in the "changed" callback
 * (third argument) and use it as the primary source in buildSnapshot.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getFolderFiles,
	getSnapshot,
	subscribeFolderFiles,
} from "@/lib/store";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type ChangedCb = (
	file: { path: string },
	data: string,
	cache: Record<string, unknown>,
) => void;

function makeApp(overrides?: {
	getCache?: (path: string) => Record<string, unknown> | null;
	folderChildren?: { path: string; name: string }[];
}) {
	const changedListeners: ChangedCb[] = [];

	const app = {
		metadataCache: {
			on: vi.fn((event: string, cb: ChangedCb) => {
				if (event === "changed") changedListeners.push(cb);
				return {};
			}),
			getCache: vi.fn(overrides?.getCache ?? (() => null)),
		},
		vault: {
			on: vi.fn(() => ({})),
			getFolderByPath: vi.fn((folder: string) => {
				if (folder !== "studied") return null;
				return {
					children: overrides?.folderChildren ?? [
						{ path: "studied/index.md", name: "index.md" },
					],
				};
			}),
			getAbstractFileByPath: vi.fn((path: string) => ({
				path,
				name: path.split("/").pop(),
			})),
		},
		fireChanged(path: string, data: string, cache: Record<string, unknown>) {
			for (const cb of changedListeners) cb({ path }, data, cache);
		},
	};

	return app as unknown as ReturnType<typeof makeApp>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.useFakeTimers();
	// Ensure a clean store between tests (singleton on globalThis)
	delete (globalThis as unknown as Record<string, unknown>).__mdStore__;
});

afterEach(() => {
	vi.useRealTimers();
});

describe("store — lastCache: uses CachedMetadata from the 'changed' event", () => {
	it("getSnapshot reflects frontmatter from the 'changed' event even when getCache returns null", () => {
		// getCache always returns null — simulates a file not yet indexed
		const app = makeApp({ getCache: () => null });

		// Create the cache entry via subscribe (forces ensure)
		const unsub = subscribeFolderFiles(
			app as never,
			"studied",
			() => {},
			null,
			true,
		);

		// Access snapshot (creates entry in files via getSnapshot)
		const snap0 = getSnapshot(app as never, "studied/index.md");
		expect(snap0.frontmatter).toEqual({}); // still empty

		// Obsidian processes the file and fires "changed" with the full cache
		app.fireChanged("studied/index.md", "---\nname: PRF Plan\n---\n", {
			frontmatter: { name: "PRF Plan" },
		});
		vi.advanceTimersByTime(100); // trigger the 24ms debounce

		// After flush, snapshot should have the correct name
		const snap1 = getSnapshot(app as never, "studied/index.md");
		expect(snap1.frontmatter.name).toBe("PRF Plan");

		unsub();
	});

	it("getFolderFiles reflects frontmatter from the 'changed' event even when getCache returns null", () => {
		const app = makeApp({
			getCache: () => null,
			folderChildren: [
				{ path: "studied/index.md", name: "index.md" },
				{ path: "studied/Physics/records/session.md", name: "session.md" },
			],
		});

		// Force creation of the folderFiles entry
		const unsub = subscribeFolderFiles(
			app as never,
			"studied",
			() => {},
			null,
			true,
		);

		// Initial state: everything empty (getCache returns null)
		const files0 = getFolderFiles(app as never, "studied", true);
		expect(files0.find((f) => f.file?.path === "studied/index.md")?.frontmatter).toEqual({});

		// Session indexed (getCache still returns null for studied/index.md)
		app.fireChanged(
			"studied/Physics/records/session.md",
			"---\ntype: record\ndurationMin: 90\n---\n",
			{ frontmatter: { type: "record", durationMin: 90 } },
		);
		vi.advanceTimersByTime(100); // first flush (session)

		// Plan indexed later: "changed" with correct cache, but getCache still null
		app.fireChanged("studied/index.md", "---\nname: PRF Plan\n---\n", {
			frontmatter: { name: "PRF Plan" },
		});
		vi.advanceTimersByTime(100); // second flush (plan)

		// After flush the plan should appear
		const files1 = getFolderFiles(app as never, "studied", true);
		const plan = files1.find((f) => f.file?.path === "studied/index.md");
		expect(plan?.frontmatter.name).toBe("PRF Plan");

		unsub();
	});
});
