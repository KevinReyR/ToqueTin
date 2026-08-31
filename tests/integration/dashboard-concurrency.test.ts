import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  getDashboardSummaryRecord,
  DashboardRpcError,
} from "@/data/dashboard/supabase-dashboard-repository";
import {
  createOrderRecord,
  OrderRpcError,
  transitionOrderRecord,
} from "@/data/orders/supabase-order-repository";
import { scheduleOperationalCutoffRecord } from "@/data/restaurants/supabase-restaurant-repository";

function localEnvironment() {
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
      .map((line) => {
        const separator = line.indexOf("=");
        return [
          line.slice(0, separator),
          line.slice(separator + 1).replaceAll(/^"|"$/g, ""),
        ];
      }),
  );
}

const env = localEnvironment();
if (!env.API_URL || !env.PUBLISHABLE_KEY || !env.SERVICE_ROLE_KEY)
  throw new Error("Supabase local no está disponible.");
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const operatorA = createClient(env.API_URL, env.PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});
const operatorASecondSession = createClient(env.API_URL, env.PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});
const operatorB = createClient(env.API_URL, env.PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});

const suffix = randomUUID();
const password = "Operator-pass-123";
let organizationId = "";
let restaurantAId = "";
let restaurantBId = "";
let operatorAId = "";
let operatorBId = "";

beforeAll(async () => {
  const [a, b] = await Promise.all([
    admin.auth.admin.createUser({
      email: `dashboard-a-${suffix}@example.test`,
      password,
      email_confirm: true,
    }),
    admin.auth.admin.createUser({
      email: `dashboard-b-${suffix}@example.test`,
      password,
      email_confirm: true,
    }),
  ]);
  if (a.error || b.error || !a.data.user || !b.data.user)
    throw a.error ?? b.error;
  operatorAId = a.data.user.id;
  operatorBId = b.data.user.id;
  const organization = await admin
    .from("organizations")
    .insert({ name: `Dashboard ${suffix}` })
    .select("id")
    .single();
  if (organization.error) throw organization.error;
  organizationId = String(organization.data.id);
  const restaurants = await admin
    .from("restaurants")
    .insert([
      { organization_id: organizationId, name: `Dashboard A ${suffix}` },
      { organization_id: organizationId, name: `Dashboard B ${suffix}` },
    ])
    .select("id");
  if (restaurants.error || !restaurants.data) throw restaurants.error;
  restaurantAId = String(restaurants.data[0].id);
  restaurantBId = String(restaurants.data[1].id);
  const membership = await admin.from("restaurant_users").insert([
    { restaurant_id: restaurantAId, user_id: operatorAId },
    { restaurant_id: restaurantBId, user_id: operatorBId },
  ]);
  if (membership.error) throw membership.error;
  const credentialsA = {
    email: `dashboard-a-${suffix}@example.test`,
    password,
  };
  const [signedA, signedASecond, signedB] = await Promise.all([
    operatorA.auth.signInWithPassword(credentialsA),
    operatorASecondSession.auth.signInWithPassword(credentialsA),
    operatorB.auth.signInWithPassword({
      email: `dashboard-b-${suffix}@example.test`,
      password,
    }),
  ]);
  if (signedA.error || signedASecond.error || signedB.error)
    throw signedA.error ?? signedASecond.error ?? signedB.error;
});

afterAll(async () => {
  const orders = await admin
    .from("orders")
    .select("id")
    .in("restaurant_id", [restaurantAId, restaurantBId]);
  const ids = (orders.data ?? []).map((order) => order.id);
  if (ids.length) {
    const sessions = await admin
      .from("tracking_sessions")
      .select("id")
      .in("order_id", ids);
    const sessionIds = (sessions.data ?? []).map((session) => session.id);
    if (sessionIds.length)
      await admin
        .from("tracking_viewers")
        .delete()
        .in("tracking_session_id", sessionIds);
    await admin.from("order_status_history").delete().in("order_id", ids);
    await admin.from("tracking_sessions").delete().in("order_id", ids);
    await admin.from("orders").delete().in("id", ids);
  }
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

describe("dashboard and concurrency against local Supabase", () => {
  it("summarizes only the authorized restaurant and schedules the next cutoff", async () => {
    await createOrderRecord(
      {
        restaurantId: restaurantAId,
        orderNumber: "DASH-1",
        estimatedReadyAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
      operatorA,
    );
    await createOrderRecord(
      {
        restaurantId: restaurantBId,
        orderNumber: "DASH-2",
        estimatedReadyAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
      operatorB,
    );

    const summary = await getDashboardSummaryRecord(
      { restaurantId: restaurantAId },
      operatorA,
    );
    expect(summary.restaurantId).toBe(restaurantAId);
    expect(summary.totalCreated).toBe(1);
    expect(summary.orders.map((order) => order.orderNumber)).toEqual([
      "DASH-1",
    ]);
    await expect(
      getDashboardSummaryRecord({ restaurantId: restaurantBId }, operatorA),
    ).rejects.toBeInstanceOf(DashboardRpcError);

    const scheduled = await scheduleOperationalCutoffRecord(
      { restaurantId: restaurantAId, cutoffTime: "06:30" },
      operatorA,
    );
    expect(scheduled.dayCutoffTime).toBe("00:00:00");
    expect(scheduled.pendingDayCutoffTime).toBe("06:30:00");
    await expect(
      scheduleOperationalCutoffRecord(
        { restaurantId: restaurantBId, cutoffTime: "07:00" },
        operatorA,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("serializes duplicate creation and simultaneous transitions", async () => {
    const estimate = new Date(Date.now() + 45 * 60_000).toISOString();
    const creations = await Promise.allSettled([
      createOrderRecord(
        {
          restaurantId: restaurantAId,
          orderNumber: "RACE-CREATE",
          estimatedReadyAt: estimate,
        },
        operatorA,
      ),
      createOrderRecord(
        {
          restaurantId: restaurantAId,
          orderNumber: "RACE-CREATE",
          estimatedReadyAt: estimate,
        },
        operatorASecondSession,
      ),
    ]);
    expect(
      creations.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejection = creations.find(
      (result) => result.status === "rejected",
    ) as PromiseRejectedResult;
    expect(rejection.reason).toBeInstanceOf(OrderRpcError);
    expect(rejection.reason.rpcFailure.code).toBe("23505");

    const order = creations.find(
      (result) => result.status === "fulfilled",
    ) as PromiseFulfilledResult<Awaited<ReturnType<typeof createOrderRecord>>>;
    const transitions = await Promise.all([
      transitionOrderRecord(
        {
          orderId: order.value.id,
          expectedStatus: "RECEIVED",
          targetStatus: "PREPARING",
        },
        operatorA,
      ),
      transitionOrderRecord(
        {
          orderId: order.value.id,
          expectedStatus: "RECEIVED",
          targetStatus: "PREPARING",
        },
        operatorASecondSession,
      ),
    ]);
    expect(transitions.filter((result) => result.idempotent)).toHaveLength(1);
    const history = await admin
      .from("order_status_history")
      .select("id")
      .eq("order_id", order.value.id);
    expect(history.data).toHaveLength(2);
  });
});
