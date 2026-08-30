import { expect, test } from "@playwright/test";

test("shows the Spanish application heading", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Localizador digital de pedidos" }),
  ).toBeVisible();
});
