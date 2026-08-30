import type { OrderStatus } from "@/domain/orders/types";

export type PublicTrackingSnapshot = {
  restaurantName: string;
  orderNumber: string;
  status: OrderStatus;
  estimatedReadyAt: string;
  estimateUpdatedAt: string;
  pickupInstructions: string | null;
  cancellationReason: string | null;
  trackingExpiresAt: string | null;
  updatedAt: string;
};
