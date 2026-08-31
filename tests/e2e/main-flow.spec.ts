import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const HMAC_SECRET = "12345678901234567890123456789012";
const PASSWORD = "Operator-pass-123";

function localEnvironment() {
  const output = execFileSync(
    "pnpm",
    ["exec", "supabase", "status", "-o", "env"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  return Object.fromEntries(
    output
      .trim()
      .split("\n")
      .map((line) => {
        const separator = line.indexOf("=");
        return [
          line.slice(0, separator),
          line.slice(separator + 1).replaceAll(/^"|"$/g, ""),
        ];
      }),
  );
}

function trackingToken(nonce: string) {
  const prefix = `v1.${nonce}`;
  const signature = createHmac("sha256", HMAC_SECRET)
    .update(`toquetin:tracking:${prefix}`)
    .digest("base64url");
  return `${prefix}.${signature}`;
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Correo de operador").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar al panel" }).click();
  await expect(page).toHaveURL(/\/operator$/);
}

async function createOrder(page: Page, orderNumber: string) {
  await page.goto("/operator/orders/new");
  await page.getByLabel("Número del pedido").fill(orderNumber);
  await page.getByLabel("Tiempo estimado (minutos)").fill("25");
  await page
    .getByLabel("Instrucciones de retiro")
    .fill("Retira en el mostrador principal.");
  await page.getByRole("button", { name: "Crear pedido y mostrar QR" }).click();
  await expect(page).toHaveURL(/\/operator\/orders\/\d+$/);
  const orderId = page.url().split("/").at(-1);
  if (!orderId) throw new Error("No se obtuvo el pedido creado.");
  await expect(
    page.getByRole("img", { name: `Código QR del pedido ${orderNumber}` }),
  ).toBeVisible();
  return orderId;
}

async function getTrackingNonce(admin: SupabaseClient, orderId: string) {
  const result = await admin
    .from("tracking_sessions")
    .select("public_nonce")
    .eq("order_id", orderId)
    .single();
  if (result.error) throw result.error;
  return String(result.data.public_nonce);
}

async function openTracking(
  context: BrowserContext,
  nonce: string,
  orderNumber: string,
) {
  const page = await context.newPage();
  const exchangeResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/tracking/exchange"),
  );
  await page.goto(`/track#${trackingToken(nonce)}`);
  expect((await exchangeResponse).status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`/track/${nonce}$`));
  await expect(
    page.getByRole("heading", { name: `Pedido ${orderNumber}` }),
  ).toBeVisible();
  await expect(
    page.getByText("Retira en el mostrador principal."),
  ).toBeVisible();
  await expect(page.getByText("Correo de operador")).toHaveCount(0);
  return page;
}

async function removeOrderFixtures(
  admin: SupabaseClient,
  restaurantIds: string[],
) {
  const orders = await admin
    .from("orders")
    .select("id")
    .in("restaurant_id", restaurantIds);
  const orderIds = (orders.data ?? []).map((row) => row.id);
  if (!orderIds.length) return;
  const sessions = await admin
    .from("tracking_sessions")
    .select("id")
    .in("order_id", orderIds);
  const sessionIds = (sessions.data ?? []).map((row) => row.id);
  if (sessionIds.length) {
    const subscriptions = await admin
      .schema("private")
      .from("tracking_push_subscriptions")
      .select("push_subscription_id")
      .in("tracking_session_id", sessionIds);
    await admin
      .schema("private")
      .from("notifications")
      .delete()
      .in("tracking_session_id", sessionIds);
    await admin
      .schema("private")
      .from("tracking_push_subscriptions")
      .delete()
      .in("tracking_session_id", sessionIds);
    const subscriptionIds = (subscriptions.data ?? []).map(
      (row) => row.push_subscription_id,
    );
    if (subscriptionIds.length) {
      await admin
        .schema("private")
        .from("push_subscriptions")
        .delete()
        .in("id", subscriptionIds);
    }
    await admin
      .from("tracking_viewers")
      .delete()
      .in("tracking_session_id", sessionIds);
  }
  await admin.from("order_status_history").delete().in("order_id", orderIds);
  await admin.from("tracking_sessions").delete().in("order_id", orderIds);
  await admin.from("orders").delete().in("id", orderIds);
}

