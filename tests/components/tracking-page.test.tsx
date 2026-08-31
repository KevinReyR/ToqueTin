import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SubscriptionStatus =
  "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";
type BroadcastHandler = (event: { payload: unknown }) => void;

const realtimeMocks = vi.hoisted(() => ({
  broadcastHandlers: new Map<string, BroadcastHandler>(),
  connect: vi.fn(),
  removeChannel: vi.fn().mockResolvedValue(undefined),
  setAuth: vi.fn().mockResolvedValue(undefined),
  subscriptionHandler: undefined as
    ((status: SubscriptionStatus) => void) | undefined,
}));

const channel = {
  on: vi.fn(
    (_kind: string, filter: { event: string }, handler: BroadcastHandler) => {
      realtimeMocks.broadcastHandlers.set(filter.event, handler);
      return channel;
    },
  ),
  subscribe: vi.fn((handler: (status: SubscriptionStatus) => void) => {
    realtimeMocks.subscriptionHandler = handler;
    return channel;
  }),
};

vi.mock("@/application/tracking/tracking-session", () => ({
  ensureAnonymousTrackingSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/platform/supabase/tracking-client", () => ({
  createTrackingClient: () => ({
    channel: vi.fn().mockReturnValue(channel),
    realtime: {
      connect: realtimeMocks.connect,
      setAuth: realtimeMocks.setAuth,
    },
    removeChannel: realtimeMocks.removeChannel,
  }),
}));

import { TrackingPage } from "@/app/(tracking)/track/tracking-page";
import type { PublicTrackingSnapshot } from "@/domain/tracking/public-tracking-snapshot";

const nonce = "123e4567-e89b-12d3-a456-426614174000";
const activeSnapshot: PublicTrackingSnapshot = {
  restaurantName: "ToqueTin Centro",
  orderNumber: "A-127",
  status: "PREPARING",
  estimatedReadyAt: "2026-08-30T18:10:00Z",
  estimateUpdatedAt: "2026-08-30T17:50:00Z",
  pickupInstructions: "Recoge en el mostrador 2.",
  cancellationReason: null,
  trackingExpiresAt: null,
  updatedAt: "2026-08-30T17:52:00Z",
};

function responseFor(value: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(value), {
    status,
  });
}

async function renderActive(snapshot = activeSnapshot) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => Promise.resolve(responseFor(snapshot))),
  );
  render(<TrackingPage initialNonce={nonce} />);
  expect(
    await screen.findByText(`Pedido ${snapshot.orderNumber}`),
  ).toBeInTheDocument();
  await waitFor(() => expect(realtimeMocks.setAuth).toHaveBeenCalled());
}

