import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { test as base, chromium, expect } from "@playwright/test";

const OBSIDIAN_CDP_URL =
	process.env.OBSIDIAN_CDP_URL ?? "http://127.0.0.1:9222";

const OBSIDIAN_REMOTE_DEBUGGING_PORT = "9222";
const OBSIDIAN_STARTUP_DELAY_IN_MS = 3_000;
const OBSIDIAN_CDP_READY_TIMEOUT_IN_MS = 15_000;
const OBSIDIAN_CDP_READY_POLL_INTERVAL_IN_MS = 500;
const OBSIDIAN_CDP_PROBE_TIMEOUT_IN_MS = 1_000;

function getObsidianCdpVersionEndpoint() {
	return new URL("/json/version", OBSIDIAN_CDP_URL);
}

async function connectToObsidianBrowser() {
	return chromium.connectOverCDP(OBSIDIAN_CDP_URL, {
		isLocal: true,
	});
}

function launchObsidianWithRemoteDebugging() {
	const childProcess = spawn(
		"bash",
		[
			"-lc",
			`nohup obsidian --remote-debugging-port=${OBSIDIAN_REMOTE_DEBUGGING_PORT} "obsidian://open?path=$(pwd)" >/dev/null 2>&1 &`,
		],
		{
			cwd: process.cwd(),
			stdio: "ignore",
			windowsHide: true,
		},
	);

	childProcess.unref();
}

async function waitForObsidianCdpToBeReady() {
	const deadline = Date.now() + OBSIDIAN_CDP_READY_TIMEOUT_IN_MS;

	while (Date.now() < deadline) {
		if (await isObsidianCdpReady()) {
			return;
		}

		await delay(OBSIDIAN_CDP_READY_POLL_INTERVAL_IN_MS);
	}
}

async function isObsidianCdpReady() {
	try {
		const response = await fetch(getObsidianCdpVersionEndpoint(), {
			signal: AbortSignal.timeout(OBSIDIAN_CDP_PROBE_TIMEOUT_IN_MS),
		});

		return response.ok;
	} catch {
		return false;
	}
}

async function connectToObsidianBrowserWithRetry() {
	if (!(await isObsidianCdpReady())) {
		launchObsidianWithRemoteDebugging();
		await delay(OBSIDIAN_STARTUP_DELAY_IN_MS);
		await waitForObsidianCdpToBeReady();

		return connectToObsidianBrowser();
	}

	try {
		return await connectToObsidianBrowser();
	} catch (_initialConnectionError) {
		launchObsidianWithRemoteDebugging();
		await delay(OBSIDIAN_STARTUP_DELAY_IN_MS);
		await waitForObsidianCdpToBeReady();

		try {
			return await connectToObsidianBrowser();
		} catch (retryConnectionError) {
			const retryFailureMessage =
				retryConnectionError instanceof Error
					? retryConnectionError.message
					: String(retryConnectionError);

			throw new Error(
				`Failed to connect to Obsidian at ${OBSIDIAN_CDP_URL} after launching it with remote debugging enabled. ${retryFailureMessage}`,
			);
		}
	}
}

export const test = base.extend<{
	browser: Browser;
	context: BrowserContext;
	page: Page;
}>({
	browser: [
		async ({ playwright: _playwright }, use) => {
			const browser = await connectToObsidianBrowserWithRetry();
			await use(browser);
			await browser.close();
		},
		{ scope: "worker" },
	],
	context: async ({ browser }, use) => {
		const existingContext = browser.contexts()[0];
		const context = existingContext ?? (await browser.newContext());
		const shouldCloseContext = !existingContext;

		try {
			await use(context);
		} finally {
			if (shouldCloseContext) {
				await context.close();
			}
		}
	},
	page: async ({ context }, use) => {
		const existingPage = context.pages()[0];
		const page = existingPage ?? (await context.newPage());
		const shouldClosePage = !existingPage;

		try {
			await use(page);
		} finally {
			if (shouldClosePage) {
				await page.close();
			}
		}
	},
});

export { expect };
