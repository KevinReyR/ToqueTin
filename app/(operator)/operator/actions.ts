"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { signOutOperator } from "@/application/auth/operator-auth";
import {
  cancelOperatorOrder,
  createOperatorOrder,
  revokeTrackingSession,
  transitionOperatorOrder,
  updateOperatorOrderEstimate,
} from "@/application/orders/operator-orders";
import {
  scheduleOperationalCutoff,
  selectActiveRestaurant,
} from "@/application/restaurants/active-restaurant";
import { clearActiveRestaurantId } from "@/platform/active-restaurant-cookie";
import type { ApplicationErrorCode } from "@/shared/errors";

export interface OperatorActionState {
  error?: ApplicationErrorCode;
  success?: boolean;
  idempotent?: boolean;
}

function requiredText(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveMinutes(formData: FormData): number | null {
  const value = requiredText(formData, "estimatedMinutes");
  if (!value || !/^\d+$/.test(value)) return null;
  const minutes = Number(value);
  return Number.isSafeInteger(minutes) && minutes > 0 ? minutes : null;
}

export async function signOutAction() {
  await signOutOperator();
  await clearActiveRestaurantId();
  redirect("/login");
}

export async function selectRestaurantAction(formData: FormData) {
  const restaurantId = requiredText(formData, "restaurantId");
  if (!restaurantId) return;
  await selectActiveRestaurant(restaurantId);
  revalidatePath("/operator", "layout");
}

export async function createOrderAction(
  _previousState: OperatorActionState,
  formData: FormData,
): Promise<OperatorActionState> {
  const orderNumber = requiredText(formData, "orderNumber");
  const estimatedMinutes = positiveMinutes(formData);
  const pickupInstructions = formData.get("pickupInstructions");
  if (
    !orderNumber ||
    !estimatedMinutes ||
    typeof pickupInstructions !== "string"
  ) {
    return { error: "VALIDATION_ERROR" };
  }

  const result = await createOperatorOrder({
    orderNumber,
    estimatedMinutes,
    pickupInstructions,
  });
  if (!result.ok) return { error: result.error.code };

  redirect(`/operator/orders/${result.data.id}`);
}

export async function transitionOrderAction(
  _previousState: OperatorActionState,
  formData: FormData,
): Promise<OperatorActionState> {
  const orderId = requiredText(formData, "orderId");
  const expectedStatus = requiredText(formData, "expectedStatus");
  const targetStatus = requiredText(formData, "targetStatus");
  if (!orderId || !expectedStatus || !targetStatus)
    return { error: "VALIDATION_ERROR" };

  const result = await transitionOperatorOrder({
    orderId,
    expectedStatus,
    targetStatus,
  });
  if (!result.ok) return { error: result.error.code };
  revalidatePath(`/operator/orders/${orderId}`);
  return { success: true, idempotent: result.data.idempotent };
}

export async function cancelOrderAction(
  _previousState: OperatorActionState,
  formData: FormData,
): Promise<OperatorActionState> {
  const orderId = requiredText(formData, "orderId");
  const reasonCode = requiredText(formData, "reasonCode");
  const reasonText = requiredText(formData, "reasonText") ?? undefined;
  if (!orderId || !reasonCode) return { error: "CANCELLATION_REASON_REQUIRED" };

  const result = await cancelOperatorOrder({ orderId, reasonCode, reasonText });
  if (!result.ok) return { error: result.error.code };
  revalidatePath(`/operator/orders/${orderId}`);
  return { success: true, idempotent: result.data.idempotent };
}

export async function updateEstimateAction(
  _previousState: OperatorActionState,
  formData: FormData,
): Promise<OperatorActionState> {
  const orderId = requiredText(formData, "orderId");
  const estimatedMinutes = positiveMinutes(formData);
  if (!orderId || !estimatedMinutes) return { error: "VALIDATION_ERROR" };

  const result = await updateOperatorOrderEstimate({
    orderId,
    estimatedMinutes,
  });
  if (!result.ok) return { error: result.error.code };
  revalidatePath(`/operator/orders/${orderId}`);
  return { success: true };
}

export async function revokeTrackingAction(
  _previousState: OperatorActionState,
  formData: FormData,
): Promise<OperatorActionState> {
  const orderId = requiredText(formData, "orderId");
  if (!orderId) return { error: "VALIDATION_ERROR" };

  const result = await revokeTrackingSession(orderId);
  if (!result.ok) return { error: result.error.code };
  revalidatePath(`/operator/orders/${orderId}`);
  return { success: true };
}

export async function scheduleCutoffAction(
  _previousState: OperatorActionState,
  formData: FormData,
): Promise<OperatorActionState> {
  const cutoffTime = requiredText(formData, "cutoffTime");
  if (!cutoffTime) return { error: "VALIDATION_ERROR" };
  const result = await scheduleOperationalCutoff(cutoffTime);
  if (!result.ok) return { error: result.error.code };
  revalidatePath("/operator");
  return { success: true };
}
