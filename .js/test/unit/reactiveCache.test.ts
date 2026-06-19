import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReactiveCache } from "@/lib/reactiveCache";

describe("ReactiveCache", () => {
	let buildCount: number;
	let flushCount: number;
	let cache: ReactiveCache<{ value: string }>;

	beforeEach(() => {
		buildCount = 0;
		flushCount = 0;
		cache = new ReactiveCache(
			(key) => {
				buildCount++;
				return { value: key };
			},
			() => {
				flushCount++;
			},
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("builds the snapshot on the first call to getSnapshot", () => {
		const snap = cache.getSnapshot("a");
		expect(snap).toEqual({ value: "a" });
		expect(buildCount).toBe(1);
	});

	it("getSnapshot returns the same reference before any flush", () => {
		const s1 = cache.getSnapshot("a");
		const s2 = cache.getSnapshot("a");
		expect(s1).toBe(s2);
		expect(buildCount).toBe(1);
	});

	it("does not call requestFlush when invalidate receives an unknown key", () => {
		cache.invalidate("nonexistent-key");
		expect(flushCount).toBe(0);
	});

	it("calls requestFlush when a known key is invalidated", () => {
		cache.getSnapshot("a");
		cache.invalidate("a");
		expect(flushCount).toBe(1);
	});

	it("flush rebuilds the snapshot and notifies subscribers", () => {
		const cb = vi.fn();
		const unsub = cache.subscribe("a", cb, null);

		cache.getSnapshot("a");
		expect(buildCount).toBe(1);

		cache.invalidate("a");
		cache.flush();

		expect(buildCount).toBe(2);
		expect(cb).toHaveBeenCalledTimes(1);

		unsub();
	});

	it("flush replaces the snapshot reference after invalidation", () => {
		cache.subscribe("a", () => {}, null);
		const s1 = cache.getSnapshot("a");
		cache.invalidate("a");
		cache.flush();
		const s2 = cache.getSnapshot("a");
		expect(s1).not.toBe(s2);
	});

	it("flush does not notify a subscriber with a disconnected host (orphan pruning)", () => {
		const cb = vi.fn();
		const deadHost = { isConnected: false } as unknown as Node;
		const unsub = cache.subscribe("a", cb, deadHost);

		cache.getSnapshot("a");
		cache.invalidate("a");
		cache.flush();

		expect(cb).not.toHaveBeenCalled();

		unsub();
	});

	it("flush notifies a subscriber with a null host (no connection check)", () => {
		const cb = vi.fn();
		const unsub = cache.subscribe("a", cb, null);

		cache.getSnapshot("a");
		cache.invalidate("a");
		cache.flush();

		expect(cb).toHaveBeenCalledTimes(1);

		unsub();
	});

	it("flush notifies a subscriber with a connected host", () => {
		const cb = vi.fn();
		const liveHost = { isConnected: true } as unknown as Node;
		const unsub = cache.subscribe("a", cb, liveHost);

		cache.getSnapshot("a");
		cache.invalidate("a");
		cache.flush();

		expect(cb).toHaveBeenCalledTimes(1);

		unsub();
	});

	it("unsubscribe removes the entry when there are no more subscribers", () => {
		const unsub = cache.subscribe("a", () => {}, null);
		cache.getSnapshot("a");

		unsub();

		const before = buildCount;
		cache.getSnapshot("a");
		expect(buildCount).toBe(before + 1);
	});

	it("multiple subscribers on the same key are all notified", () => {
		const cb1 = vi.fn();
		const cb2 = vi.fn();
		const unsub1 = cache.subscribe("a", cb1, null);
		const unsub2 = cache.subscribe("a", cb2, null);

		cache.getSnapshot("a");
		cache.invalidate("a");
		cache.flush();

		expect(cb1).toHaveBeenCalledTimes(1);
		expect(cb2).toHaveBeenCalledTimes(1);

		unsub1();
		unsub2();
	});

	it("flush clears the dirty set — a second call is a no-op", () => {
		const cb = vi.fn();
		const unsub = cache.subscribe("a", cb, null);

		cache.getSnapshot("a");
		cache.invalidate("a");
		cache.flush();
		cache.flush();

		expect(cb).toHaveBeenCalledTimes(1);

		unsub();
	});
});
