import "server-only";

import { createClient } from "@/platform/supabase/server";

export interface VerifiedOperatorClaims {
  subject: string;
  isAnonymous: boolean;
}

/** Returns signed claims, or null when the request has no valid Supabase session. */
export async function getVerifiedClaims() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return data?.claims ?? null;
}

export function getOperatorClaims(
  claims: unknown,
): VerifiedOperatorClaims | null {
  if (
    !claims ||
    typeof claims !== "object" ||
    !("sub" in claims) ||
    typeof claims.sub !== "string" ||
    ("is_anonymous" in claims && claims.is_anonymous === true)
  ) {
    return null;
  }

  return { subject: claims.sub, isAnonymous: false };
}
