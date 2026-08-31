import type { OrderStatus } from "@/domain/orders/types";

export interface OperatorOrder {
  id: string;
  restaurantId: string;
  orderNumber: string;
  status: OrderStatus;
  estimatedReadyAt: string;
  estimateUpdatedAt: string;
  pickupInstructions: string | null;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrackingSessionCredentials {
  publicNonce: string;
  tokenVersion: number;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface OperatorOrderDetail extends OperatorOrder {
  trackingSession: TrackingSessionCredentials;
  trackingAvailable: boolean;
}
