import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { enableReadyAlertsRecord } from "@/data/notifications/supabase-notification-repository";
import {
  createOrderRecord,
  transitionOrderRecord,
} from "@/data/orders/supabase-order-repository";
import { grantTrackingViewer } from "@/data/tracking/supabase-tracking-repository";

function readLocalSupabaseEnvironment(): Record<string, string> {
  const output = execFileSync(
    "pnpm",
    ["exec", "supabase", "status", "-o", "env"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return Object.fromEntries(
    output
      .trim()
      .split("\n")
      .flatMap((line) => {
        const separator = line.indexOf("=");
        return separator < 1
          ? []
          : [
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
const operator = createClient(url, publishableKey, {
  auth: { persistSession: false },
});
const viewer = createClient(url, publishableKey, {
  auth: { persistSession: false },
});
const ungrantedViewer = createClient(url, publishableKey, {
  auth: { persistSession: false },
});

const suffix = randomUUID();
const password = "Operator-pass-123";
let organizationId = "";
let restaurantId = "";
let operatorId = "";
let viewerId = "";
let ungrantedViewerId = "";
let orderId = "";
let publicNonce = "";

function sql(query: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_ToqueTin",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-Atc",
      query,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

async function cleanFixtures() {
  if (orderId) {
    sql(`
      delete from private.notifications where order_id = ${orderId};
      delete from private.tracking_push_subscriptions
      where tracking_session_id in (
        select id from public.tracking_sessions where order_id = ${orderId}
      );
      delete from private.push_subscriptions
      where auth_user_id in ('${viewerId}'::uuid, '${ungrantedViewerId}'::uuid);
    `);
    await admin.from("order_status_history").delete().eq("order_id", orderId);
    await admin.from("tracking_viewers").delete().eq("auth_user_id", viewerId);
    await admin.from("tracking_sessions").delete().eq("order_id", orderId);
    await admin.from("orders").delete().eq("id", orderId);
  }
  if (restaurantId) {
    await admin
      .from("restaurant_users")
      .delete()
      .eq("restaurant_id", restaurantId);
    await admin.from("restaurants").delete().eq("id", restaurantId);
  }
  if (organizationId)
    await admin.from("organizations").delete().eq("id", organizationId);
  if (operatorId) await admin.auth.admin.deleteUser(operatorId);
  if (viewerId) await admin.auth.admin.deleteUser(viewerId);
  if (ungrantedViewerId) await admin.auth.admin.deleteUser(ungrantedViewerId);
}

beforeAll(async () => {
  const { data: operatorUser, error: operatorError } =
    await admin.auth.admin.createUser({
      email: `alerts-operator-${suffix}@example.test`,
      email_confirm: true,
      password,
    });
  if (operatorError || !operatorUser.user) throw operatorError;
  operatorId = operatorUser.user.id;

  const { data: anonymous, error: anonymousError } =
    await viewer.auth.signInAnonymously();
  const { data: ungranted, error: ungrantedError } =
    await ungrantedViewer.auth.signInAnonymously();
  if (anonymousError || ungrantedError || !anonymous.user || !ungranted.user) {
    throw anonymousError ?? ungrantedError;
  }
  viewerId = anonymous.user.id;
  ungrantedViewerId = ungranted.user.id;

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .insert({ name: `Alerts ${suffix}` })
    .select("id")
    .single();
  if (organizationError || !organization) throw organizationError;
  organizationId = String(organization.id);

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .insert({ organization_id: organizationId, name: `Push ${suffix}` })
    .select("id")
    .single();
  if (restaurantError || !restaurant) throw restaurantError;
  restaurantId = String(restaurant.id);

  const { error: membershipError } = await admin
    .from("restaurant_users")
    .insert({ restaurant_id: restaurantId, user_id: operatorId });
  if (membershipError) throw membershipError;
  const { error: signInError } = await operator.auth.signInWithPassword({
    email: `alerts-operator-${suffix}@example.test`,
    password,
  });
  if (signInError) throw signInError;

  const order = await createOrderRecord(
    {
      estimatedReadyAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      orderNumber: "PUSH-READY",
      restaurantId,
    },
    operator,
  );
  orderId = order.id;
  publicNonce = order.trackingSession.publicNonce;
  await grantTrackingViewer(
    { authUserId: viewerId, nonce: publicNonce },
    admin,
  );
});

afterAll(async () => {
  await cleanFixtures();
});

describe("ready notification lifecycle against local Supabase", () => {
  it("registers idempotently only for the granted anonymous viewer", async () => {
    const subscription = {
      endpoint: `https://push.example.test/${suffix}`,
      expirationTime: null,
      keys: {
        auth: "integration-auth-key",
        p256dh: "integration-p256dh-key-with-enough-length",
      },
    };

    await expect(
      enableReadyAlertsRecord(
        { authUserId: viewerId, nonce: publicNonce, subscription },
        admin,
      ),
    ).resolves.toBe(true);
    await expect(
      enableReadyAlertsRecord(
        { authUserId: viewerId, nonce: publicNonce, subscription },
        admin,
      ),
    ).resolves.toBe(true);
    await expect(
      enableReadyAlertsRecord(
        { authUserId: ungrantedViewerId, nonce: publicNonce, subscription },
        admin,
      ),
    ).resolves.toBe(false);

    expect(
      sql(`
        select count(*)
        from private.tracking_push_subscriptions as association
        join private.push_subscriptions as subscription
          on subscription.id = association.push_subscription_id
        where subscription.auth_user_id = '${viewerId}'::uuid
          and association.disabled_at is null;
      `),
    ).toBe("1");
  });

  it("enqueues READY once and applies the 1m, 5m, three-attempt policy", async () => {
    await transitionOrderRecord(
      { orderId, expectedStatus: "RECEIVED", targetStatus: "PREPARING" },
      operator,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    await transitionOrderRecord(
      { orderId, expectedStatus: "PREPARING", targetStatus: "READY" },
      operator,
    );

    expect(
      sql(
        `select count(*) from private.notifications where order_id = ${orderId};`,
      ),
    ).toBe("1");

    const first = await admin.rpc("claim_ready_notifications", { p_limit: 1 });
    expect(first.error).toBeNull();
    expect(first.data).toHaveLength(1);
    expect(first.data?.[0]).toMatchObject({
      attempt_count: 1,
      public_nonce: publicNonce,
    });
    expect(
      Number(
        sql(`
          select extract(epoch from (next_attempt_at - updated_at))::integer
          from private.notifications where order_id = ${orderId};
        `),
      ),
    ).toBe(60);

    await admin.rpc("record_notification_delivery", {
      p_error_code: "PUSH_UNAVAILABLE",
      p_notification_id: first.data?.[0]?.notification_id,
      p_outcome: "FAILED",
    });
    sql(
      `update private.notifications set next_attempt_at = now() where order_id = ${orderId};`,
    );
    const second = await admin.rpc("claim_ready_notifications", { p_limit: 1 });
    expect(second.data?.[0]?.attempt_count).toBe(2);
    expect(
      Number(
        sql(`
          select extract(epoch from (next_attempt_at - updated_at))::integer
          from private.notifications where order_id = ${orderId};
        `),
      ),
    ).toBe(300);

    await admin.rpc("record_notification_delivery", {
      p_error_code: "PUSH_RATE_LIMITED",
      p_notification_id: second.data?.[0]?.notification_id,
      p_outcome: "FAILED",
    });
    sql(
      `update private.notifications set next_attempt_at = now() where order_id = ${orderId};`,
    );
    const third = await admin.rpc("claim_ready_notifications", { p_limit: 1 });
    expect(third.data?.[0]?.attempt_count).toBe(3);
    await admin.rpc("record_notification_delivery", {
      p_error_code: "PUSH_UNAVAILABLE",
      p_notification_id: third.data?.[0]?.notification_id,
      p_outcome: "FAILED",
    });
    sql(
      `update private.notifications set next_attempt_at = now() where order_id = ${orderId};`,
    );
    const exhausted = await admin.rpc("claim_ready_notifications", {
      p_limit: 1,
    });
    expect(exhausted.data).toEqual([]);
    expect(
      sql(`
        select status || ':' || attempt_count || ':' || last_error_code
        from private.notifications where order_id = ${orderId};
      `),
    ).toBe("FAILED:3:PUSH_UNAVAILABLE");
  });

  it("expires an invalid subscription and disables its association", async () => {
    const notificationId = sql(
      `select id from private.notifications where order_id = ${orderId};`,
    );
    const result = await admin.rpc("record_notification_delivery", {
      p_error_code: "PUSH_EXPIRED",
      p_notification_id: notificationId,
      p_outcome: "EXPIRED",
    });
    expect(result.error).toBeNull();
    expect(result.data).toBe(true);
    expect(
      sql(`
        select notifications.status || ':' || subscriptions.last_error_code || ':' ||
          (associations.disabled_at is not null)::text
        from private.notifications as notifications
        join private.push_subscriptions as subscriptions
          on subscriptions.id = notifications.push_subscription_id
        join private.tracking_push_subscriptions as associations
          on associations.tracking_session_id = notifications.tracking_session_id
          and associations.push_subscription_id = notifications.push_subscription_id
        where notifications.id = ${notificationId};
      `),
    ).toBe("EXPIRED:PUSH_EXPIRED:true");
  });
});
