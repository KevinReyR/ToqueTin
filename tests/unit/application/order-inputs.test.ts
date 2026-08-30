import { describe, expect, it } from "vitest";

import {
  cancelOrderInputSchema,
  createOrderInputSchema,
  transitionOrderInputSchema,
  updateOrderEstimateInputSchema,
} from "@/application/validation/order-inputs";

const now = new Date("2026-08-29T17:00:00Z");

describe("order input schemas", () => {
  it("accepts a valid order creation and future estimate", () => {
    expect(
      createOrderInputSchema(now).parse({
        restaurantId: "17",
        orderNumber: "A-127",
        estimatedReadyAt: "2026-08-29T18:10:00Z",
        pickupInstructions: "Recoge en el mostrador 2.",
      }),
    ).toMatchObject({ restaurantId: "17", orderNumber: "A-127" });

    expect(
      updateOrderEstimateInputSchema(now).safeParse({
        orderId: "1842",
        estimatedReadyAt: "2026-08-29T18:30:00Z",
      }).success,
    ).toBe(true);
  });

  it("rejects missing fields, invalid IDs, unknown states, and invalid dates", () => {
    expect(createOrderInputSchema(now).safeParse({}).success).toBe(false);
    expect(
      createOrderInputSchema(now).safeParse({
        restaurantId: "0",
        orderNumber: "A-127",
        estimatedReadyAt: "not-a-date",
      }).success,
    ).toBe(false);
    expect(
      transitionOrderInputSchema.safeParse({
        orderId: "1842",
        expectedStatus: "UNKNOWN",
        targetStatus: "READY",
      }).success,
    ).toBe(false);
    expect(
      updateOrderEstimateInputSchema(now).safeParse({
        orderId: "1842",
        estimatedReadyAt: "2026-08-29T16:59:59Z",
      }).success,
    ).toBe(false);
  });

  it("requires text only for the OTHER cancellation reason", () => {
    expect(
      cancelOrderInputSchema.safeParse({
        orderId: "1842",
        reasonCode: "OTHER",
      }).success,
    ).toBe(false);
    expect(
      cancelOrderInputSchema.safeParse({
        orderId: "1842",
        reasonCode: "OTHER",
        reasonText: "No fue posible atender la solicitud.",
      }).success,
    ).toBe(true);
    expect(
      cancelOrderInputSchema.safeParse({
        orderId: "1842",
        reasonCode: "ORDER_ERROR",
        reasonText: "Texto adicional",
      }).success,
    ).toBe(false);
  });
});
