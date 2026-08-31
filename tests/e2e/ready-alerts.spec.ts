import { expect, test } from "@playwright/test";

const nonce = "123e4567-e89b-12d3-a456-426614174000";

async function mockActiveTracking(page: import("@playwright/test").Page) {
  await page.route(`**/api/tracking/${nonce}`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        cancellationReason: null,
        estimateUpdatedAt: "2026-08-31T12:00:00Z",
        estimatedReadyAt: "2026-08-31T12:30:00Z",
        orderNumber: "E2E-READY",
        pickupInstructions: "Retira en el mostrador.",
        restaurantName: "ToqueTin prueba",
        status: "PREPARING",
        trackingExpiresAt: null,
        updatedAt: "2026-08-31T12:00:00Z",
      }),
    });
  });
}

test("keeps optional alerts behind an explicit action and preserves tracking", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.set(window, "notificationPermissionRequests", 0);
    if (typeof Notification === "undefined") return;
    const nativeRequestPermission =
      Notification.requestPermission.bind(Notification);
    try {
      Object.defineProperty(Notification, "requestPermission", {
        configurable: true,
        value: () => {
          const current = Number(
            Reflect.get(window, "notificationPermissionRequests"),
          );
          Reflect.set(window, "notificationPermissionRequests", current + 1);
          return nativeRequestPermission();
        },
      });
    } catch {
      // Some WebKit contexts intentionally keep this API immutable.
    }
  });
  await mockActiveTracking(page);

  await page.goto(`/track/${nonce}`);

  await expect(
    page.getByRole("heading", { name: "Pedido E2E-READY" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Avísame cuando esté listo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Actualizar ahora" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Number(Reflect.get(window, "notificationPermissionRequests")),
      ),
    )
    .toBe(0);
});

test("ships the installable manifest without putting credentials in URLs", async ({
  page,
}) => {
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  await expect(manifest.json()).resolves.toMatchObject({
    display: "standalone",
    name: "ToqueTin",
    start_url: "/track",
  });

  await mockActiveTracking(page);
  await page.goto(`/track/${nonce}`);
  expect(page.url()).toContain(`/track/${nonce}`);
  expect(page.url()).not.toContain("v1.");
});

test("preserves the snapshot offline and reconciles after reconnecting", async ({
  context,
  page,
}) => {
  let status: "PREPARING" | "READY" = "PREPARING";
  let networkUnavailable = false;
  await page.route(`**/api/tracking/${nonce}`, async (route) => {
    if (networkUnavailable) {
      await route.abort("internetdisconnected");
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        cancellationReason: null,
        estimateUpdatedAt: "2026-08-31T12:00:00Z",
        estimatedReadyAt: "2026-08-31T12:30:00Z",
        orderNumber: "E2E-OFFLINE",
        pickupInstructions: "Retira en el mostrador.",
        restaurantName: "ToqueTin prueba",
        status,
        trackingExpiresAt: null,
        updatedAt:
          status === "READY" ? "2026-08-31T12:05:00Z" : "2026-08-31T12:00:00Z",
      }),
    });
  });

  await page.goto(`/track/${nonce}`);
  await expect(
    page.getByRole("heading", { name: "En preparación" }),
  ).toBeVisible();

  await context.setOffline(true);
  networkUnavailable = true;
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByText(/La conexión se interrumpió/)).toBeVisible();
  await expect(page.getByText("Pedido E2E-OFFLINE")).toBeVisible();
  status = "READY";
  await page.getByRole("button", { name: "Actualizar ahora" }).click();
  await expect(
    page.getByText(/Conservamos la última información/),
  ).toBeAttached();
  await expect(
    page.getByRole("heading", { name: "En preparación" }),
  ).toBeVisible();

  await context.setOffline(false);
  networkUnavailable = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.getByRole("button", { name: "Actualizar ahora" }).click();
  await expect(
    page.getByRole("heading", { name: "Listo para retirar" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Información actualizada.")).toBeAttached();
});
