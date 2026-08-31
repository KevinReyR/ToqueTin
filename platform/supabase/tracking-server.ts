import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/platform/env/public";
import { createServerCookieAdapter } from "@/platform/supabase/server-cookies";

const TRACKING_COOKIE_NAME = "toquetin-tracking-auth";

export async function createTrackingServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: { name: TRACKING_COOKIE_NAME },
      cookies: createServerCookieAdapter(cookieStore),
    },
  );
}
