import { z } from "zod";
import { NextResponse } from "next/server";

import { getPublicTrackingSnapshot } from "@/application/tracking/public-tracking";
import { createTrackingServerClient } from "@/platform/supabase/tracking-server";

export const dynamic = "force-dynamic";

const nonceSchema = z.string().uuid();
const noStoreHeaders = { "Cache-Control": "private, no-store" };

function unavailableResponse(status = 404) {
  return NextResponse.json(
    { error: { code: "TRACKING_INVALID" } },
    { headers: noStoreHeaders, status },
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ nonce: string }> },
) {
  const { nonce } = await context.params;
  if (!nonceSchema.safeParse(nonce).success) return unavailableResponse();

  try {
    const supabase = await createTrackingServerClient();
    const { data } = await supabase.auth.getClaims();
    const snapshot = await getPublicTrackingSnapshot({
      claims: data?.claims,
      nonce,
    });
    if (!snapshot) return unavailableResponse();

    return NextResponse.json(snapshot, { headers: noStoreHeaders });
  } catch {
    return unavailableResponse(503);
  }
}