test.describe.serial("flujo principal real y aislamiento", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "El flujo real se ejecuta una vez; la matriz responsive vive en los smoke E2E.",
    );
  });

  const env = localEnvironment();
  if (!env.API_URL || !env.PUBLISHABLE_KEY || !env.SERVICE_ROLE_KEY) {
    throw new Error("Supabase local no está disponible para el E2E.");
  }
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const operatorAData = createClient(env.API_URL, env.PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  });
  const suffix = randomUUID();
  const emailA = `e2e-a-${suffix}@example.test`;
  const emailB = `e2e-b-${suffix}@example.test`;
  let organizationId = "";
  let restaurantAId = "";
  let restaurantBId = "";
  let operatorAId = "";
  let operatorBId = "";

  test.beforeAll(async () => {
    const [userA, userB] = await Promise.all([
      admin.auth.admin.createUser({
        email: emailA,
        email_confirm: true,
        password: PASSWORD,
      }),
      admin.auth.admin.createUser({
        email: emailB,
        email_confirm: true,
        password: PASSWORD,
      }),
    ]);
    if (userA.error || userB.error || !userA.data.user || !userB.data.user) {
      throw userA.error ?? userB.error;
    }
    operatorAId = userA.data.user.id;
    operatorBId = userB.data.user.id;
    const organization = await admin
      .from("organizations")
      .insert({ name: `E2E ${suffix}` })
      .select("id")
      .single();
    if (organization.error) throw organization.error;
    organizationId = String(organization.data.id);
    const restaurants = await admin
      .from("restaurants")
      .insert([
        { organization_id: organizationId, name: `Restaurante A ${suffix}` },
        { organization_id: organizationId, name: `Restaurante B ${suffix}` },
      ])
      .select("id");
    if (restaurants.error || !restaurants.data) throw restaurants.error;
    restaurantAId = String(restaurants.data[0].id);
    restaurantBId = String(restaurants.data[1].id);
    const memberships = await admin.from("restaurant_users").insert([
      { restaurant_id: restaurantAId, user_id: operatorAId },
      { restaurant_id: restaurantBId, user_id: operatorBId },
    ]);
    if (memberships.error) throw memberships.error;
    const signedIn = await operatorAData.auth.signInWithPassword({
      email: emailA,
      password: PASSWORD,
    });
    if (signedIn.error) throw signedIn.error;
  });

  test.afterAll(async () => {
    await removeOrderFixtures(admin, [restaurantAId, restaurantBId]);
    await admin
      .from("restaurant_users")
      .delete()
      .in("restaurant_id", [restaurantAId, restaurantBId]);
    await admin
      .from("restaurants")
      .delete()
      .in("id", [restaurantAId, restaurantBId]);
    await admin.from("organizations").delete().eq("id", organizationId);
    await admin.auth.admin.deleteUser(operatorAId);
    await admin.auth.admin.deleteUser(operatorBId);
  });

  test("crea, abre el tracking, avanza, alerta, entrega y conserva trazabilidad", async ({
    browser,
    page,
  }) => {
    const orderNumber = `MAIN-${suffix.slice(0, 8)}`;
    await login(page, emailA);
    const orderId = await createOrder(page, orderNumber);
    const nonce = await getTrackingNonce(admin, orderId);
    const trackingContext = await browser.newContext();
    const tracking = await openTracking(trackingContext, nonce, orderNumber);

    await tracking
      .getByRole("button", { name: "Avísame cuando esté listo" })
      .click();
    await page.getByRole("button", { name: "Iniciar preparación" }).click();
    await expect(
      page.getByRole("heading", { name: "Preparando" }),
    ).toBeVisible();
    await expect(
      tracking.getByRole("heading", { name: "En preparación" }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByLabel("Ajustar tiempo estimado (minutos)").fill("40");
    await page.getByRole("button", { name: "Actualizar estimación" }).click();
    await expect(page.getByText("Pedido actualizado.")).toBeVisible();

    await page.getByRole("button", { name: "Marcar como listo" }).click();
    await expect(page.getByRole("heading", { name: "Listo" })).toBeVisible();
    await expect(
      tracking.getByRole("heading", { name: "Listo para retirar" }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Confirmar entrega" }).click();
    await expect(
      page.getByRole("heading", { name: "Entregado" }),
    ).toBeVisible();
    await expect(
      tracking.getByRole("heading", { name: "Pedido entregado" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: "Confirmar entrega" }),
    ).toHaveCount(0);

    const order = await admin
      .from("orders")
      .select(
        "preparing_at, ready_at, delivered_at, tracking_sessions(expires_at)",
      )
      .eq("id", orderId)
      .single();
    if (order.error) throw order.error;
    expect(order.data.preparing_at).toBeTruthy();
    expect(order.data.ready_at).toBeTruthy();
    expect(order.data.delivered_at).toBeTruthy();
    const history = await operatorAData
      .from("order_status_history")
      .select("to_status")
      .eq("order_id", orderId)
      .order("occurred_at");
    if (history.error) throw history.error;
    expect(history.data?.map((row) => row.to_status)).toEqual([
      "RECEIVED",
      "PREPARING",
      "READY",
      "DELIVERED",
    ]);
    await trackingContext.close();
  });

  test("cancela desde recibido y preparación y mantiene el motivo público", async ({
    browser,
    page,
  }) => {
    await login(page, emailA);
    for (const [index, startPreparing] of [false, true].entries()) {
      const number = `CANCEL-${index}-${suffix.slice(0, 6)}`;
      const orderId = await createOrder(page, number);
      const nonce = await getTrackingNonce(admin, orderId);
      const trackingContext = await browser.newContext();
      const tracking = await openTracking(trackingContext, nonce, number);
      if (startPreparing) {
        await page.getByRole("button", { name: "Iniciar preparación" }).click();
        await expect(
          page.getByRole("heading", { name: "Preparando" }),
        ).toBeVisible();
      }
      await page.getByRole("button", { name: "Cancelar pedido" }).click();
      await page.getByLabel("Motivo").selectOption("PRODUCT_UNAVAILABLE");
      await page.getByRole("button", { name: "Confirmar cancelación" }).click();
      await expect(
        page.getByRole("heading", { name: "Cancelado" }),
      ).toBeVisible();
      await expect(
        tracking.getByRole("heading", { name: "Pedido cancelado" }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(tracking.getByText("Producto no disponible")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Cancelar pedido" }),
      ).toHaveCount(0);
      await trackingContext.close();
    }
  });

  test("rechaza otro tenant, token alterado, revocación y expiración", async ({
    browser,
    page,
  }) => {
    await login(page, emailA);
    const number = `SECURE-${suffix.slice(0, 8)}`;
    const orderId = await createOrder(page, number);
    const nonce = await getTrackingNonce(admin, orderId);

    const foreignContext = await browser.newContext();
    const foreignPage = await foreignContext.newPage();
    await login(foreignPage, emailB);
    await foreignPage.goto(`/operator/orders/${orderId}`);
    await expect(foreignPage).toHaveURL(/\/operator$/);
    await expect(foreignPage.getByText(number)).toHaveCount(0);

    const invalidContext = await browser.newContext();
    const invalid = await invalidContext.newPage();
    const originalToken = trackingToken(nonce);
    const altered = `${originalToken.slice(0, -1)}${originalToken.endsWith("a") ? "b" : "a"}`;
    await invalid.goto(`/track#${altered}`);
    await expect(
      invalid.getByRole("heading", { name: "Este enlace no está disponible" }),
    ).toBeVisible();
    await expect(invalid.getByText(number)).toHaveCount(0);

    const trackingContext = await browser.newContext();
    const tracking = await openTracking(trackingContext, nonce, number);
    await page.getByRole("button", { name: "Desactivar seguimiento" }).click();
    await page.getByRole("button", { name: "Confirmar desactivación" }).click();
    await expect(page.getByText("Seguimiento no disponible")).toBeVisible();
    await expect(
      tracking.getByRole("heading", { name: "Este enlace no está disponible" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(tracking.getByText(number)).toHaveCount(0);

    const expiringId = await createOrder(page, `EXPIRE-${suffix.slice(0, 8)}`);
    const expiringNonce = await getTrackingNonce(admin, expiringId);
    const expiringContext = await browser.newContext();
    const expiring = await openTracking(
      expiringContext,
      expiringNonce,
      `EXPIRE-${suffix.slice(0, 8)}`,
    );
    const expiresAt = new Date(Date.now() + 4_000).toISOString();
    const sessionUpdate = await admin
      .from("tracking_sessions")
      .update({ expires_at: expiresAt })
      .eq("order_id", expiringId);
    if (sessionUpdate.error) throw sessionUpdate.error;
    await expiring.getByRole("button", { name: "Actualizar ahora" }).click();
    await expect(expiring.getByText("Información actualizada.")).toBeAttached();
    await expect(
      expiring.getByRole("heading", { name: "Este enlace no está disponible" }),
    ).toBeVisible({ timeout: 7_000 });
    await expect(
      expiring.getByText(`EXPIRE-${suffix.slice(0, 8)}`),
    ).toHaveCount(0);

    await Promise.all([
      foreignContext.close(),
      invalidContext.close(),
      trackingContext.close(),
      expiringContext.close(),
    ]);
  });
});
