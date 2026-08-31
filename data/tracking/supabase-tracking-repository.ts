import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { PublicTrackingSnapshot } from "@/domain/tracking/public-tracking-snapshot";
import { ORDER_STATUSES } from "@/domain/orders/types";
import { createAdminClient } from "@/platform/supabase/admin";

const trackingSnapshotRowSchema = z.object({
  restaurant_name: z.string(),
  order_number: z.string(),
  status: z.enum(ORDER_STATUSES),
  estimated_ready_at: z.string(),
  estimate_updated_at: z.string(),
  pickup_instructions: z.string().nullable(),
  cancellation_reason: z.string().nullable(),
  tracking_expires_at: z.string().nullable(),
  updated_at: z.string(),
});

export async function grantTrackingViewer(
  input: {
    nonce: string;
    authUserId: string;
  },
  suppliedClient?: SupabaseClient,
): Promise<boolean> {
  const supabase = suppliedClient ?? createAdminClient();
  const { data, error } = await supabase.rpc("grant_tracking_viewer", {
    p_auth_user_id: input.authUserId,
    p_public_nonce: input.nonce,
  });
  if (error) throw new Error("No fue posible preparar el seguimiento.");
  return Array.isArray(data) && data.length === 1;
}

export async function getPublicTrackingSnapshotRecord(
  input: {
    nonce: string;
    authUserId: string;
  },
  suppliedClient?: SupabaseClient,
): Promise<PublicTrackingSnapshot | null> {
  const supabase = suppliedClient ?? createAdminClient();
  const { data, error } = await supabase.rpc("get_public_tracking_snapshot", {
    p_auth_user_id: input.authUserId,
    p_public_nonce: input.nonce,
  });
  if (error) throw new Error("No fue posible consultar el seguimiento.");
  const row = trackingSnapshotRowSchema.safeParse(data?.[0]);
  if (!row.success) return null;

  return {
    restaurantName: row.data.restaurant_name,
    orderNumber: row.data.order_number,
    status: row.data.status,
    estimatedReadyAt: row.data.estimated_ready_at,
    estimateUpdatedAt: row.data.estimate_updated_at,
    pickupInstructions: row.data.pickup_instructions,
    cancellationReason: row.data.cancellation_reason,
    trackingExpiresAt: row.data.tracking_expires_at,
    updatedAt: row.data.updated_at,
  };
}
