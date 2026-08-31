import "server-only";

import { cookies } from "next/headers";

const ACTIVE_RESTAURANT_COOKIE = "toquetin-active-restaurant";
const COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export async function readActiveRestaurantId(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(ACTIVE_RESTAURANT_COOKIE)?.value;

  return value && /^[1-9]\d*$/.test(value) ? value : null;
}

export async function writeActiveRestaurantId(
  restaurantId: string,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_RESTAURANT_COOKIE, restaurantId, COOKIE_OPTIONS);
}

export async function clearActiveRestaurantId(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_RESTAURANT_COOKIE);
}
