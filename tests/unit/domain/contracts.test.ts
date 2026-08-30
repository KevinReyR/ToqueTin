import { describe, expect, it } from "vitest";

import type { DashboardSummary } from "@/domain/dashboard/dashboard-summary";
import {
  CANCELLATION_REASON_CODES,
  NOTIFICATION_KINDS,
  NOTIFICATION_STATUSES,
  ORDER_STATUSES,
  RESTAURANT_USER_ROLES,
} from "@/domain/orders/types";
import type { PublicTrackingSnapshot } from "@/domain/tracking/public-tracking-snapshot";

describe("domain contracts", () => {
  it("keeps the closed domain values exhaustive", () => {
    expect(ORDER_STATUSES).toEqual([
      "RECEIVED",
      "PREPARING",
      "READY",
      "DELIVERED",
      "CANCELLED",
    ]);
    expect(CANCELLATION_REASON_CODES).toEqual([
      "CUSTOMER_REQUEST",
      "PRODUCT_UNAVAILABLE",
      "ORDER_ERROR",
      "OPERATIONAL_ISSUE",
      "OTHER",
    ]);
    expect(NOTIFICATION_STATUSES).toEqual([
      "PENDING",
      "SENT",
      "FAILED",
      "EXPIRED",
    ]);
    expect(NOTIFICATION_KINDS).toEqual(["ORDER_READY"]);
    expect(RESTAURANT_USER_ROLES).toEqual(["OPERATOR"]);
  });

  it("keeps public tracking free of internal identifiers", () => {
    const snapshot: PublicTrackingSnapshot = {
      restaurantName: "ToqueTin Centro",
      orderNumber: "A-127",
      status: "PREPARING",
      estimatedReadyAt: "2026-08-29T18:10:00Z",
      estimateUpdatedAt: "2026-08-29T17:50:00Z",
      pickupInstructions: "Recoge en el mostrador 2.",
      cancellationReason: null,
      trackingExpiresAt: null,
      updatedAt: "2026-08-29T17:52:00Z",
    };

    expect(Object.keys(snapshot)).toEqual([
      "restaurantName",
      "orderNumber",
      "status",
      "estimatedReadyAt",
      "estimateUpdatedAt",
      "pickupInstructions",
      "cancellationReason",
      "trackingExpiresAt",
      "updatedAt",
    ]);
  });

  it("binds a dashboard summary to one restaurant and nullable averages", () => {
    const summary: DashboardSummary = {
      restaurantId: "17",
      operationalDay: {
        startedAt: "2026-08-29T05:00:00Z",
        endedAt: "2026-08-30T05:00:00Z",
      },
      orderCountByStatus: {
        RECEIVED: 1,
        PREPARING: 2,
        READY: 3,
        DELIVERED: 4,
        CANCELLED: 5,
      },
      totalCreated: 15,
      totalActive: 6,
      averagePreparationSeconds: null,
      averagePickupSeconds: null,
    };

    expect(summary.restaurantId).toBe("17");
    expect(summary.averagePreparationSeconds).toBeNull();
    expect(summary.averagePickupSeconds).toBeNull();
  });
});
