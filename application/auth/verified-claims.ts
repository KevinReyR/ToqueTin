import "server-only";

import { createClient } from "@/platform/supabase/server";

/** Returns signed claims, or null when the request has no valid Supabase session. */
export async function getVerifiedClaims() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return data?.claims ?? null;
}
