import { z } from "zod";
import { NextResponse } from "next/server";

import { exchangeTrackingToken } from "@/application/tracking/public-tracking";
import { createTrackingServerClient } from "@/platform/supabase/tracking-server";

export const dynamic = "force-dynamic";

const exchangeRequestSchema = z.object({ token: z.string().max(256) });
const noStoreHeaders = { "Cache-Control": "private, no-store" };

function unavailableResponse(status = 404) {
  return NextResponse.json(
    { error: { code: "TRACKING_INVALID" } },
    { headers: noStoreHeaders, status },
  );
}

export async function POST(request: Request) {
  let input: z.infer<typeof exchangeRequestSchema>;
  try {
    input = exchangeRequestSchema.parse(await request.json());
  } catch {
    return unavailableResponse();
  }

  try {
    const supabase = await createTrackingServerClient();
    const { data } = await supabase.auth.getClaims();
    const result = await exchangeTrackingToken({
      claims: data?.claims,
      token: input.token,
    });
    if (!result) return unavailableResponse();

    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch {
    return unavailableResponse(503);
  }
}
