import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  OperatorOrder,
  OperatorOrderDetail,
  TrackingSessionCredentials,
} from "@/domain/orders/operator-order";
import { ORDER_STATUSES } from "@/domain/orders/types";
import { createClient } from "@/platform/supabase/server";

const orderRowSchema = z.object({
  id: z.union([z.string(), z.number()]),
  restaurant_id: z.union([z.string(), z.number()]),
  order_number: z.string(),
  status: z.enum(ORDER_STATUSES),
  estimated_ready_at: z.string(),
  estimate_updated_at: z.string(),
  pickup_instructions: z.string().nullable(),
  version: z.union([z.string(), z.number()]),
  created_at: z.string(),
  updated_at: z.string(),
});

const trackingSessionSchema = z.object({
  public_nonce: z.string().uuid(),
  token_version: z.number().int(),
  expires_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
});

const createOrderResponseSchema = z.object({
  order_id: z.union([z.string(), z.number()]),
  restaurant_id: z.union([z.string(), z.number()]),
  order_number: z.string(),
  status: z.enum(ORDER_STATUSES),
  estimated_ready_at: z.string(),
  estimate_updated_at: z.string(),
  pickup_instructions: z.string().nullable(),
  version: z.union([z.string(), z.number()]),
  created_at: z.string(),
  updated_at: z.string(),
  tracking_public_nonce: z.string().uuid(),
  tracking_token_version: z.number().int(),
});

const transitionResponseSchema = z.object({
  order_id: z.union([z.string(), z.number()]),
  status: z.enum(ORDER_STATUSES),
  version: z.union([z.string(), z.number()]),
  updated_at: z.string(),
  tracking_expires_at: z.string().nullable(),
  idempotent: z.boolean(),
});

const cancelResponseSchema = z.object({
  order_id: z.union([z.string(), z.number()]),
  status: z.enum(ORDER_STATUSES),
  version: z.union([z.string(), z.number()]),
  cancelled_at: z.string().nullable(),
  tracking_expires_at: z.string().nullable(),
  idempotent: z.boolean(),
});

const estimateResponseSchema = z.object({
  order_id: z.union([z.string(), z.number()]),
  estimated_ready_at: z.string(),
  estimate_updated_at: z.string(),
  version: z.union([z.string(), z.number()]),
  updated_at: z.string(),
});

const revokeTrackingResponseSchema = z.object({
  order_id: z.union([z.string(), z.number()]),
  revoked_at: z.string(),
});

export type RpcFailure = { code: string; message: string };

export class OrderRpcError extends Error {
  constructor(readonly rpcFailure: RpcFailure) {
    super(rpcFailure.message);
  }
}

function toOperatorOrder(input: z.infer<typeof orderRowSchema>): OperatorOrder {
  return {
    id: String(input.id),
    restaurantId: String(input.restaurant_id),
    orderNumber: input.order_number,
    status: input.status,
    estimatedReadyAt: input.estimated_ready_at,
    estimateUpdatedAt: input.estimate_updated_at,
    pickupInstructions: input.pickup_instructions,
    version: String(input.version),
    createdAt: input.created_at,
    updatedAt: input.updated_at,
  };
}

function throwRpcError(error: { code?: string; message?: string }): never {
  throw new OrderRpcError({
    code: error.code ?? "UNKNOWN",
    message: error.message ?? "UNKNOWN",
  });
}