beforeEach(() => {
  realtimeMocks.broadcastHandlers.clear();
  realtimeMocks.subscriptionHandler = undefined;
  realtimeMocks.connect.mockClear();
  realtimeMocks.removeChannel.mockClear();
  realtimeMocks.setAuth.mockClear();
  channel.on.mockClear();
  channel.subscribe.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("public tracking page", () => {
  it("shows active tracking, connecting state, and permanent manual refresh", async () => {
    await renderActive();

    expect(screen.getByText("En preparación")).toBeInTheDocument();
    expect(screen.getByText("ToqueTin Centro")).toBeInTheDocument();
    expect(screen.getByText("Recoge en el mostrador 2.")).toBeInTheDocument();
    expect(screen.getByText("Conectando actualizaciones…")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Actualizar ahora" }),
    ).toBeInTheDocument();
  });

  it("marks the channel connected only after an authoritative refetch", async () => {
    await renderActive();

    act(() => realtimeMocks.subscriptionHandler?.("SUBSCRIBED"));

    expect(
      await screen.findByText("Actualizaciones automáticas activas."),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("preserves the snapshot while stale and reconciles after reconnecting", async () => {
    await renderActive();
    act(() => realtimeMocks.subscriptionHandler?.("SUBSCRIBED"));
    await screen.findByText("Actualizaciones automáticas activas.");

    act(() => realtimeMocks.subscriptionHandler?.("CHANNEL_ERROR"));
    expect(
      screen.getByText(/Mostramos la última información disponible/),
    ).toBeInTheDocument();
    expect(screen.getByText("Pedido A-127")).toBeInTheDocument();

    act(() => window.dispatchEvent(new Event("online")));
    expect(screen.getByText(/Reconectando/)).toBeInTheDocument();
    expect(realtimeMocks.connect).toHaveBeenCalled();

    act(() => realtimeMocks.subscriptionHandler?.("SUBSCRIBED"));
    expect(
      await screen.findByText("Actualizaciones automáticas activas."),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("keeps the current snapshot visible during manual refresh", async () => {
    let resolveRefresh: ((value: Response) => void) | undefined;
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(responseFor(activeSnapshot))
        .mockReturnValueOnce(refreshResponse),
    );
    render(<TrackingPage initialNonce={nonce} />);
    await screen.findByText("Pedido A-127");

    fireEvent.click(screen.getByRole("button", { name: "Actualizar ahora" }));
    expect(screen.getByText("Pedido A-127")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Actualizando…" }),
    ).toBeDisabled();

    resolveRefresh?.(responseFor(activeSnapshot));
    expect(
      await screen.findByText("Información actualizada."),
    ).toBeInTheDocument();
  });

  it("retains the last snapshot when manual refresh fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(responseFor(activeSnapshot))
        .mockResolvedValueOnce(responseFor({ error: true }, 503)),
    );
    render(<TrackingPage initialNonce={nonce} />);
    await screen.findByText("Pedido A-127");

    fireEvent.click(screen.getByRole("button", { name: "Actualizar ahora" }));

    expect(
      await screen.findByText(/Conservamos la última información disponible/),
    ).toBeInTheDocument();
    expect(screen.getByText("Pedido A-127")).toBeInTheDocument();
    expect(
      screen.getByText(/Mostramos la última información disponible/),
    ).toBeInTheDocument();
  });

  it("announces and applies a newer estimate broadcast", async () => {
    await renderActive();
    const handler = realtimeMocks.broadcastHandlers.get("order_changed");

    act(() =>
      handler?.({
        payload: {
          cancellationReason: null,
          estimateUpdatedAt: "2026-08-30T18:00:00Z",
          estimatedReadyAt: "2026-08-30T18:45:00Z",
          pickupInstructions: "Recoge en el mostrador 2.",
          status: "PREPARING",
          type: "ESTIMATE_UPDATED",
          updatedAt: "2026-08-30T18:00:00Z",
          version: "2",
        },
      }),
    );

    expect(
      screen.getByText("La estimación fue actualizada."),
    ).toBeInTheDocument();
  });

  it("prioritizes READY without depending only on color", async () => {
    await renderActive({ ...activeSnapshot, status: "READY" });

    expect(screen.getByText("Listo para retirar")).toBeInTheDocument();
    expect(
      screen.getByText("Acércate al punto de retiro cuando puedas."),
    ).toBeInTheDocument();
  });

  it("renders terminal cancellation as read-only with its reason", async () => {
    await renderActive({
      ...activeSnapshot,
      cancellationReason: "Solicitud del cliente",
      status: "CANCELLED",
    });

    expect(screen.getByText("Pedido cancelado")).toBeInTheDocument();
    expect(screen.getByText("Solicitud del cliente")).toBeInTheDocument();
    expect(
      screen.queryByText("Hora estimada de retiro"),
    ).not.toBeInTheDocument();
  });

  it("renders delivery as an unequivocal read-only closing state", async () => {
    await renderActive({ ...activeSnapshot, status: "DELIVERED" });

    expect(screen.getByText("Pedido entregado")).toBeInTheDocument();
    expect(
      screen.getByText("Este pedido ya fue entregado."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Hora estimada de retiro"),
    ).not.toBeInTheDocument();
  });

  it("does not reveal order data for an invalid tracking nonce", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(responseFor({ error: true }, 404)),
    );

    render(<TrackingPage initialNonce={nonce} />);

    expect(
      await screen.findByText("Este enlace no está disponible"),
    ).toBeInTheDocument();
    expect(screen.queryByText("ToqueTin Centro")).not.toBeInTheDocument();
  });

  it("removes visible order data when tracking is revoked", async () => {
    await renderActive();
    const handler = realtimeMocks.broadcastHandlers.get("tracking_revoked");

    act(() => handler?.({ payload: { type: "TRACKING_REVOKED" } }));

    expect(
      screen.getByText("Este enlace no está disponible"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Pedido A-127")).not.toBeInTheDocument();
  });

  it("removes terminal data when its exact expiration is reached", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T18:00:00Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        responseFor({
          ...activeSnapshot,
          status: "DELIVERED",
          trackingExpiresAt: "2026-08-30T18:00:01Z",
        }),
      ),
    );
    render(<TrackingPage initialNonce={nonce} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Pedido entregado")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(
      screen.getByText("Este enlace no está disponible"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Pedido A-127")).not.toBeInTheDocument();
  });
});
