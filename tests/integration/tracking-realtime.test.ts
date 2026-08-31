import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createOrderRecord,
  revokeTrackingSessionRecord,
  transitionOrderRecord,
  updateOrderEstimateRecord,
} from "@/data/orders/supabase-order-repository";
import {
  getPublicTrackingSnapshotRecord,
  grantTrackingViewer,
} from "@/data/tracking/supabase-tracking-repository";
import {
  createTrackingToken,
  validateTrackingToken,
} from "@/application/tracking/tracking-token";

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
const otherViewer = createClient(url, publishableKey, {
  auth: { persistSession: false },
});
const suffix = randomUUID();
const password = "Operator-pass-123";
let organizationId = "";
let restaurantId = "";
let operatorId = "";
let viewerId = "";
let otherViewerId = "";

async function cleanFixtures() {
  if (restaurantId) {
    const { data: orders } = await admin
      .from("orders")
      .select("id")
      .eq("restaurant_id", restaurantId);
    const orderIds = (orders ?? []).map((row) => row.id);
    if (orderIds.length) {
      const { data: sessions } = await admin
        .from("tracking_sessions")
        .select("id")
        .in("order_id", orderIds);
      const sessionIds = (sessions ?? []).map((row) => row.id);
      if (sessionIds.length) {
        await admin
          .from("tracking_viewers")
          .delete()
          .in("tracking_session_id", sessionIds);
      }
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
      .eq("restaurant_id", restaurantId);
    await admin.from("restaurants").delete().eq("id", restaurantId);
  }
  if (organizationId)
    await admin.from("organizations").delete().eq("id", organizationId);
  if (operatorId) await admin.auth.admin.deleteUser(operatorId);
  if (viewerId) await admin.auth.admin.deleteUser(viewerId);
  if (otherViewerId) await admin.auth.admin.deleteUser(otherViewerId);
}

beforeAll(async () => {
  const { data: operatorUser, error: operatorError } =
    await admin.auth.admin.createUser({
      email: `tracking-operator-${suffix}@example.test`,
      password,
      email_confirm: true,
    });
  if (operatorError || !operatorUser.user) throw operatorError;
  operatorId = operatorUser.user.id;

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .insert({ name: `Tracking ${suffix}` })
    .select("id")
    .single();
  if (organizationError || !organization) throw organizationError;
  organizationId = String(organization.id);

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .insert({ organization_id: organizationId, name: `Realtime ${suffix}` })
    .select("id")
    .single();
  if (restaurantError || !restaurant) throw restaurantError;
  restaurantId = String(restaurant.id);

  const { error: membershipError } = await admin
    .from("restaurant_users")
    .insert({ restaurant_id: restaurantId, user_id: operatorId });
  if (membershipError) throw membershipError;

  const { error: signInError } = await operator.auth.signInWithPassword({
    email: `tracking-operator-${suffix}@example.test`,
    password,
  });
  if (signInError) throw signInError;

  const { data: anonymousData, error: anonymousError } =
    await viewer.auth.signInAnonymously();
  if (anonymousError || !anonymousData.user) throw anonymousError;
  viewerId = anonymousData.user.id;

  const { data: otherAnonymousData, error: otherAnonymousError } =
    await otherViewer.auth.signInAnonymously();
  if (otherAnonymousError || !otherAnonymousData.user)
    throw otherAnonymousError;
  otherViewerId = otherAnonymousData.user.id;
});

afterAll(async () => {
  await viewer.removeAllChannels();
  await otherViewer.removeAllChannels();
  await cleanFixtures();
});

describe("tracking exchange and lifecycle", () => {
  it("accepts only a valid token and isolates the granted snapshot", async () => {
    const order = await createOrderRecord(
      {
        restaurantId,
        orderNumber: "TRACK-EXCHANGE",
        estimatedReadyAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
      operator,
    );
    const token = createTrackingToken({
      nonce: order.trackingSession.publicNonce,
      version: order.trackingSession.tokenVersion,
    });
    const valid = validateTrackingToken(token);
    expect(valid).toEqual({
      nonce: order.trackingSession.publicNonce,
      version: 1,
    });
    const alteredLastCharacter = token.endsWith("x") ? "y" : "x";
    expect(
      validateTrackingToken(`${token.slice(0, -1)}${alteredLastCharacter}`),
    ).toBeNull();

    await expect(
      grantTrackingViewer(
        { authUserId: viewerId, nonce: valid?.nonce ?? "" },
        admin,
      ),
    ).resolves.toBe(true);
    await expect(
      grantTrackingViewer({ authUserId: viewerId, nonce: randomUUID() }, admin),
    ).resolves.toBe(false);

    await expect(
      getPublicTrackingSnapshotRecord(
        { authUserId: viewerId, nonce: order.trackingSession.publicNonce },
        admin,
      ),
    ).resolves.toMatchObject({
      orderNumber: "TRACK-EXCHANGE",
      status: "RECEIVED",
    });
    await expect(
      getPublicTrackingSnapshotRecord(
        {
          authUserId: otherViewerId,
          nonce: order.trackingSession.publicNonce,
        },
        admin,
      ),
    ).resolves.toBeNull();
  });

  it("revokes an authorized tracking and makes its snapshot unavailable", async () => {
    const order = await createOrderRecord(
      {
        restaurantId,
        orderNumber: "TRACK-REVOKE",
        estimatedReadyAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
      operator,
    );
    await grantTrackingViewer(
      { authUserId: viewerId, nonce: order.trackingSession.publicNonce },
      admin,
    );

    const revoked = await revokeTrackingSessionRecord(order.id, operator);
    expect(revoked.orderId).toBe(order.id);
    await expect(
      getPublicTrackingSnapshotRecord(
        { authUserId: viewerId, nonce: order.trackingSession.publicNonce },
        admin,
      ),
    ).resolves.toBeNull();

    const { data: viewerGrant } = await admin
      .from("tracking_viewers")
      .select("revoked_at")
      .eq("auth_user_id", viewerId)
      .eq(
        "tracking_session_id",
        (
          await admin
            .from("tracking_sessions")
            .select("id")
            .eq("order_id", order.id)
            .single()
        ).data?.id,
      )
      .single();
    expect(viewerGrant?.revoked_at).toBe(revoked.revokedAt);
  });

  it("stops returning a snapshot after the tracking expiration", async () => {
    const order = await createOrderRecord(
      {
        restaurantId,
        orderNumber: "TRACK-EXPIRE",
        estimatedReadyAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
      operator,
    );
    await grantTrackingViewer(
      { authUserId: viewerId, nonce: order.trackingSession.publicNonce },
      admin,
    );
    await expect(
      getPublicTrackingSnapshotRecord(
        { authUserId: viewerId, nonce: order.trackingSession.publicNonce },
        admin,
      ),
    ).resolves.not.toBeNull();

    const { data: session, error: sessionError } = await admin
      .from("tracking_sessions")
      .select("id")
      .eq("order_id", order.id)
      .single();
    if (sessionError || !session) throw sessionError;
    const { data: viewerGrant, error: viewerGrantError } = await admin
      .from("tracking_viewers")
      .select("granted_at")
      .eq("tracking_session_id", session.id)
      .eq("auth_user_id", viewerId)
      .single();
    if (viewerGrantError || !viewerGrant) throw viewerGrantError;
    const { error: expireError } = await admin
      .from("tracking_sessions")
      .update({ expires_at: viewerGrant.granted_at })
      .eq("id", session.id);
    if (expireError) throw expireError;

    await expect(
      getPublicTrackingSnapshotRecord(
        { authUserId: viewerId, nonce: order.trackingSession.publicNonce },
        admin,
      ),
    ).resolves.toBeNull();
  });
});

describe("private tracking broadcast", () => {
  it("delivers a minimal update only on the viewer's granted topic", async () => {
    const order = await createOrderRecord(
      {
        restaurantId,
        orderNumber: "TRACK-REALTIME",
        estimatedReadyAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
      operator,
    );
    const { error: grantError } = await admin.rpc("grant_tracking_viewer", {
      p_auth_user_id: viewerId,
      p_public_nonce: order.trackingSession.publicNonce,
    });
    if (grantError) throw grantError;

    await viewer.realtime.setAuth();
    const event = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Broadcast timeout")),
        10_000,
      );
      const channel = viewer
        .channel(`tracking:${order.trackingSession.publicNonce}`, {
          config: { private: true },
        })
        .on("broadcast", { event: "order_changed" }, ({ payload }) => {
          clearTimeout(timeout);
          resolve(payload as Record<string, unknown>);
        });
      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          reject(new Error(`Realtime subscription failed: ${status}`));
        }
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 300));
    await transitionOrderRecord(
      {
        orderId: order.id,
        expectedStatus: "RECEIVED",
        targetStatus: "PREPARING",
      },
      operator,
    );

    await expect(event).resolves.toMatchObject({
      status: "PREPARING",
      type: "STATUS_CHANGED",
      version: "2",
    });
    await expect(event).resolves.not.toHaveProperty("orderId");
    await expect(event).resolves.not.toHaveProperty("created_by");
  }, 15_000);

  it("rejects a topic that was not granted to the anonymous viewer", async () => {
    await viewer.realtime.setAuth();
    const channel = viewer.channel(`tracking:${randomUUID()}`, {
      config: { private: true },
    });
    const denied = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Authorization timeout")),
        8_000,
      );
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          reject(new Error("Unauthorized topic was subscribed"));
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          resolve(status);
        }
      });
    });

    await expect(denied).resolves.toMatch(/CHANNEL_ERROR|TIMED_OUT/);
    await viewer.removeChannel(channel);
  }, 10_000);

  it("recovers changes missed while disconnected through an authoritative snapshot", async () => {
    const order = await createOrderRecord(
      {
        restaurantId,
        orderNumber: "TRACK-RECOVERY",
        estimatedReadyAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
      operator,
    );
    await grantTrackingViewer(
      { authUserId: viewerId, nonce: order.trackingSession.publicNonce },
      admin,
    );

    await transitionOrderRecord(
      {
        orderId: order.id,
        expectedStatus: "RECEIVED",
        targetStatus: "PREPARING",
      },
      operator,
    );
    const estimate = await updateOrderEstimateRecord(
      {
        orderId: order.id,
        estimatedReadyAt: new Date(Date.now() + 50 * 60_000).toISOString(),
      },
      operator,
    );

    const recovered = await getPublicTrackingSnapshotRecord(
      { authUserId: viewerId, nonce: order.trackingSession.publicNonce },
      admin,
    );
    expect(recovered).toMatchObject({
      status: "PREPARING",
      estimatedReadyAt: estimate.estimated_ready_at,
      estimateUpdatedAt: estimate.estimate_updated_at,
    });

    await viewer.realtime.setAuth();
    const channel = viewer.channel(
      `tracking:${order.trackingSession.publicNonce}`,
      { config: { private: true } },
    );
    const subscribed = new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(new Error(`Realtime resubscription failed: ${status}`));
        }
      });
    });
    await subscribed;
    await viewer.removeChannel(channel);
  }, 15_000);

  it("delivers a minimal revocation event to an already granted topic", async () => {
    const order = await createOrderRecord(
      {
        restaurantId,
        orderNumber: "TRACK-REVOKE-EVENT",
        estimatedReadyAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
      operator,
    );
    await grantTrackingViewer(
      { authUserId: viewerId, nonce: order.trackingSession.publicNonce },
      admin,
    );
    await viewer.realtime.setAuth();
    const channel = viewer.channel(
      `tracking:${order.trackingSession.publicNonce}`,
      { config: { private: true } },
    );
    let eventTimeout: ReturnType<typeof setTimeout> | undefined;
    const event = new Promise<Record<string, unknown>>((resolve, reject) => {
      eventTimeout = setTimeout(
        () => reject(new Error("Revocation broadcast timeout")),
        10_000,
      );
      channel.on("broadcast", { event: "tracking_revoked" }, ({ payload }) => {
        if (eventTimeout) clearTimeout(eventTimeout);
        resolve(payload as Record<string, unknown>);
      });
    });
    const subscribed = new Promise<void>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(new Error(`Realtime subscription failed: ${status}`));
        }
      });
    });
    await subscribed;
    await revokeTrackingSessionRecord(order.id, operator);

    await expect(event).resolves.toMatchObject({ type: "TRACKING_REVOKED" });
    await expect(event).resolves.not.toHaveProperty("orderId");
    await expect(event).resolves.not.toHaveProperty("nonce");
    await expect(event).resolves.not.toHaveProperty("token");
    await viewer.removeChannel(channel);
  }, 15_000);
});
