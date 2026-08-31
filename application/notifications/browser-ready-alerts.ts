"use client";

import { publicEnv } from "@/platform/env/public";
import {
  armReadyAudioAlert,
  detectReadyAlertCapabilities,
  registerReadyAlertsWorker,
  subscribeReadyPush as subscribeBrowserReadyPush,
  vibrateReadyAlert,
  type ArmedAudioAlert,
} from "@/platform/browser/ready-alerts";

export {
  armReadyAudioAlert,
  detectReadyAlertCapabilities,
  registerReadyAlertsWorker,
  vibrateReadyAlert,
  type ArmedAudioAlert,
};

export function subscribeReadyPush(registration: ServiceWorkerRegistration) {
  return subscribeBrowserReadyPush(
    registration,
    publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  );
}
