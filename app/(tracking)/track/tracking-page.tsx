"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { ensureAnonymousTrackingSession } from "@/application/tracking/tracking-session";
import type { PublicTrackingSnapshot } from "@/domain/tracking/public-tracking-snapshot";
import { ORDER_STATUSES } from "@/domain/orders/types";
import { createTrackingClient } from "@/platform/supabase/tracking-client";
import {
  getTrackingReconnectDelayMs,
  type TrackingConnectionState,
} from "@/shared/tracking-connection";
import { Button, ReadyAlertControls } from "@/ui";

const snapshotSchema = z.object({
  restaurantName: z.string(),
  orderNumber: z.string(),
  status: z.enum(ORDER_STATUSES),
  estimatedReadyAt: z.string(),
  estimateUpdatedAt: z.string(),
  pickupInstructions: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  trackingExpiresAt: z.string().nullable(),
  updatedAt: z.string(),
});

const exchangeSchema = z.object({ nonce: z.string().uuid() });
const trackingEventSchema = z.object({
  cancellationReason: z.string().nullable(),
  estimateUpdatedAt: z.string(),
  estimatedReadyAt: z.string(),
  pickupInstructions: z.string().nullable(),
  status: z.enum(ORDER_STATUSES),
  type: z.enum([
    "ORDER_CREATED",
    "STATUS_CHANGED",
    "ESTIMATE_UPDATED",
    "ORDER_UPDATED",
  ]),
  updatedAt: z.string(),
  version: z.string(),
});
const trackingRevokedEventSchema = z
  .object({
    id: z.string().uuid().optional(),
    type: z.literal("TRACKING_REVOKED"),
  })
  .strict();

type ViewState = "loading" | "invalid" | "error" | "ready";
type SnapshotLoadResult = "success" | "invalid" | "error";

const STATUS_COPY = {
  RECEIVED: {
    label: "Pedido recibido",
    nextStep: "El restaurante empezará a prepararlo pronto.",
  },
  PREPARING: {
    label: "En preparación",
    nextStep: "Estamos preparando tu pedido.",
  },
  READY: {
    label: "Listo para retirar",
    nextStep: "Acércate al punto de retiro cuando puedas.",
  },
  DELIVERED: {
    label: "Pedido entregado",
    nextStep: "Este pedido ya fue entregado.",
  },
  CANCELLED: {
    label: "Pedido cancelado",
    nextStep: "Este pedido fue cancelado.",
  },
} as const;

function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function TrackingSkeleton() {
  return (
    <main className="min-h-[100dvh] bg-stone-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-xl animate-pulse rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
        <div className="h-4 w-36 rounded bg-stone-200" />
        <div className="mt-5 h-10 w-2/3 rounded bg-stone-200" />
        <div className="mt-8 h-28 rounded-xl bg-stone-100" />
        <div className="mt-7 h-16 rounded bg-stone-100" />
      </div>
    </main>
  );
}

function InvalidTracking() {
  return (
    <main className="flex min-h-[100dvh] items-center bg-stone-50 px-4 py-6 sm:px-6">
      <section className="mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
        <p className="text-sm font-semibold text-amber-800">Seguimiento</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">
          Este enlace no está disponible
        </h1>
        <p className="mt-4 leading-7 text-stone-600">
          Pide al restaurante que vuelva a mostrar el código de seguimiento.
        </p>
      </section>
    </main>
  );
}

function TrackingError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-[100dvh] items-center bg-stone-50 px-4 py-6 sm:px-6">
      <section className="mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
        <p className="text-sm font-semibold text-amber-800">Seguimiento</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">
          No pudimos cargar el pedido
        </h1>
        <p className="mt-4 leading-7 text-stone-600">
          Revisa tu conexión e inténtalo de nuevo.
        </p>
        <Button className="mt-6" onClick={onRetry} type="button">
          Reintentar
        </Button>
      </section>
    </main>
  );
}

