export const TRACKING_RECONNECT_DELAYS_MS = [
  1_000, 2_000, 5_000, 10_000,
] as const;

export type TrackingConnectionState =
  "connecting" | "connected" | "stale" | "reconnecting";

export function getTrackingReconnectDelayMs(tries: number): number {
  const index = Math.max(
    0,
    Math.min(tries - 1, TRACKING_RECONNECT_DELAYS_MS.length - 1),
  );
  return TRACKING_RECONNECT_DELAYS_MS[index] ?? 10_000;
}
