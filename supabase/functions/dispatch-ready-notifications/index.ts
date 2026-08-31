import "@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "@supabase/supabase-js";
import {
  ApplicationServer,
  importVapidKeys,
  PushMessageError,
  Urgency,
} from "@negrel/webpush";

interface ClaimedNotification {
  notification_id: number | string;
  attempt_count: number;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  public_nonce: string;
}

type DeliveryOutcome = "SENT" | "FAILED" | "EXPIRED";

const encoder = new TextEncoder();

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required configuration: ${name}`);
  return value;
}

function decodeBase64Url(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function importConfiguredVapidKeys() {
  const publicKey = decodeBase64Url(
    requiredEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
  );
  const privateKey = decodeBase64Url(requiredEnv("VAPID_PRIVATE_KEY"));
  if (
    publicKey.length !== 65 ||
    publicKey[0] !== 4 ||
    privateKey.length !== 32
  ) {
    throw new Error("Invalid VAPID key configuration");
  }
  return importVapidKeys({
    privateKey: {
      crv: "P-256",
      d: encodeBase64Url(privateKey),
      ext: true,
      key_ops: ["sign"],
      kty: "EC",
      x: encodeBase64Url(publicKey.slice(1, 33)),
      y: encodeBase64Url(publicKey.slice(33, 65)),
    },
    publicKey: {
      crv: "P-256",
      ext: true,
      key_ops: ["verify"],
      kty: "EC",
      x: encodeBase64Url(publicKey.slice(1, 33)),
      y: encodeBase64Url(publicKey.slice(33, 65)),
    },
  });
}

let applicationServerPromise: Promise<ApplicationServer> | undefined;

function getApplicationServer() {
  applicationServerPromise ??= importConfiguredVapidKeys().then((vapidKeys) =>
    ApplicationServer.new({
      contactInformation:
        Deno.env.get("VAPID_SUBJECT") ?? "mailto:notifications@toquetin.app",
      vapidKeys,
    }),
  );
  return applicationServerPromise;
}

async function secureEquals(left: string, right: string): Promise<boolean> {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function classifyPushError(error: unknown): {
  errorCode: string;
  outcome: DeliveryOutcome;
} {
  if (error instanceof PushMessageError) {
    if (error.response.status === 404 || error.response.status === 410) {
      return { errorCode: "PUSH_EXPIRED", outcome: "EXPIRED" };
    }
    if (error.response.status === 429) {
      return { errorCode: "PUSH_RATE_LIMITED", outcome: "FAILED" };
    }
    return { errorCode: "PUSH_REJECTED", outcome: "FAILED" };
  }
  return { errorCode: "PUSH_UNAVAILABLE", outcome: "FAILED" };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405 });
  }

  try {
    const suppliedSecret = request.headers.get("x-dispatch-secret") ?? "";
    const expectedSecret = requiredEnv("NOTIFICATION_DISPATCH_SECRET");
    if (!(await secureEquals(suppliedSecret, expectedSecret))) {
      return Response.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const supabase = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const { data, error } = await supabase.rpc("claim_ready_notifications", {
      p_limit: 25,
    });
    if (error) throw new Error("Notification claim failed");
    const claimed = (data ?? []) as ClaimedNotification[];
    const server = claimed.length > 0 ? await getApplicationServer() : null;
    let sent = 0;
    let failed = 0;
    let expired = 0;

    for (const notification of claimed) {
      let outcome: DeliveryOutcome = "SENT";
      let errorCode: string | null = null;
      try {
        const subscriber = server!.subscribe({
          endpoint: notification.endpoint,
          keys: {
            auth: notification.auth_key,
            p256dh: notification.p256dh_key,
          },
        });
        await subscriber.pushTextMessage(
          JSON.stringify({
            type: "ORDER_READY",
            url: `/track/${notification.public_nonce}`,
          }),
          { topic: "order-ready", ttl: 86_400, urgency: Urgency.High },
        );
        sent += 1;
      } catch (pushError) {
        const classified = classifyPushError(pushError);
        outcome = classified.outcome;
        errorCode = classified.errorCode;
        if (outcome === "EXPIRED") expired += 1;
        else failed += 1;
      }

      const { error: recordError } = await supabase.rpc(
        "record_notification_delivery",
        {
          p_error_code: errorCode,
          p_notification_id: notification.notification_id,
          p_outcome: outcome,
        },
      );
      if (recordError) throw new Error("Notification result recording failed");
    }

    console.info("Notification dispatch completed", {
      expired,
      failed,
      processed: claimed.length,
      sent,
    });
    return Response.json({ expired, failed, processed: claimed.length, sent });
  } catch {
    console.error("Notification dispatch failed");
    return Response.json({ error: "DISPATCH_UNAVAILABLE" }, { status: 503 });
  }
});