function ActiveTracking({
  announcement,
  connectionState,
  isRefreshing,
  nonce,
  onRefresh,
  snapshot,
}: {
  announcement: string;
  connectionState: TrackingConnectionState;
  isRefreshing: boolean;
  nonce: string;
  onRefresh: () => void;
  snapshot: PublicTrackingSnapshot;
}) {
  const copy = STATUS_COPY[snapshot.status];
  const isReady = snapshot.status === "READY";
  const isTerminal =
    snapshot.status === "CANCELLED" || snapshot.status === "DELIVERED";
  const connectionCopy = {
    connecting: "Conectando actualizaciones…",
    connected: "Actualizaciones automáticas activas.",
    stale:
      "La conexión se interrumpió. Mostramos la última información disponible.",
    reconnecting: "Reconectando… La información puede estar desactualizada.",
  }[connectionState];
  const connectionWarning =
    connectionState === "stale" || connectionState === "reconnecting";

  return (
    <main className="min-h-[100dvh] bg-stone-50 px-4 py-6 sm:px-6 sm:py-10">
      <section className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 px-6 py-5 sm:px-8">
          <p className="text-sm font-semibold text-amber-800">
            {snapshot.restaurantName}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-950">
            Pedido {snapshot.orderNumber}
          </h1>
        </div>

        <div className="p-6 sm:p-8">
          <div
            className={
              isReady
                ? "rounded-xl border-2 border-amber-700 bg-amber-50 p-5"
                : "rounded-xl bg-stone-100 p-5"
            }
          >
            <p className="text-sm font-semibold text-stone-700">
              Estado actual
            </p>
            <h2
              className={
                isReady
                  ? "mt-2 text-3xl font-bold tracking-tight text-amber-950"
                  : "mt-2 text-2xl font-bold tracking-tight text-stone-950"
              }
            >
              {copy.label}
            </h2>
            <p className="mt-2 leading-6 text-stone-700">{copy.nextStep}</p>
          </div>

          {!isTerminal ? (
            <div className="mt-7">
              <p className="text-sm font-semibold text-stone-800">
                Hora estimada de retiro
              </p>
              <p className="mt-1 text-xl font-bold text-stone-950">
                {formatTime(snapshot.estimatedReadyAt)}
              </p>
              <p className="mt-1 text-sm leading-6 text-stone-600">
                Es una estimación aproximada.
              </p>
            </div>
          ) : null}

          {snapshot.pickupInstructions && !isTerminal ? (
            <div className="mt-7 border-t border-stone-200 pt-6">
              <p className="text-sm font-semibold text-stone-800">
                Instrucciones de retiro
              </p>
              <p className="mt-2 leading-7 text-stone-700">
                {snapshot.pickupInstructions}
              </p>
            </div>
          ) : null}

          {snapshot.status === "CANCELLED" && snapshot.cancellationReason ? (
            <div className="mt-7 border-t border-stone-200 pt-6">
              <p className="text-sm font-semibold text-stone-800">
                Motivo de cancelación
              </p>
              <p className="mt-2 leading-7 text-stone-700">
                {snapshot.cancellationReason}
              </p>
            </div>
          ) : null}

          <ReadyAlertControls nonce={nonce} status={snapshot.status} />

          <div
            className={
              connectionWarning
                ? "mt-7 rounded-xl border border-amber-300 bg-amber-50 p-4"
                : "mt-7 rounded-xl border border-stone-200 bg-stone-50 p-4"
            }
          >
            <p
              aria-live="polite"
              className="text-sm font-semibold text-stone-800"
              role="status"
            >
              {connectionCopy}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              Última actualización: {formatTime(snapshot.updatedAt)}
            </p>
            <Button
              className="mt-3"
              disabled={isRefreshing}
              onClick={onRefresh}
              type="button"
              variant="secondary"
            >
              {isRefreshing ? "Actualizando…" : "Actualizar ahora"}
            </Button>
          </div>

          <p aria-live="polite" className="sr-only" role="status">
            {announcement}
          </p>
        </div>
      </section>
    </main>
  );
}

