interface Subscriber {
	cb: () => void;
	host: Node | null;
}

interface CacheEntry<T> {
	snapshot: T;
	subscribers: Set<Subscriber>;
}

/**
 * Mantém, por chave, um snapshot referencialmente estável (só troca quando
 * invalidado) e os assinantes daquela chave. Reconstrói via `build` apenas o
 * que foi invalidado, coalescido pelo `requestFlush` compartilhado do store.
 */
export class ReactiveCache<T> {
	private readonly entries = new Map<string, CacheEntry<T>>();
	private readonly dirty = new Set<string>();

	constructor(
		private readonly build: (key: string) => T,
		private readonly requestFlush: () => void,
	) {}

	private ensure(key: string): CacheEntry<T> {
		const existing = this.entries.get(key);
		if (existing) return existing;
		const created: CacheEntry<T> = {
			snapshot: this.build(key),
			subscribers: new Set(),
		};
		this.entries.set(key, created);
		return created;
	}

	getSnapshot(key: string): T {
		return this.ensure(key).snapshot;
	}

	subscribe(key: string, cb: () => void, host: Node | null): () => void {
		const entry = this.ensure(key);
		const subscriber: Subscriber = { cb, host };
		entry.subscribers.add(subscriber);
		return () => {
			entry.subscribers.delete(subscriber);
			if (entry.subscribers.size === 0) this.entries.delete(key);
		};
	}

	/** Marca `key` para reconstrução no próximo flush (no-op se ninguém observa). */
	invalidate(key: string): void {
		if (!this.entries.has(key)) return;
		this.dirty.add(key);
		this.requestFlush();
	}

	flush(): void {
		for (const key of this.dirty) {
			const entry = this.entries.get(key);
			if (!entry) continue;
			entry.snapshot = this.build(key);
			this.notifySubscribers(entry.subscribers);
		}
		this.dirty.clear();
	}

	private notifySubscribers(subscribers: Set<Subscriber>): void {
		for (const s of subscribers)
			if (s.host && !s.host.isConnected) subscribers.delete(s);
		for (const s of subscribers) s.cb();
	}
}
