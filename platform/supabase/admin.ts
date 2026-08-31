import "server-only";

import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/platform/env/public";
import { serverEnv } from "@/platform/env/server";

/** Server-only client for tightly scoped tracking RPCs after claim validation. */
export function createAdminClient() {
  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