export function TrackingPage({ initialNonce }: { initialNonce?: string }) {
  const [nonce, setNonce] = useState(initialNonce);
  const [snapshot, setSnapshot] = useState<PublicTrackingSnapshot>();
  const [state, setState] = useState<ViewState>("loading");
  const [connectionState, setConnectionState] =
    useState<TrackingConnectionState>("connecting");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const fragmentTokenRef = useRef<string | undefined>(undefined);
  const snapshotRef = useRef<PublicTrackingSnapshot | undefined>(undefined);
  const subscribedNonce = useRef<string | undefined>(undefined);
  const reconnectAttempt = useRef(0);
  const reconnectIndicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearSnapshot = useCallback(() => {
    snapshotRef.current = undefined;
    setSnapshot(undefined);
  }, []);

  const loadSnapshot = useCallback(
    async (
      currentNonce: string,
      options: { preserveSnapshot?: boolean } = {},
    ): Promise<SnapshotLoadResult> => {
      const preserveSnapshot =
        options.preserveSnapshot === true && Boolean(snapshotRef.current);
      if (preserveSnapshot) setIsRefreshing(true);
      else setState("loading");

      try {
        await ensureAnonymousTrackingSession();
        const response = await fetch(`/api/tracking/${currentNonce}`, {
          cache: "no-store",
        });
        if (response.status === 404) {
          clearSnapshot();
          setState("invalid");
          return "invalid";
        }
        if (!response.ok) throw new Error("Tracking request failed");
        const parsed = snapshotSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error("Tracking response was invalid");

        setSnapshot((current) => {
          const accepted =
            current &&
            Date.parse(parsed.data.updatedAt) < Date.parse(current.updatedAt)
              ? current
              : parsed.data;
          snapshotRef.current = accepted;
          return accepted;
        });
        setState("ready");
        return "success";
      } catch {
        if (snapshotRef.current) {
          setState("ready");
          setConnectionState("stale");
        } else {
          setState("error");
        }
        return "error";
      } finally {
        setIsRefreshing(false);
      }
    },
    [clearSnapshot],
  );

  const refreshManually = useCallback(async () => {
    if (!nonce || isRefreshing) return;
    const result = await loadSnapshot(nonce, { preserveSnapshot: true });
    if (result === "success") setAnnouncement("Información actualizada.");
    if (result === "error") {
      setAnnouncement(
        "No pudimos actualizar. Conservamos la última información disponible.",
      );
    }
  }, [isRefreshing, loadSnapshot, nonce]);

  useEffect(() => {
    if (initialNonce || typeof window === "undefined") return;
    fragmentTokenRef.current ??= window.location.hash.slice(1);
    const token = fragmentTokenRef.current;
    if (window.location.hash) window.history.replaceState(null, "", "/track");
    if (!token) {
      void Promise.resolve().then(() => setState("invalid"));
      return;
    }

    let cancelled = false;
    async function exchange() {
      try {
        await ensureAnonymousTrackingSession();
        const response = await fetch("/api/tracking/exchange", {
          body: JSON.stringify({ token }),
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (response.status === 404) {
          if (!cancelled) setState("invalid");
          return;
        }
        if (!response.ok) throw new Error("Tracking exchange failed");
        const parsed = exchangeSchema.safeParse(await response.json());
        if (!parsed.success)
          throw new Error("Tracking exchange response was invalid");
        if (cancelled) return;
        window.history.replaceState(null, "", `/track/${parsed.data.nonce}`);
        setNonce(parsed.data.nonce);
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void exchange();
    return () => {
      cancelled = true;
    };
  }, [initialNonce]);

  useEffect(() => {
    if (!nonce) return;
    void Promise.resolve().then(() => loadSnapshot(nonce));
  }, [loadSnapshot, nonce]);

  useEffect(() => {
    if (!nonce || subscribedNonce.current === nonce) return;
    const topicNonce = nonce;
    let active = true;
    let hasConnected = false;
    const supabase = createTrackingClient();
    const channel = supabase
      .channel(`tracking:${topicNonce}`, { config: { private: true } })
      .on("broadcast", { event: "order_changed" }, (event) => {
        const parsed = trackingEventSchema.safeParse(event.payload);
        if (!active || !parsed.success) return;
        setSnapshot((current) => {
          if (
            !current ||
            Date.parse(parsed.data.updatedAt) <= Date.parse(current.updatedAt)
          ) {
            return current;
          }
          const updated = {
            ...current,
            cancellationReason: parsed.data.cancellationReason,
            estimateUpdatedAt: parsed.data.estimateUpdatedAt,
            estimatedReadyAt: parsed.data.estimatedReadyAt,
            pickupInstructions: parsed.data.pickupInstructions,
            status: parsed.data.status,
            updatedAt: parsed.data.updatedAt,
          };
          snapshotRef.current = updated;
          return updated;
        });
        setAnnouncement(
          parsed.data.type === "ESTIMATE_UPDATED"
            ? "La estimación fue actualizada."
            : `Estado actualizado: ${STATUS_COPY[parsed.data.status].label}.`,
        );
      })
      .on("broadcast", { event: "tracking_revoked" }, (event) => {
        const parsed = trackingRevokedEventSchema.safeParse(event.payload);
        if (!active || !parsed.success) return;
        clearSnapshot();
        setState("invalid");
      });

    function clearReconnectIndicatorTimer() {
      if (!reconnectIndicatorTimer.current) return;
      clearTimeout(reconnectIndicatorTimer.current);
      reconnectIndicatorTimer.current = null;
    }

    function markDisconnected() {
      if (!active) return;
      setConnectionState("stale");
      reconnectAttempt.current += 1;
      clearReconnectIndicatorTimer();
      reconnectIndicatorTimer.current = setTimeout(() => {
        if (active) setConnectionState("reconnecting");
      }, getTrackingReconnectDelayMs(reconnectAttempt.current));
    }

    async function reconcileAfterSubscription() {
      if (!active) return;
      clearReconnectIndicatorTimer();
      setConnectionState(hasConnected ? "reconnecting" : "connecting");
      const result = await loadSnapshot(topicNonce, {
        preserveSnapshot: true,
      });
      if (!active) return;
      if (result === "success") {
        hasConnected = true;
        reconnectAttempt.current = 0;
        setConnectionState("connected");
      } else if (result === "error") {
        markDisconnected();
      }
    }

    function handleOffline() {
      markDisconnected();
    }

    function handleOnline() {
      if (!active) return;
      clearReconnectIndicatorTimer();
      setConnectionState("reconnecting");
      supabase.realtime.connect();
    }

    async function subscribe() {
      try {
        await supabase.realtime.setAuth();
        if (active) {
          subscribedNonce.current = topicNonce;
          channel.subscribe((status) => {
            if (!active) return;
            if (status === "SUBSCRIBED") {
              void reconcileAfterSubscription();
              return;
            }
            if (
              status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT" ||
              status === "CLOSED"
            ) {
              markDisconnected();
            }
          });
        }
      } catch {
        markDisconnected();
      }
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    void subscribe();

    return () => {
      active = false;
      clearReconnectIndicatorTimer();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (subscribedNonce.current === topicNonce) {
        subscribedNonce.current = undefined;
      }
      void supabase.removeChannel(channel);
    };
  }, [clearSnapshot, loadSnapshot, nonce]);

  useEffect(() => {
    const expiresAt = snapshot?.trackingExpiresAt;
    if (!expiresAt) return;
    const expirationTime = Date.parse(expiresAt);

    function expireIfNeeded() {
      if (expirationTime > Date.now()) return false;
      clearSnapshot();
      setState("invalid");
      return true;
    }

    if (expireIfNeeded()) return;
    const timeout = setTimeout(expireIfNeeded, expirationTime - Date.now());
    const handleVisibility = () => {
      if (document.visibilityState === "visible") expireIfNeeded();
    };
    window.addEventListener("focus", expireIfNeeded);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("focus", expireIfNeeded);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [clearSnapshot, snapshot?.trackingExpiresAt]);

  if (state === "loading") return <TrackingSkeleton />;
  if (state === "invalid") return <InvalidTracking />;
  if (state === "error") {
    return <TrackingError onRetry={() => nonce && void loadSnapshot(nonce)} />;
  }
  return snapshot ? (
    <ActiveTracking
      announcement={announcement}
      connectionState={connectionState}
      isRefreshing={isRefreshing}
      nonce={nonce ?? ""}
      onRefresh={() => void refreshManually()}
      snapshot={snapshot}
    />
  ) : (
    <TrackingSkeleton />
  );
}
