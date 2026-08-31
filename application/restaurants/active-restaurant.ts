import "server-only";

import type { OperatorRestaurant } from "@/domain/restaurants/types";
import { listAuthorizedRestaurants } from "@/data/restaurants/supabase-restaurant-repository";
import { scheduleOperationalCutoffRecord } from "@/data/restaurants/supabase-restaurant-repository";
import { cutoffTimeInputSchema } from "@/application/validation/dashboard-inputs";
import {
  readActiveRestaurantId,
  writeActiveRestaurantId,
} from "@/platform/active-restaurant-cookie";
import { failure, success, type Result } from "@/shared/result";

export interface ActiveRestaurantContext {
  restaurants: OperatorRestaurant[];
  activeRestaurant: OperatorRestaurant | null;
}

export async function scheduleOperationalCutoff(cutoffTime: string) {
  const { activeRestaurant } = await getActiveRestaurantContext();
  if (!activeRestaurant) return failure("FORBIDDEN");
  const validation = cutoffTimeInputSchema.safeParse({
    restaurantId: activeRestaurant.id,
    cutoffTime,
  });
  if (!validation.success) return failure("VALIDATION_ERROR");

  try {
    return success(await scheduleOperationalCutoffRecord(validation.data));
  } catch (error) {
    if (typeof error === "object" && error && "code" in error) {
      if (error.code === "42501") return failure("FORBIDDEN");
      if (error.code === "22023") return failure("VALIDATION_ERROR");
    }
    throw error;
  }
}

export async function getActiveRestaurantContext(): Promise<ActiveRestaurantContext> {
  const restaurants = await listAuthorizedRestaurants();
  const requestedId = await readActiveRestaurantId();
  const activeRestaurant =
    restaurants.find((restaurant) => restaurant.id === requestedId) ??
    restaurants[0] ??
    null;

  if (activeRestaurant && activeRestaurant.id !== requestedId) {
    await writeActiveRestaurantId(activeRestaurant.id);
  }

  return { restaurants, activeRestaurant };
}

export async function selectActiveRestaurant(
  restaurantId: string,
): Promise<Result<OperatorRestaurant, "FORBIDDEN" | "VALIDATION_ERROR">> {
  if (!/^[1-9]\d*$/.test(restaurantId)) {
    return failure("VALIDATION_ERROR");
  }

  const restaurants = await listAuthorizedRestaurants();
  const restaurant = restaurants.find((item) => item.id === restaurantId);

  if (!restaurant) {
    return failure("FORBIDDEN");
  }

  await writeActiveRestaurantId(restaurant.id);
  return success(restaurant);
}
