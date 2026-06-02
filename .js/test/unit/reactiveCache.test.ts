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

	it("constrói o snapshot na primeira chamada a getSnapshot", () => {
		const snap = cache.getSnapshot("a");
		expect(snap).toEqual({ value: "a" });
		expect(buildCount).toBe(1);
	});

	it("getSnapshot devolve a mesma referência antes de qualquer flush", () => {
		const s1 = cache.getSnapshot("a");
		const s2 = cache.getSnapshot("a");
		expect(s1).toBe(s2);
		expect(buildCount).toBe(1);
	});

	it("não chama requestFlush quando invalidate recebe uma chave sem entrada", () => {
		cache.invalidate("chave-inexistente");
		expect(flushCount).toBe(0);
	});

	it("chama requestFlush quando invalida chave conhecida", () => {
		cache.getSnapshot("a");
		cache.invalidate("a");
		expect(flushCount).toBe(1);
	});

	it("flush reconstrói o snapshot e notifica assinantes", () => {
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

	it("flush troca a referência do snapshot após invalidação", () => {
		cache.subscribe("a", () => {}, null);
		const s1 = cache.getSnapshot("a");
		cache.invalidate("a");
		cache.flush();
		const s2 = cache.getSnapshot("a");
		expect(s1).not.toBe(s2);
	});

	it("flush não notifica assinante com host desconectado (poda de órfão)", () => {
		const cb = vi.fn();
		const deadHost = { isConnected: false } as unknown as Node;
		const unsub = cache.subscribe("a", cb, deadHost);

		cache.getSnapshot("a");
		cache.invalidate("a");
		cache.flush();

		expect(cb).not.toHaveBeenCalled();

		unsub();
	});

	it("flush notifica assinante com host null (sem verificação de conexão)", () => {
		const cb = vi.fn();
		const unsub = cache.subscribe("a", cb, null);

		cache.getSnapshot("a");
		cache.invalidate("a");
		cache.flush();

		expect(cb).toHaveBeenCalledTimes(1);

		unsub();
	});

	it("flush notifica assinante com host conectado", () => {
		const cb = vi.fn();
		const liveHost = { isConnected: true } as unknown as Node;
		const unsub = cache.subscribe("a", cb, liveHost);

		cache.getSnapshot("a");
		cache.invalidate("a");
		cache.flush();

		expect(cb).toHaveBeenCalledTimes(1);

		unsub();
	});

	it("unsubscribe remove a entrada quando não há mais assinantes", () => {
		const unsub = cache.subscribe("a", () => {}, null);
		cache.getSnapshot("a");

		unsub();

		const before = buildCount;
		cache.getSnapshot("a");
		expect(buildCount).toBe(before + 1);
	});

	it("múltiplos assinantes na mesma chave são todos notificados", () => {
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

	it("flush limpa o conjunto dirty — segunda chamada é no-op", () => {
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
