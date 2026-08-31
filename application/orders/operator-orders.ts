import "server-only";

import {
  cancelOrderInputSchema,
  createOrderInputSchema,
  transitionOrderInputSchema,
  updateOrderEstimateInputSchema,
} from "@/application/validation/order-inputs";
import { getActiveRestaurantContext } from "@/application/restaurants/active-restaurant";
import {
  cancelOrderRecord,
  createOrderRecord,
  getOperatorOrderRecord,
  OrderRpcError,
  revokeTrackingSessionRecord,
  transitionOrderRecord,
  updateOrderEstimateRecord,
} from "@/data/orders/supabase-order-repository";
import { internalIdSchema } from "@/application/validation/common";
import type { OperatorOrderDetail } from "@/domain/orders/operator-order";
import { failure, success, type Result } from "@/shared/result";

type OperationalError =
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "DUPLICATE_ORDER_NUMBER"
  | "INVALID_TRANSITION"
  | "CONFLICT"
  | "CANCELLATION_REASON_REQUIRED"
  | "ESTIMATE_LOCKED";

function mapOrderRpcError(error: unknown): Result<never, OperationalError> {
  if (!(error instanceof OrderRpcError)) throw error;

  if (error.rpcFailure.code === "23505")
    return failure("DUPLICATE_ORDER_NUMBER");
  if (error.rpcFailure.code === "42501") return failure("FORBIDDEN");
  if (error.rpcFailure.code === "22023") return failure("VALIDATION_ERROR");

  const code = error.rpcFailure.message;
  if (
    code === "INVALID_TRANSITION" ||
    code === "CONFLICT" ||
    code === "CANCELLATION_REASON_REQUIRED" ||
    code === "ESTIMATE_LOCKED"
  ) {
    return failure(code);
  }

  throw error;
}

export async function createOperatorOrder(input: {
  orderNumber: string;
  estimatedMinutes: number;
  pickupInstructions?: string;
}): Promise<Result<OperatorOrderDetail, OperationalError>> {
  const { activeRestaurant } = await getActiveRestaurantContext();
  if (!activeRestaurant) return failure("FORBIDDEN");

  const estimatedReadyAt = new Date(
    Date.now() + input.estimatedMinutes * 60_000,
  ).toISOString();
  const validation = createOrderInputSchema().safeParse({
    restaurantId: activeRestaurant.id,
    orderNumber: input.orderNumber,
    estimatedReadyAt,
    pickupInstructions: input.pickupInstructions,
  });
  if (!validation.success) return failure("VALIDATION_ERROR");

  try {
    return success(await createOrderRecord(validation.data));
  } catch (error) {
    return mapOrderRpcError(error);
  }
}

export async function getActiveOperatorOrder(
  orderId: string,
): Promise<OperatorOrderDetail | null> {
  const { activeRestaurant } = await getActiveRestaurantContext();
  if (!activeRestaurant || !/^[1-9]\d*$/.test(orderId)) return null;

  return getOperatorOrderRecord(orderId, activeRestaurant.id);
}

export async function transitionOperatorOrder(input: {
  orderId: string;
  expectedStatus: string;
  targetStatus: string;
}) {
  const validation = transitionOrderInputSchema.safeParse(input);
  if (!validation.success) return failure("VALIDATION_ERROR");

  try {
    return success(await transitionOrderRecord(validation.data));
  } catch (error) {
    return mapOrderRpcError(error);
  }
}

export async function cancelOperatorOrder(input: {
  orderId: string;
  reasonCode: string;
  reasonText?: string;
}) {
  const validation = cancelOrderInputSchema.safeParse(input);
  if (!validation.success) return failure("CANCELLATION_REASON_REQUIRED");

  try {
    return success(await cancelOrderRecord(validation.data));
  } catch (error) {
    return mapOrderRpcError(error);
  }
}

export async function updateOperatorOrderEstimate(input: {
  orderId: string;
  estimatedMinutes: number;
}) {
  const estimatedReadyAt = new Date(
    Date.now() + input.estimatedMinutes * 60_000,
  ).toISOString();
  const validation = updateOrderEstimateInputSchema().safeParse({
    orderId: input.orderId,
    estimatedReadyAt,
  });
  if (!validation.success) return failure("VALIDATION_ERROR");

  try {
    return success(await updateOrderEstimateRecord(validation.data));
  } catch (error) {
    return mapOrderRpcError(error);
  }
}

export async function revokeTrackingSession(orderId: string) {
  const validation = internalIdSchema.safeParse(orderId);
  if (!validation.success) return failure("VALIDATION_ERROR");

  try {
    return success(await revokeTrackingSessionRecord(validation.data));
  } catch (error) {
    return mapOrderRpcError(error);
  }
}
