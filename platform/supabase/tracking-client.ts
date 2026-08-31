"use client";

import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/platform/env/public";
import { getTrackingReconnectDelayMs } from "@/shared/tracking-connection";

const TRACKING_COOKIE_NAME = "toquetin-tracking-auth";

export function createTrackingClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: { name: TRACKING_COOKIE_NAME },
      isSingleton: true,
      realtime: { reconnectAfterMs: getTrackingReconnectDelayMs },
    },
  );
}
