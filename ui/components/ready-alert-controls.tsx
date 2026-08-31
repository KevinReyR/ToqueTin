"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ReadyAlertActivation,
  ReadyAlertCapabilities,
  ReadyAlertChannel,
} from "@/domain/notifications/ready-alerts";
import type { OrderStatus } from "@/domain/orders/types";
import {
  armReadyAudioAlert,
  detectReadyAlertCapabilities,
  registerReadyAlertsWorker,
  subscribeReadyPush,
  vibrateReadyAlert,
  type ArmedAudioAlert,
} from "@/application/notifications/browser-ready-alerts";
import { Button } from "@/ui/components/button";

const INITIAL_ACTIVATION: ReadyAlertActivation = {
  channels: [],
  message: "",
  state: "idle",
};

function activationMessage(
  channels: ReadyAlertChannel[],
  pushIssue: "denied" | "failed" | "unavailable" | null,
): ReadyAlertActivation {
  if (channels.length === 0) {
    if (pushIssue === "denied") {
      return {
        channels,
        message:
          "No autorizaste las notificaciones. El aviso visual seguirá funcionando.",
        state: "denied",
      };
    }
    return {
      channels,
      message:
        "Este dispositivo no ofrece avisos adicionales. El seguimiento visual sigue activo.",
      state: pushIssue === "failed" ? "failed" : "unavailable",
    };
  }

  const labels = channels.map((channel) => {
    if (channel === "audio") return "sonido";
    if (channel === "vibration") return "vibración";
    return "notificación";
  });
  const enabled = `Avisos activados: ${labels.join(", ")}.`;
  return {
    channels,
    message: pushIssue
      ? `${enabled} La notificación fuera de esta pantalla no quedó disponible.`
      : enabled,
    state: pushIssue ? "partial" : "enabled",
  };
}

export function ReadyAlertControls({
  nonce,
  status,
}: {
  nonce: string;
  status: OrderStatus;
}) {
  const [capabilities, setCapabilities] = useState<ReadyAlertCapabilities>();
  const [activation, setActivation] =
    useState<ReadyAlertActivation>(INITIAL_ACTIVATION);
  const audioAlert = useRef<ArmedAudioAlert | null>(null);
  const previousStatus = useRef(status);

  useEffect(() => {
    queueMicrotask(() => setCapabilities(detectReadyAlertCapabilities()));
    void registerReadyAlertsWorker();
    return () => {
      void audioAlert.current?.close();
    };
  }, []);

  useEffect(() => {
    const becameReady =
      previousStatus.current !== "READY" && status === "READY";
    previousStatus.current = status;
    if (!becameReady || activation.channels.length === 0) return;

    async function notifyReady() {
      let localFailure = false;
      if (activation.channels.includes("audio")) {
        localFailure = !(await audioAlert.current?.play());
      }
      if (activation.channels.includes("vibration")) {
        localFailure = !vibrateReadyAlert() || localFailure;
      }
      if (localFailure) {
        setActivation((current) => ({
          ...current,
          message:
            "El pedido está listo. Un aviso adicional no pudo ejecutarse, pero la pantalla sigue actualizada.",
          state: "partial",
        }));
      }
    }
    void notifyReady();
  }, [activation.channels, status]);

  const activate = useCallback(async () => {
    if (!capabilities || activation.state === "requesting") return;
    setActivation({
      channels: [],
      message: "Activando avisos…",
      state: "requesting",
    });
    const channels: ReadyAlertChannel[] = [];

    if (capabilities.audio) {
      audioAlert.current = await armReadyAudioAlert();
      if (audioAlert.current) channels.push("audio");
    }
    if (capabilities.vibration) channels.push("vibration");

    let pushIssue: "denied" | "failed" | "unavailable" | null = null;
    if (
      capabilities.notifications &&
      capabilities.serviceWorker &&
      capabilities.push
    ) {
      try {
        const permission =
          Notification.permission === "default"
            ? await Notification.requestPermission()
            : Notification.permission;
        if (permission === "granted") {
          const registration = await registerReadyAlertsWorker();
          const subscription = registration
            ? await subscribeReadyPush(registration)
            : null;
          if (subscription) {
            const response = await fetch(`/api/tracking/${nonce}/alerts`, {
              body: JSON.stringify(subscription),
              cache: "no-store",
              headers: { "Content-Type": "application/json" },
              method: "POST",
            });
            if (response.ok) channels.push("push");
            else pushIssue = "failed";
          } else {
            pushIssue = "failed";
          }
        } else {
          pushIssue = "denied";
        }
      } catch {
        pushIssue = "failed";
      }
    } else {
      pushIssue = "unavailable";
    }

    setActivation(activationMessage(channels, pushIssue));
  }, [activation.state, capabilities, nonce]);

  if (status === "READY") {
    return activation.message ? (
      <p
        aria-live="polite"
        className="mt-5 text-sm leading-6 text-stone-700"
        role="status"
      >
        {activation.message}
      </p>
    ) : null;
  }
  if (status === "CANCELLED" || status === "DELIVERED") return null;

  return (
    <div className="mt-7 rounded-xl border border-stone-200 bg-stone-50 p-4">
      <h3 className="font-semibold text-stone-950">Avisos opcionales</h3>
      <p className="mt-1 text-sm leading-6 text-stone-600">
        Activa los canales disponibles para enterarte cuando esté listo. El
        seguimiento funciona aunque no los actives.
      </p>
      <Button
        className="mt-3"
        disabled={!capabilities || activation.state === "requesting"}
        onClick={() => void activate()}
        type="button"
        variant="secondary"
      >
        {activation.state === "requesting"
          ? "Activando…"
          : "Avísame cuando esté listo"}
      </Button>
      {activation.message ? (
        <p
          aria-live="polite"
          className="mt-3 text-sm leading-6 text-stone-700"
          role="status"
        >
          {activation.message}
        </p>
      ) : null}
    </div>
  );
}
