"use client";

import type { ReadyAlertCapabilities } from "@/domain/notifications/ready-alerts";

interface WebkitAudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export interface ArmedAudioAlert {
  close: () => Promise<void>;
  play: () => Promise<boolean>;
}

export interface SerializablePushSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
}

export function detectReadyAlertCapabilities(): ReadyAlertCapabilities {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      audio: false,
      vibration: false,
      notifications: false,
      serviceWorker: false,
      push: false,
    };
  }

  const audioWindow = window as WebkitAudioWindow;
  return {
    audio: Boolean(window.AudioContext || audioWindow.webkitAudioContext),
    vibration: typeof navigator.vibrate === "function",
    notifications: typeof window.Notification !== "undefined",
    serviceWorker: typeof navigator.serviceWorker !== "undefined",
    push: typeof window.PushManager !== "undefined",
  };
}

export async function armReadyAudioAlert(): Promise<ArmedAudioAlert | null> {
  const audioWindow = window as WebkitAudioWindow;
  const AudioContextConstructor =
    window.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextConstructor) return null;

  try {
    const context = new AudioContextConstructor();
    await context.resume();
    return {
      close: async () => {
        if (context.state !== "closed") await context.close();
      },
      play: async () => {
        try {
          if (context.state === "suspended") await context.resume();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          const now = context.currentTime;
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(880, now);
          oscillator.frequency.setValueAtTime(660, now + 0.22);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.22, now + 0.025);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(now);
          oscillator.stop(now + 0.52);
          return true;
        } catch {
          return false;
        }
      },
    };
  } catch {
    return null;
  }
}

export function vibrateReadyAlert(): boolean {
  try {
    return typeof navigator.vibrate === "function"
      ? navigator.vibrate([220, 120, 220])
      : false;
  } catch {
    return false;
  }
}

export async function registerReadyAlertsWorker() {
  if (typeof navigator.serviceWorker === "undefined") return null;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;
    return registration;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function subscribeReadyPush(
  registration: ServiceWorkerRegistration,
  applicationServerKey: string,
): Promise<SerializablePushSubscription | null> {
  try {
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
        userVisibleOnly: true,
      }));
    const serialized = subscription.toJSON();
    if (
      !serialized.endpoint ||
      !serialized.keys?.auth ||
      !serialized.keys.p256dh
    ) {
      return null;
    }
    return {
      endpoint: serialized.endpoint,
      expirationTime: subscription.expirationTime,
      keys: {
        auth: serialized.keys.auth,
        p256dh: serialized.keys.p256dh,
      },
    };
  } catch {
    return null;
  }
}
