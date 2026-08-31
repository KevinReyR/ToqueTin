import type { OrderStatus } from "@/domain/orders/types";
import type { OperatorOrder } from "@/domain/orders/operator-order";

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

export type DashboardData = DashboardSummary & {
  orders: OperatorOrder[];
};
