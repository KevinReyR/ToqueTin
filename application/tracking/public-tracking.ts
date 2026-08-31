import "server-only";

import type { PublicTrackingSnapshot } from "@/domain/tracking/public-tracking-snapshot";
import { getAnonymousTrackingSubject } from "@/application/tracking/tracking-auth";
import { validateTrackingToken } from "@/application/tracking/tracking-token";
import {
  getPublicTrackingSnapshotRecord,
  grantTrackingViewer,
} from "@/data/tracking/supabase-tracking-repository";

export async function exchangeTrackingToken(input: {
  claims: unknown;
  token: string;
}): Promise<{ nonce: string } | null> {
  const subject = getAnonymousTrackingSubject(input.claims);
  const token = validateTrackingToken(input.token);
  if (!subject || !token) return null;

  const granted = await grantTrackingViewer({
    authUserId: subject,
    nonce: token.nonce,
  });
  return granted ? { nonce: token.nonce } : null;
}

export async function getPublicTrackingSnapshot(input: {
  claims: unknown;
  nonce: string;
}): Promise<PublicTrackingSnapshot | null> {
  const subject = getAnonymousTrackingSubject(input.claims);
  if (!subject) return null;
  return getPublicTrackingSnapshotRecord({
    authUserId: subject,
    nonce: input.nonce,
  });
}
