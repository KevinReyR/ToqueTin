import { expect, test } from "@playwright/test";

test("shows the Spanish operator login", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "Operación del restaurante" }),
  ).toBeVisible();
});
