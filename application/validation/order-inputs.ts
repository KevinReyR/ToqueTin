import { z } from "zod";

import {
  CANCELLATION_REASON_CODES,
  ORDER_STATUSES,
} from "@/domain/orders/types";
import {
  internalIdSchema,
  isFutureDate,
  utcDateTimeSchema,
} from "@/application/validation/common";

const optionalTrimmedText = z.string().trim().max(1000).optional();

export function createOrderInputSchema(now = new Date()) {
  return z.object({
    restaurantId: internalIdSchema,
    orderNumber: z.string().trim().min(1).max(100),
    estimatedReadyAt: utcDateTimeSchema.refine(
      (value) => isFutureDate(value, now),
      "La estimación debe ser futura.",
    ),
    pickupInstructions: optionalTrimmedText,
  });
}

export const transitionOrderInputSchema = z.object({
  orderId: internalIdSchema,
  expectedStatus: z.enum(ORDER_STATUSES),
  targetStatus: z.enum(ORDER_STATUSES),
});

export const cancelOrderInputSchema = z
  .object({
    orderId: internalIdSchema,
    reasonCode: z.enum(CANCELLATION_REASON_CODES),
    reasonText: optionalTrimmedText,
  })
  .superRefine((input, context) => {
    if (input.reasonCode === "OTHER" && !input.reasonText) {
      context.addIssue({
        code: "custom",
        path: ["reasonText"],
        message: "Explica el motivo de cancelación.",
      });
    }

    if (input.reasonCode !== "OTHER" && input.reasonText) {
      context.addIssue({
        code: "custom",
        path: ["reasonText"],
        message: "Este motivo no requiere texto adicional.",
      });
    }
  });

export function updateOrderEstimateInputSchema(now = new Date()) {
  return z.object({
    orderId: internalIdSchema,
    estimatedReadyAt: utcDateTimeSchema.refine(
      (value) => isFutureDate(value, now),
      "La estimación debe ser futura.",
    ),
  });
}

export type CreateOrderInput = z.infer<
  ReturnType<typeof createOrderInputSchema>
>;
export type TransitionOrderInput = z.infer<typeof transitionOrderInputSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderInputSchema>;
export type UpdateOrderEstimateInput = z.infer<
  ReturnType<typeof updateOrderEstimateInputSchema>
>;
