import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dashboardMocks = vi.hoisted(() => ({
  getActiveRestaurantContext: vi.fn(),
  getDashboardSummary: vi.fn(),
}));

vi.mock("@/application/restaurants/active-restaurant", () => ({
  getActiveRestaurantContext: dashboardMocks.getActiveRestaurantContext,
}));
vi.mock("@/application/dashboard/dashboard", () => ({
  getDashboardSummary: dashboardMocks.getDashboardSummary,
}));
vi.mock("@/app/(operator)/operator/dashboard-realtime", () => ({
  DashboardRealtime: () => <p>Actualización automática activa</p>,
}));
vi.mock("@/app/(operator)/operator/cutoff-form", () => ({
  CutoffForm: () => <button>Programar cambio</button>,
}));

import OperatorPage from "@/app/(operator)/operator/page";

const restaurant = {
  id: "10",
  organizationId: "1",
  name: "Mercado Central",
  timezone: "America/Bogota",
  dayCutoffTime: "06:00:00",
  pendingDayCutoffTime: "07:00:00",
  pendingCutoffEffectiveAt: "2026-09-01T12:00:00Z",
};

beforeEach(() => {
  dashboardMocks.getActiveRestaurantContext.mockResolvedValue({
    activeRestaurant: restaurant,
    restaurants: [restaurant],
  });
  dashboardMocks.getDashboardSummary.mockResolvedValue({
    ok: true,
    data: {
      restaurantId: "10",
      operationalDay: {
        startedAt: "2026-08-31T11:00:00Z",
        endedAt: "2026-09-01T11:00:00Z",
      },
      orderCountByStatus: {
        RECEIVED: 1,
        PREPARING: 0,
        READY: 1,
        DELIVERED: 0,
        CANCELLED: 0,
      },
      totalCreated: 2,
      totalActive: 2,
      averagePreparationSeconds: null,
      averagePickupSeconds: null,
      orders: [
        {
          id: "31",
          restaurantId: "10",
          orderNumber: "A-31",
          status: "READY",
          estimatedReadyAt: "2026-08-31T12:00:00Z",
          estimateUpdatedAt: "2026-08-31T11:30:00Z",
          pickupInstructions: null,
          version: "3",
          createdAt: "2026-08-31T11:20:00Z",
          updatedAt: "2026-08-31T11:55:00Z",
        },
        {
          id: "32",
          restaurantId: "10",
          orderNumber: "A-32",
          status: "RECEIVED",
          estimatedReadyAt: "2026-08-31T12:20:00Z",
          estimateUpdatedAt: "2026-08-31T11:40:00Z",
          pickupInstructions: null,
          version: "1",
          createdAt: "2026-08-31T11:40:00Z",
          updatedAt: "2026-08-31T11:40:00Z",
        },
      ],
    },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("operator dashboard", () => {
  it("shows one restaurant, groups orders and represents null averages honestly", async () => {
    render(await OperatorPage());

    expect(
      screen.getByRole("heading", { name: "Mercado Central" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pedidos creados").parentElement).toHaveTextContent(
      "2",
    );
    expect(
      screen.getByRole("heading", { name: /^Listos para retirar/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pedido A-31")).toBeInTheDocument();
    expect(screen.getAllByText("Aún no hay datos")).toHaveLength(2);
    expect(screen.getByText(/Próximo corte: 07:00/)).toBeInTheDocument();
  });

  it("shows a useful empty state with a creation action", async () => {
    dashboardMocks.getDashboardSummary.mockResolvedValueOnce({
      ok: true,
      data: {
        restaurantId: "10",
        operationalDay: {
          startedAt: "2026-08-31T11:00:00Z",
          endedAt: "2026-09-01T11:00:00Z",
        },
        orderCountByStatus: {
          RECEIVED: 0,
          PREPARING: 0,
          READY: 0,
          DELIVERED: 0,
          CANCELLED: 0,
        },
        totalCreated: 0,
        totalActive: 0,
        averagePreparationSeconds: null,
        averagePickupSeconds: null,
        orders: [],
      },
    });
    render(await OperatorPage());

    expect(
      screen.getByRole("heading", { name: "La jornada todavía está vacía" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Crear el primer pedido" }),
    ).toHaveAttribute("href", "/operator/orders/new");
  });
});
