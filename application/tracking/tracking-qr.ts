import "server-only";

import QRCode from "qrcode";

import { serverEnv } from "@/platform/env/server";

import {
  createTrackingToken,
  type TrackingTokenInput,
} from "@/application/tracking/tracking-token";

export function createTrackingUrl(input: TrackingTokenInput): string {
  const baseUrl = new URL(serverEnv.APP_BASE_URL);
  baseUrl.pathname = "/track";
  baseUrl.search = "";
  baseUrl.hash = createTrackingToken(input);

  return baseUrl.toString();
}

export async function createTrackingQrDataUrl(
  input: TrackingTokenInput,
): Promise<string> {
  return QRCode.toDataURL(createTrackingUrl(input), {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 384,
  });
}
