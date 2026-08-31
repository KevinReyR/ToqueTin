import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import {
  CancelOrderDialog,
  EstimateForm,
  RevokeTrackingDialog,
  TransitionAction,
} from "@/app/(operator)/operator/orders/[orderId]/order-actions";
import { OrderForm } from "@/app/(operator)/operator/orders/new/order-form";
import type { OperatorOrder } from "@/domain/orders/operator-order";

const receivedOrder: OperatorOrder = {
  id: "12",
  restaurantId: "7",
  orderNumber: "A-17",
  status: "RECEIVED",
  estimatedReadyAt: "2026-08-30T18:30:00Z",
  estimateUpdatedAt: "2026-08-30T18:00:00Z",
  pickupInstructions: null,
  version: "1",
  createdAt: "2026-08-30T18:00:00Z",
  updatedAt: "2026-08-30T18:00:00Z",
};

afterEach(cleanup);

describe("operator order forms", () => {
  it("collects only order data and warns against PII", () => {
    render(<OrderForm />);

    expect(screen.getByLabelText("Número del pedido")).toBeRequired();
    expect(screen.getByLabelText("Tiempo estimado (minutos)")).toBeRequired();
    expect(
      screen.getByLabelText(/Instrucciones de retiro/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No incluyas nombre, teléfono/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/correo|teléfono del cliente/i),
    ).not.toBeInTheDocument();
  });

  it("shows only the valid next transition and editable estimate", () => {
    render(
      <>
        <TransitionAction order={receivedOrder} />
        <EstimateForm order={receivedOrder} />
      </>,
    );
    expect(
      screen.getByRole("button", { name: "Iniciar preparación" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Actualizar estimación" }),
    ).toBeInTheDocument();
  });

  it("hides operational controls for terminal orders", () => {
    render(
      <>
        <TransitionAction order={{ ...receivedOrder, status: "DELIVERED" }} />
        <EstimateForm order={{ ...receivedOrder, status: "DELIVERED" }} />
      </>,
    );
    expect(
      screen.queryByRole("button", { name: /preparación|estimación/i }),
    ).not.toBeInTheDocument();
  });

  it("offers the cancellation dialog only in cancellable states", () => {
    render(<CancelOrderDialog order={receivedOrder} />);
    expect(
      screen.getByRole("button", { name: "Cancelar pedido" }),
    ).toBeInTheDocument();
  });

  it("confirms tracking revocation without implying order deletion", () => {
    render(<RevokeTrackingDialog orderId={receivedOrder.id} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Desactivar seguimiento" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Desactivar seguimiento" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/El pedido y su historial se conservarán/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar desactivación" }),
    ).toBeInTheDocument();
  });
});
