import type { OrderStatus } from "@/domain/orders/types";

export type OperationalInterval = {
  startedAt: string;
  endedAt: string;
};

export type DashboardSummary = {
  restaurantId: string;
  operationalDay: OperationalInterval;
  orderCountByStatus: Record<OrderStatus, number>;
  totalCreated: number;
  totalActive: number;
  averagePreparationSeconds: number | null;
  averagePickupSeconds: number | null;
};