export async function createOrderRecord(
  input: {
    restaurantId: string;
    orderNumber: string;
    estimatedReadyAt: string;
    pickupInstructions?: string;
  },
  suppliedClient?: SupabaseClient,
): Promise<OperatorOrderDetail> {
  const supabase = suppliedClient ?? (await createClient());
  const { data, error } = await supabase.rpc("create_order", {
    p_restaurant_id: input.restaurantId,
    p_order_number: input.orderNumber,
    p_estimated_ready_at: input.estimatedReadyAt,
    p_pickup_instructions: input.pickupInstructions ?? null,
  });

  if (error) throwRpcError(error);
  const row = createOrderResponseSchema.parse(data?.[0]);

  return {
    id: String(row.order_id),
    restaurantId: String(row.restaurant_id),
    orderNumber: row.order_number,
    status: row.status,
    estimatedReadyAt: row.estimated_ready_at,
    estimateUpdatedAt: row.estimate_updated_at,
    pickupInstructions: row.pickup_instructions,
    version: String(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    trackingSession: {
      publicNonce: row.tracking_public_nonce,
      tokenVersion: row.tracking_token_version,
      expiresAt: null,
      revokedAt: null,
    },
    trackingAvailable: true,
  };
}

export async function getOperatorOrderRecord(
  orderId: string,
  restaurantId: string,
  suppliedClient?: SupabaseClient,
): Promise<OperatorOrderDetail | null> {
  const supabase = suppliedClient ?? (await createClient());
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, restaurant_id, order_number, status, estimated_ready_at, estimate_updated_at, pickup_instructions, version, created_at, updated_at",
    )
    .eq("id", orderId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (orderError) {
    throw new Error("No fue posible obtener el pedido autorizado.");
  }
  if (!orderData) return null;

  const { data: trackingData, error: trackingError } = await supabase
    .from("tracking_sessions")
    .select("public_nonce, token_version, expires_at, revoked_at")
    .eq("order_id", orderId)
    .maybeSingle();

  if (trackingError) {
    throw new Error("No fue posible obtener el acceso de seguimiento vigente.");
  }
  if (!trackingData) return null;

  const order = toOperatorOrder(orderRowSchema.parse(orderData));
  const tracking = trackingSessionSchema.parse(trackingData);
  const trackingSession: TrackingSessionCredentials = {
    publicNonce: tracking.public_nonce,
    tokenVersion: tracking.token_version,
    expiresAt: tracking.expires_at,
    revokedAt: tracking.revoked_at,
  };

  return {
    ...order,
    trackingSession,
    trackingAvailable:
      trackingSession.revokedAt === null &&
      (trackingSession.expiresAt === null ||
        Date.parse(trackingSession.expiresAt) > Date.now()),
  };
}

export async function transitionOrderRecord(
  input: {
    orderId: string;
    expectedStatus: string;
    targetStatus: string;
  },
  suppliedClient?: SupabaseClient,
) {
  const supabase = suppliedClient ?? (await createClient());
  const { data, error } = await supabase.rpc("transition_order", {
    p_order_id: input.orderId,
    p_expected_status: input.expectedStatus,
    p_target_status: input.targetStatus,
  });

  if (error) throwRpcError(error);
  return transitionResponseSchema.parse(data?.[0]);
}

export async function cancelOrderRecord(
  input: {
    orderId: string;
    reasonCode: string;
    reasonText?: string;
  },
  suppliedClient?: SupabaseClient,
) {
  const supabase = suppliedClient ?? (await createClient());
  const { data, error } = await supabase.rpc("cancel_order", {
    p_order_id: input.orderId,
    p_reason_code: input.reasonCode,
    p_reason_text: input.reasonText ?? null,
  });

  if (error) throwRpcError(error);
  return cancelResponseSchema.parse(data?.[0]);
}

export async function updateOrderEstimateRecord(
  input: {
    orderId: string;
    estimatedReadyAt: string;
  },
  suppliedClient?: SupabaseClient,
) {
  const supabase = suppliedClient ?? (await createClient());
  const { data, error } = await supabase.rpc("update_order_estimate", {
    p_order_id: input.orderId,
    p_estimated_ready_at: input.estimatedReadyAt,
  });

  if (error) throwRpcError(error);
  return estimateResponseSchema.parse(data?.[0]);
}

export async function revokeTrackingSessionRecord(
  orderId: string,
  suppliedClient?: SupabaseClient,
) {
  const supabase = suppliedClient ?? (await createClient());
  const { data, error } = await supabase.rpc("revoke_tracking_session", {
    p_order_id: orderId,
  });

  if (error) throwRpcError(error);
  const row = revokeTrackingResponseSchema.parse(data?.[0]);
  return { orderId: String(row.order_id), revokedAt: row.revoked_at };
}
