import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { DashboardData } from "@/domain/dashboard/dashboard-summary";
import { ORDER_STATUSES } from "@/domain/orders/types";
import { createClient } from "@/platform/supabase/server";

const dashboardOrderSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  orderNumber: z.string(),
  status: z.enum(ORDER_STATUSES),
  estimatedReadyAt: z.string(),
  estimateUpdatedAt: z.string(),
  pickupInstructions: z.string().nullable(),
  version: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const dashboardRowSchema = z.object({
  restaurant_id: z.union([z.string(), z.number()]),
  operational_day_started_at: z.string(),
  operational_day_ended_at: z.string(),
  orders: z.array(dashboardOrderSchema),
  order_count_by_status: z.object({
    RECEIVED: z.number(),
    PREPARING: z.number(),
    READY: z.number(),
    DELIVERED: z.number(),
    CANCELLED: z.number(),
  }),
  total_created: z.union([z.string(), z.number()]),
  total_active: z.union([z.string(), z.number()]),
  average_preparation_seconds: z.number().nullable(),
  average_pickup_seconds: z.number().nullable(),
});

export class DashboardRpcError extends Error {
  constructor(
    readonly code: string,
    readonly rpcMessage: string,
  ) {
    super(rpcMessage);
  }
}

export async function getDashboardSummaryRecord(
  input: { restaurantId: string; startedAt?: string; endedAt?: string },
  suppliedClient?: SupabaseClient,
): Promise<DashboardData> {
  const supabase = suppliedClient ?? (await createClient());
  const { data, error } = await supabase.rpc("get_dashboard_summary", {
    p_restaurant_id: input.restaurantId,
    p_started_at: input.startedAt ?? null,
    p_ended_at: input.endedAt ?? null,
  });
  if (error) throw new DashboardRpcError(error.code, error.message);
  const row = dashboardRowSchema.parse(data?.[0]);

  return {
    restaurantId: String(row.restaurant_id),
    operationalDay: {
      startedAt: row.operational_day_started_at,
      endedAt: row.operational_day_ended_at,
    },
    orderCountByStatus: row.order_count_by_status,
    totalCreated: Number(row.total_created),
    totalActive: Number(row.total_active),
    averagePreparationSeconds: row.average_preparation_seconds,
    averagePickupSeconds: row.average_pickup_seconds,
    orders: row.orders,
  };
}
