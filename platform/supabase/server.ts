import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/platform/env/public";
import { createServerCookieAdapter } from "@/platform/supabase/server-cookies";

/**
 * Creates a request-scoped Supabase client for Server Components, Actions and
 * Route Handlers. Session refreshes are persisted by the root Proxy.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: createServerCookieAdapter(cookieStore),
    },
  );
}
