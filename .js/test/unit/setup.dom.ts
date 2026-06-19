import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// react-router v7 creates `new Request(path)` on every navigation.
// The `Request` global in Node.js (undici) requires an absolute URL; jsdom does
// not replace this global. Minimal patch: resolve relative paths against
// "http://localhost" before forwarding to the original constructor.
const OriginalRequest = globalThis.Request;
// biome-ignore lint/suspicious/noExplicitAny: jsdom ↔ undici compatibility patch
globalThis.Request = function Request(input: any, init?: RequestInit) {
	const url =
		typeof input === "string" && input.startsWith("/")
			? `http://localhost${input}`
			: input;
	return new OriginalRequest(url, init);
} as unknown as typeof globalThis.Request;

// Automatic cleanup after each DOM test
afterEach(cleanup);

// Mantine requires window.matchMedia (absent in jsdom)
Object.defineProperty(window, "matchMedia", {
	value: (query: string) => ({
		addEventListener: () => {},
		addListener: () => {},
		dispatchEvent: () => false,
		matches: false,
		media: query,
		onchange: null,
		removeEventListener: () => {},
		removeListener: () => {},
	}),
	writable: true,
});

// Mantine requires ResizeObserver (absent in jsdom)
global.ResizeObserver = class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
};
