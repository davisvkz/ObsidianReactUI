import { writeFileSync } from "fs";
import { expect, test } from "./obsidian-test";

test("connects to the running Obsidian window", async ({ page }) => {
	await page.waitForLoadState("domcontentloaded");
	page.evaluate(() => {
		app.workspace.floatingLeaves.forEach(leaf => {
			leaf.detach();
		});
	})
	await expect(page.locator("body")).toBeVisible();
});
