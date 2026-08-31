import { afterEach, describe, expect, it, vi } from "vitest";

import {
  detectReadyAlertCapabilities,
  subscribeReadyPush,
  vibrateReadyAlert,
} from "@/platform/browser/ready-alerts";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ready alert browser capabilities", () => {
  it("detects every capability independently", () => {
    const vibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {},
    });
    vi.stubGlobal("Notification", class NotificationMock {});
    vi.stubGlobal("PushManager", class PushManagerMock {});
    vi.stubGlobal("AudioContext", class AudioContextMock {});

    expect(detectReadyAlertCapabilities()).toEqual({
      audio: true,
      vibration: true,
      notifications: true,
      serviceWorker: true,
      push: true,
    });
  });

  it("keeps unsupported channels disabled without throwing", () => {
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: undefined,
    });
    vi.stubGlobal("Notification", undefined);
    vi.stubGlobal("PushManager", undefined);
    vi.stubGlobal("AudioContext", undefined);

    expect(detectReadyAlertCapabilities()).toEqual({
      audio: false,
      vibration: false,
      notifications: false,
      serviceWorker: false,
      push: false,
    });
    expect(vibrateReadyAlert()).toBe(false);
  });

  it("reuses an existing Push subscription and serializes only its public contract", async () => {
    const subscription = {
      expirationTime: null,
      toJSON: () => ({
        endpoint: "https://push.example.test/subscription",
        keys: {
          auth: "auth-key-value-1234",
          p256dh: "p256dh-key-value-12345678901234567890",
        },
      }),
    };
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(subscription),
        subscribe: vi.fn(),
      },
    } as unknown as ServiceWorkerRegistration;

    await expect(
      subscribeReadyPush(registration, "unused-existing-key"),
    ).resolves.toEqual({
      endpoint: "https://push.example.test/subscription",
      expirationTime: null,
      keys: {
        auth: "auth-key-value-1234",
        p256dh: "p256dh-key-value-12345678901234567890",
      },
    });
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
  });
});
