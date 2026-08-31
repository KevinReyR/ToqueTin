import "server-only";

import { z } from "zod";

import { getAnonymousTrackingSubject } from "@/application/tracking/tracking-auth";
import {
  enableReadyAlertsRecord,
  type PushSubscriptionInput,
} from "@/data/notifications/supabase-notification-repository";

export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(2048),
  expirationTime: z.number().int().positive().nullable(),
  keys: z.object({
    auth: z.string().min(16).max(512),
    p256dh: z.string().min(32).max(512),
  }),
});

export async function enableReadyAlerts(input: {
  claims: unknown;
  nonce: string;
  subscription: PushSubscriptionInput;
}): Promise<boolean> {
  const authUserId = getAnonymousTrackingSubject(input.claims);
  const nonce = z.string().uuid().safeParse(input.nonce);
  const subscription = pushSubscriptionSchema.safeParse(input.subscription);
  if (!authUserId || !nonce.success || !subscription.success) return false;

  return enableReadyAlertsRecord({
    authUserId,
    nonce: nonce.data,
    subscription: subscription.data,
  });
}
