import { NextResponse } from "next/server";

import {
  enableReadyAlerts,
  pushSubscriptionSchema,
} from "@/application/notifications/ready-alerts";
import type { PushSubscriptionInput } from "@/data/notifications/supabase-notification-repository";
import { createTrackingServerClient } from "@/platform/supabase/tracking-server";

export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "private, no-store" };

function unavailableResponse(status = 404) {
  return NextResponse.json(
    { error: { code: "TRACKING_INVALID" } },
    { headers: noStoreHeaders, status },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ nonce: string }> },
) {
  const { nonce } = await context.params;
  let subscription: PushSubscriptionInput;
  try {
    subscription = pushSubscriptionSchema.parse(await request.json());
  } catch {
    return unavailableResponse(400);
  }

  try {
    const supabase = await createTrackingServerClient();
    const { data } = await supabase.auth.getClaims();
    const enabled = await enableReadyAlerts({
      claims: data?.claims,
      nonce,
      subscription,
    });
    if (!enabled) return unavailableResponse();

    return NextResponse.json(
      { channels: { push: true } },
      { headers: noStoreHeaders },
    );
  } catch {
    return unavailableResponse(503);
  }
}
