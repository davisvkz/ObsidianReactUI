import { expect, test } from "./obsidian-test";

test("connects to the running Obsidian window", async ({ page }) => {
	await page.waitForLoadState("domcontentloaded");
	page.evaluate(()=>{console.log('a')})
	await expect(page.locator("body")).toBeVisible();
});
