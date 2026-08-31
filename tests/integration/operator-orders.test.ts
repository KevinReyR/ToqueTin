import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cancelOrderRecord,
  createOrderRecord,
  transitionOrderRecord,
  updateOrderEstimateRecord,
} from "@/data/orders/supabase-order-repository";

function readLocalSupabaseEnvironment(): Record<string, string> {
  const output = execFileSync(
    "pnpm",
    ["exec", "supabase", "status", "-o", "env"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  return Object.fromEntries(
    output
      .trim()
      .split("\n")
      .flatMap((line) => {
        const separator = line.indexOf("=");
        if (separator < 1) return [];
        return [
          [
            line.slice(0, separator),
            line.slice(separator + 1).replaceAll(/^"|"$/g, ""),
          ],
        ];
      }),
  );
}

const localEnv = readLocalSupabaseEnvironment();
const url = localEnv.API_URL;
const publishableKey = localEnv.PUBLISHABLE_KEY;
const serviceRoleKey = localEnv.SERVICE_ROLE_KEY;

if (!url || !publishableKey || !serviceRoleKey) {
  throw new Error(
    "Supabase local debe estar iniciado antes de ejecutar test:integration.",
  );
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
const suffix = randomUUID();
const password = "Operator-pass-123";
let organizationId = "";
let restaurantAId = "";
let restaurantBId = "";
let operatorAId = "";
let operatorBId = "";
const operatorA = createClient(url, publishableKey, {
  auth: { persistSession: false },
});
const operatorB = createClient(url, publishableKey, {
  auth: { persistSession: false },
});

async function deleteFixtureRows() {
  if (restaurantAId || restaurantBId) {
    const restaurantIds = [restaurantAId, restaurantBId].filter(Boolean);
    const { data: orders } = await admin
      .from("orders")
      .select("id")
      .in("restaurant_id", restaurantIds);
    const orderIds = (orders ?? []).map((order) => order.id);
    if (orderIds.length) {
      const { data: sessions } = await admin
        .from("tracking_sessions")
        .select("id")
        .in("order_id", orderIds);
      const sessionIds = (sessions ?? []).map((session) => session.id);
      if (sessionIds.length)
        await admin
          .from("tracking_viewers")
          .delete()
          .in("tracking_session_id", sessionIds);
      await admin
        .from("order_status_history")
        .delete()
        .in("order_id", orderIds);
      await admin.from("tracking_sessions").delete().in("order_id", orderIds);
      await admin.from("orders").delete().in("id", orderIds);
    }
    await admin
      .from("restaurant_users")
      .delete()
      .in("restaurant_id", restaurantIds);
    await admin.from("restaurants").delete().in("id", restaurantIds);
  }
  if (organizationId)
    await admin.from("organizations").delete().eq("id", organizationId);
  if (operatorAId) await admin.auth.admin.deleteUser(operatorAId);
  if (operatorBId) await admin.auth.admin.deleteUser(operatorBId);
}

beforeAll(async () => {
  const { data: userA, error: userAError } = await admin.auth.admin.createUser({
    email: `operator-a-${suffix}@example.test`,
    password,
    email_confirm: true,
  });
  const { data: userB, error: userBError } = await admin.auth.admin.createUser({
    email: `operator-b-${suffix}@example.test`,
    password,
    email_confirm: true,
  });
  if (userAError || userBError || !userA.user || !userB.user)
    throw userAError ?? userBError;
  operatorAId = userA.user.id;
  operatorBId = userB.user.id;

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .insert({ name: `Integration ${suffix}` })
    .select("id")
    .single();
  if (organizationError || !organization) throw organizationError;
  organizationId = String(organization.id);

  const { data: restaurants, error: restaurantsError } = await admin
    .from("restaurants")
    .insert([
      { organization_id: organizationId, name: `A ${suffix}` },
      { organization_id: organizationId, name: `B ${suffix}` },
    ])
    .select("id, name");
  if (restaurantsError || !restaurants) throw restaurantsError;
  restaurantAId = String(restaurants[0]?.id);
  restaurantBId = String(restaurants[1]?.id);

  const { error: membershipError } = await admin
    .from("restaurant_users")
    .insert([
      { restaurant_id: restaurantAId, user_id: operatorAId },
      { restaurant_id: restaurantBId, user_id: operatorBId },
    ]);
  if (membershipError) throw membershipError;

  const signedA = await operatorA.auth.signInWithPassword({
    email: `operator-a-${suffix}@example.test`,
    password,
  });
  const signedB = await operatorB.auth.signInWithPassword({
    email: `operator-b-${suffix}@example.test`,
    password,
  });
  if (signedA.error || signedB.error) throw signedA.error ?? signedB.error;
});

afterAll(async () => {
  await deleteFixtureRows();
});

describe("operator order contracts against local Supabase", () => {
  it("creates an order, records its history, and rejects a duplicate", async () => {
    const readyAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const created = await createOrderRecord(
      {
        restaurantId: restaurantAId,
        orderNumber: "A-100",
        estimatedReadyAt: readyAt,
      },
      operatorA,
    );
    expect(created.status).toBe("RECEIVED");
    expect(created.trackingSession.publicNonce).toMatch(/^[0-9a-f-]{36}$/);

    await expect(
      createOrderRecord(
        {
          restaurantId: restaurantAId,
          orderNumber: " a-100 ",
          estimatedReadyAt: readyAt,
        },
        operatorA,
      ),
    ).rejects.toMatchObject({ rpcFailure: { code: "23505" } });

    const { data: history } = await admin
      .from("order_status_history")
      .select("id")
      .eq("order_id", created.id);
    expect(history).toHaveLength(1);
  });

  it("transitions idempotently, updates an estimate, and denies cross-restaurant mutation", async () => {
    const created = await createOrderRecord(
      {
        restaurantId: restaurantAId,
        orderNumber: "A-101",
        estimatedReadyAt: new Date(Date.now() + 45 * 60_000).toISOString(),
      },
      operatorA,
    );
    const preparing = await transitionOrderRecord(
      {
        orderId: created.id,
        expectedStatus: "RECEIVED",
        targetStatus: "PREPARING",
      },
      operatorA,
    );
    expect(preparing.idempotent).toBe(false);
    const repeated = await transitionOrderRecord(
      {
        orderId: created.id,
        expectedStatus: "RECEIVED",
        targetStatus: "PREPARING",
      },
      operatorA,
    );
    expect(repeated.idempotent).toBe(true);

    const estimate = await updateOrderEstimateRecord(
      {
        orderId: created.id,
        estimatedReadyAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      },
      operatorA,
    );
    expect(String(estimate.order_id)).toBe(created.id);

    await expect(
      transitionOrderRecord(
        {
          orderId: created.id,
          expectedStatus: "PREPARING",
          targetStatus: "READY",
        },
        operatorB,
      ),
    ).rejects.toMatchObject({ rpcFailure: { code: "42501" } });
  });

  it("cancels with a valid reason and preserves terminal state", async () => {
    const created = await createOrderRecord(
      {
        restaurantId: restaurantAId,
        orderNumber: "A-102",
        estimatedReadyAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
      operatorA,
    );
    const cancelled = await cancelOrderRecord(
      { orderId: created.id, reasonCode: "CUSTOMER_REQUEST" },
      operatorA,
    );
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.idempotent).toBe(false);

    const repeated = await cancelOrderRecord(
      { orderId: created.id, reasonCode: "CUSTOMER_REQUEST" },
      operatorA,
    );
    expect(repeated.idempotent).toBe(true);
  });
});
