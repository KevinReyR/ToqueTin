import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { OperatorRestaurant } from "@/domain/restaurants/types";
import { createClient } from "@/platform/supabase/server";

const restaurantRowSchema = z.object({
  id: z.union([z.string(), z.number()]),
  organization_id: z.union([z.string(), z.number()]),
  name: z.string(),
  timezone: z.string(),
  day_cutoff_time: z.string(),
  pending_day_cutoff_time: z.string().nullable(),
  pending_cutoff_effective_at: z.string().nullable(),
});

function toOperatorRestaurant(
  input: z.infer<typeof restaurantRowSchema>,
): OperatorRestaurant {
  return {
    id: String(input.id),
    organizationId: String(input.organization_id),
    name: input.name,
    timezone: input.timezone,
    dayCutoffTime: input.day_cutoff_time,
    pendingDayCutoffTime: input.pending_day_cutoff_time,
    pendingCutoffEffectiveAt: input.pending_cutoff_effective_at,
  };
}

export async function listAuthorizedRestaurants(): Promise<
  OperatorRestaurant[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select(
      "id, organization_id, name, timezone, day_cutoff_time, pending_day_cutoff_time, pending_cutoff_effective_at",
    )
    .order("name", { ascending: true });

  if (error) {
    throw new Error("No fue posible obtener los restaurantes autorizados.");
  }

  return z.array(restaurantRowSchema).parse(data).map(toOperatorRestaurant);
}

const cutoffResponseSchema = z.object({
  restaurant_id: z.union([z.string(), z.number()]),
  day_cutoff_time: z.string(),
  pending_day_cutoff_time: z.string().nullable(),
  pending_cutoff_effective_at: z.string().nullable(),
  updated_at: z.string(),
});

export async function scheduleOperationalCutoffRecord(
  input: { restaurantId: string; cutoffTime: string },
  suppliedClient?: SupabaseClient,
) {
  const supabase = suppliedClient ?? (await createClient());
  const { data, error } = await supabase.rpc("schedule_operational_cutoff", {
    p_restaurant_id: input.restaurantId,
    p_day_cutoff_time: input.cutoffTime,
  });
  if (error) throw error;
  const row = cutoffResponseSchema.parse(data?.[0]);
  return {
    restaurantId: String(row.restaurant_id),
    dayCutoffTime: row.day_cutoff_time,
    pendingDayCutoffTime: row.pending_day_cutoff_time,
    pendingCutoffEffectiveAt: row.pending_cutoff_effective_at,
    updatedAt: row.updated_at,
  };
}
