import "server-only";

import { operationalJourneyInputSchema } from "@/application/validation/dashboard-inputs";
import { getActiveRestaurantContext } from "@/application/restaurants/active-restaurant";
import {
  DashboardRpcError,
  getDashboardSummaryRecord,
} from "@/data/dashboard/supabase-dashboard-repository";
import type { DashboardData } from "@/domain/dashboard/dashboard-summary";
import { failure, success, type Result } from "@/shared/result";

export async function getDashboardSummary(input?: {
  startedAt: string;
  endedAt: string;
}): Promise<Result<DashboardData, "FORBIDDEN" | "VALIDATION_ERROR">> {
  const { activeRestaurant } = await getActiveRestaurantContext();
  if (!activeRestaurant) return failure("FORBIDDEN");

  if (input) {
    const validation = operationalJourneyInputSchema.safeParse({
      restaurantId: activeRestaurant.id,
      ...input,
    });
    if (!validation.success) return failure("VALIDATION_ERROR");
  }

  try {
    return success(
      await getDashboardSummaryRecord({
        restaurantId: activeRestaurant.id,
        ...input,
      }),
    );
  } catch (error) {
    if (error instanceof DashboardRpcError) {
      if (error.code === "42501") return failure("FORBIDDEN");
      if (error.code === "22023") return failure("VALIDATION_ERROR");
    }
    throw error;
  }
}
