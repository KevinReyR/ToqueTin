import type { OrderStatus } from "@/domain/orders/types";

export interface ReadyAlertCapabilities {
  audio: boolean;
  vibration: boolean;
  notifications: boolean;
  serviceWorker: boolean;
  push: boolean;
}

export type ReadyAlertChannel = "audio" | "vibration" | "push";

export type ReadyAlertConsentState =
  | "idle"
  | "requesting"
  | "enabled"
  | "partial"
  | "denied"
  | "unavailable"
  | "failed";

export interface ReadyAlertActivation {
  channels: ReadyAlertChannel[];
  state: ReadyAlertConsentState;
  message: string;
}

export interface ReadyAlertTarget {
  nonce: string;
  status: OrderStatus;
}
