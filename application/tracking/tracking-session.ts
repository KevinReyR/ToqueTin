"use client";

import { createTrackingClient } from "@/platform/supabase/tracking-client";

function hasAnonymousClaims(claims: unknown): boolean {
  return Boolean(
    claims &&
    typeof claims === "object" &&
    "sub" in claims &&
    typeof claims.sub === "string" &&
    "is_anonymous" in claims &&
    claims.is_anonymous === true,
  );
}

export async function ensureAnonymousTrackingSession() {
  const supabase = createTrackingClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  if (!claimsError && hasAnonymousClaims(claimsData?.claims)) return supabase;

  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error("No fue posible iniciar el seguimiento.");

  const { data: refreshedClaims, error: refreshedError } =
    await supabase.auth.getClaims();
  if (refreshedError || !hasAnonymousClaims(refreshedClaims?.claims)) {
    throw new Error("No fue posible iniciar el seguimiento.");
  }

  return supabase;
}
