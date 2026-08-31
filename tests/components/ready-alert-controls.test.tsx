import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const alertMocks = vi.hoisted(() => ({
  armAudio: vi.fn(),
  closeAudio: vi.fn(),
  detect: vi.fn(),
  playAudio: vi.fn(),
  registerWorker: vi.fn(),
  subscribePush: vi.fn(),
  vibrate: vi.fn(),
}));

vi.mock("@/application/notifications/browser-ready-alerts", () => ({
  armReadyAudioAlert: alertMocks.armAudio,
  detectReadyAlertCapabilities: alertMocks.detect,
  registerReadyAlertsWorker: alertMocks.registerWorker,
  subscribeReadyPush: alertMocks.subscribePush,
  vibrateReadyAlert: alertMocks.vibrate,
}));

import { ReadyAlertControls } from "@/ui/components/ready-alert-controls";

const nonce = "123e4567-e89b-12d3-a456-426614174000";

function notificationWith(
  permission: NotificationPermission,
  requestPermission = vi.fn().mockResolvedValue(permission),
) {
  return Object.assign(class NotificationMock {}, {
    permission,
    requestPermission,
  });
}

beforeEach(() => {
  alertMocks.detect.mockReturnValue({
    audio: true,
    vibration: true,
    notifications: true,
    serviceWorker: true,
    push: true,
  });
  alertMocks.playAudio.mockResolvedValue(true);
  alertMocks.closeAudio.mockResolvedValue(undefined);
  alertMocks.armAudio.mockResolvedValue({
    close: alertMocks.closeAudio,
    play: alertMocks.playAudio,
  });
  alertMocks.registerWorker.mockResolvedValue({ pushManager: {} });
  alertMocks.subscribePush.mockResolvedValue({
    endpoint: "https://push.example.test/subscription",
    expirationTime: null,
    keys: {
      auth: "auth-key-value-1234",
      p256dh: "p256dh-key-value-12345678901234567890",
    },
  });
  alertMocks.vibrate.mockReturnValue(true);
  vi.stubGlobal(
    "Notification",
    notificationWith("default", vi.fn().mockResolvedValue("granted")),
  );
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ channels: { push: true } })),
      ),
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("ready alert consent", () => {
  it("never requests notification permission before the explicit action", async () => {
    render(<ReadyAlertControls nonce={nonce} status="PREPARING" />);

    const button = await screen.findByRole("button", {
      name: "Avísame cuando esté listo",
    });
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    expect(alertMocks.armAudio).not.toHaveBeenCalled();

    fireEvent.click(button);

    await waitFor(() =>
      expect(Notification.requestPermission).toHaveBeenCalledTimes(1),
    );
    expect(await screen.findByText(/Avisos activados:/)).toHaveTextContent(
      "sonido, vibración, notificación",
    );
    expect(fetch).toHaveBeenCalledWith(
      `/api/tracking/${nonce}/alerts`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("explains denial without blocking visual tracking", async () => {
    vi.stubGlobal("Notification", notificationWith("denied"));
    alertMocks.detect.mockReturnValue({
      audio: false,
      vibration: false,
      notifications: true,
      serviceWorker: true,
      push: true,
    });
    render(<ReadyAlertControls nonce={nonce} status="PREPARING" />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Avísame cuando esté listo" }),
    );

    expect(
      await screen.findByText(/No autorizaste las notificaciones/),
    ).toHaveTextContent("El aviso visual seguirá funcionando");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("degrades safely when optional browser APIs are absent", async () => {
    alertMocks.detect.mockReturnValue({
      audio: false,
      vibration: false,
      notifications: false,
      serviceWorker: false,
      push: false,
    });
    render(<ReadyAlertControls nonce={nonce} status="PREPARING" />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Avísame cuando esté listo" }),
    );

    expect(
      await screen.findByText(/Este dispositivo no ofrece avisos adicionales/),
    ).toHaveTextContent("El seguimiento visual sigue activo");
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });

  it("runs armed local channels only when the order becomes READY", async () => {
    alertMocks.detect.mockReturnValue({
      audio: true,
      vibration: true,
      notifications: false,
      serviceWorker: false,
      push: false,
    });
    const { rerender } = render(
      <ReadyAlertControls nonce={nonce} status="PREPARING" />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Avísame cuando esté listo" }),
    );
    await screen.findByText(/Avisos activados: sonido, vibración/);
    expect(alertMocks.playAudio).not.toHaveBeenCalled();

    rerender(<ReadyAlertControls nonce={nonce} status="READY" />);

    await waitFor(() => expect(alertMocks.playAudio).toHaveBeenCalledTimes(1));
    expect(alertMocks.vibrate).toHaveBeenCalledTimes(1);
  });

  it("keeps READY visible when an additional channel fails", async () => {
    alertMocks.detect.mockReturnValue({
      audio: true,
      vibration: false,
      notifications: false,
      serviceWorker: false,
      push: false,
    });
    alertMocks.playAudio.mockResolvedValue(false);
    const { rerender } = render(
      <ReadyAlertControls nonce={nonce} status="PREPARING" />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Avísame cuando esté listo" }),
    );
    await screen.findByText(/Avisos activados: sonido/);

    rerender(<ReadyAlertControls nonce={nonce} status="READY" />);

    expect(await screen.findByText(/El pedido está listo/)).toHaveTextContent(
      "la pantalla sigue actualizada",
    );
  });
});
