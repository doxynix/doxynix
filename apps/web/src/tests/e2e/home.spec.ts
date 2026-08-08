import { expect, test } from "@playwright/test";

test("home page opens", async ({ page }) => {
  await page.goto("/");
  await expect.soft(page.locator("body")).toBeVisible();
});
