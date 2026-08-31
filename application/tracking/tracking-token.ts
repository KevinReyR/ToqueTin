import "server-only";

import { createHmac } from "node:crypto";
import { timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/platform/env/server";

export interface TrackingTokenInput {
  nonce: string;
  version: number;
}

export type ValidTrackingToken = TrackingTokenInput;

const TRACKING_TOKEN_VERSION = 1;
const TRACKING_TOKEN_PATTERN =
  /^v([1-9][0-9]*)\.([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

export function createTrackingToken(
  input: TrackingTokenInput,
  secret = serverEnv.TRACKING_TOKEN_HMAC_SECRET,
): string {
  const prefix = `v${input.version}.${input.nonce}`;
  const signature = createHmac("sha256", secret)
    .update(`toquetin:tracking:${prefix}`)
    .digest("base64url");

  return `${prefix}.${signature}`;
}

export function validateTrackingToken(
  token: string,
  secret = serverEnv.TRACKING_TOKEN_HMAC_SECRET,
): ValidTrackingToken | null {
  const match = TRACKING_TOKEN_PATTERN.exec(token);
  if (!match) return null;

  const version = Number(match[1]);
  const nonce = match[2];
  const suppliedSignature = match[3];
  if (
    !Number.isSafeInteger(version) ||
    version !== TRACKING_TOKEN_VERSION ||
    !nonce ||
    !suppliedSignature
  ) {
    return null;
  }

  const expectedToken = createTrackingToken({ nonce, version }, secret);
  const expectedSignature = expectedToken.slice(
    expectedToken.lastIndexOf(".") + 1,
  );
  const expectedBytes = Buffer.from(expectedSignature, "base64url");
  const suppliedBytes = Buffer.from(suppliedSignature, "base64url");
  if (expectedBytes.length !== suppliedBytes.length) return null;

  return timingSafeEqual(expectedBytes, suppliedBytes)
    ? { nonce, version }
    : null;
}
