import "server-only";

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createAdminClient } from "@/platform/supabase/admin";

const enabledAlertsRowSchema = z.object({
  push_enabled: z.literal(true),
});

export interface PushSubscriptionInput {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
}

export async function enableReadyAlertsRecord(
  input: {
    authUserId: string;
    nonce: string;
    subscription: PushSubscriptionInput;
  },
  suppliedClient?: SupabaseClient,
): Promise<boolean> {
  const supabase = suppliedClient ?? createAdminClient();
  const endpointDigest = createHash("sha256")
    .update(input.subscription.endpoint)
    .digest("hex");
  const expiresAt = input.subscription.expirationTime
    ? new Date(input.subscription.expirationTime).toISOString()
    : null;
  const { data, error } = await supabase.rpc("enable_ready_alerts", {
    p_auth_key: input.subscription.keys.auth,
    p_auth_user_id: input.authUserId,
    p_endpoint: input.subscription.endpoint,
    p_endpoint_digest: endpointDigest,
    p_expires_at: expiresAt,
    p_p256dh_key: input.subscription.keys.p256dh,
    p_public_nonce: input.nonce,
  });
  if (error) throw new Error("No fue posible activar las notificaciones.");
  return enabledAlertsRowSchema.safeParse(data?.[0]).success;
}
