"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  cancelOrderAction,
  revokeTrackingAction,
  transitionOrderAction,
  updateEstimateAction,
  type OperatorActionState,
} from "@/app/(operator)/operator/actions";
import type { OperatorOrder } from "@/domain/orders/operator-order";
import type {
  CancellationReasonCode,
  OrderStatus,
} from "@/domain/orders/types";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  FieldError,
  Input,
} from "@/ui";
import { ERROR_MESSAGES } from "@/ui/messages/error-messages";

const initialState: OperatorActionState = {};

const NEXT_ACTION: Partial<
  Record<OrderStatus, { label: string; target: OrderStatus }>
> = {
  RECEIVED: { label: "Iniciar preparación", target: "PREPARING" },
  PREPARING: { label: "Marcar como listo", target: "READY" },
  READY: { label: "Confirmar entrega", target: "DELIVERED" },
};

const CANCELLATION_REASONS: { value: CancellationReasonCode; label: string }[] =
  [
    { value: "CUSTOMER_REQUEST", label: "Solicitud del cliente" },
    { value: "PRODUCT_UNAVAILABLE", label: "Producto no disponible" },
    { value: "ORDER_ERROR", label: "Error en el pedido" },
    { value: "OPERATIONAL_ISSUE", label: "Problema operativo" },
    { value: "OTHER", label: "Otro" },
  ];

function ActionMessage({ state }: { state: OperatorActionState }) {
  if (state.error)
    return <FieldError>{ERROR_MESSAGES[state.error]}</FieldError>;
  if (state.success) {
    return (
      <p className="mt-3 text-sm text-emerald-800" role="status">
        {state.idempotent
          ? "La acción ya estaba aplicada."
          : "Pedido actualizado."}
      </p>
    );
  }
  return null;
}

export function TransitionAction({ order }: { order: OperatorOrder }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    transitionOrderAction,
    initialState,
  );
  const nextAction = NEXT_ACTION[order.status];

  useEffect(() => {
    if (state.success || state.error === "CONFLICT") router.refresh();
  }, [router, state.error, state.success]);

  if (!nextAction) return null;
  return (
    <div>
      <form action={action}>
        <input name="orderId" type="hidden" value={order.id} />
        <input name="expectedStatus" type="hidden" value={order.status} />
        <input name="targetStatus" type="hidden" value={nextAction.target} />
        <Button disabled={pending} type="submit">
          {pending ? "Actualizando…" : nextAction.label}
        </Button>
      </form>
      <ActionMessage state={state} />
    </div>
  );
}

export function CancelOrderDialog({ order }: { order: OperatorOrder }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] =
    useState<CancellationReasonCode>("CUSTOMER_REQUEST");
  const [state, action, pending] = useActionState(
    cancelOrderAction,
    initialState,
  );
  const router = useRouter();
  const canCancel = order.status === "RECEIVED" || order.status === "PREPARING";

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  if (!canCancel) return null;
  return (
    <Dialog open={state.success ? false : open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger">Cancelar pedido</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-xl font-bold text-stone-950">
          Cancelar pedido
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-6 text-stone-600">
          Esta acción cierra el pedido. El motivo será visible en el
          seguimiento.
        </DialogDescription>
        <form action={action} className="mt-6 space-y-4" noValidate>
          <input name="orderId" type="hidden" value={order.id} />
          <div>
            <label
              className="mb-2 block text-sm font-semibold text-stone-800"
              htmlFor="reasonCode"
            >
              Motivo
            </label>
            <select
              className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-stone-950 focus:outline-2 focus:outline-offset-2 focus:outline-amber-700"
              id="reasonCode"
              name="reasonCode"
              onChange={(event) =>
                setReason(event.target.value as CancellationReasonCode)
              }
              value={reason}
            >
              {CANCELLATION_REASONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          {reason === "OTHER" ? (
            <div>
              <label
                className="mb-2 block text-sm font-semibold text-stone-800"
                htmlFor="reasonText"
              >
                Explica el motivo
              </label>
              <Input
                id="reasonText"
                maxLength={1000}
                name="reasonText"
                required
              />
            </div>
          ) : null}
          <ActionMessage state={state} />
          <div className="flex justify-end gap-2">
            <Button
              disabled={pending}
              onClick={() => setOpen(false)}
              type="button"
              variant="secondary"
            >
              Volver
            </Button>
            <Button disabled={pending} type="submit" variant="danger">
              {pending ? "Cancelando…" : "Confirmar cancelación"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EstimateForm({ order }: { order: OperatorOrder }) {
  const [state, action, pending] = useActionState(
    updateEstimateAction,
    initialState,
  );
  const router = useRouter();
  const editable = order.status === "RECEIVED" || order.status === "PREPARING";

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  if (!editable) return null;
  return (
    <form
      action={action}
      className="mt-5 border-t border-stone-200 pt-5"
      noValidate
    >
      <input name="orderId" type="hidden" value={order.id} />
      <label
        className="mb-2 block text-sm font-semibold text-stone-800"
        htmlFor="estimatedMinutes"
      >
        Ajustar tiempo estimado (minutos)
      </label>
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-36"
          id="estimatedMinutes"
          min="1"
          name="estimatedMinutes"
          required
          type="number"
        />
        <Button disabled={pending} type="submit" variant="secondary">
          {pending ? "Guardando…" : "Actualizar estimación"}
        </Button>
      </div>
      <p className="mt-2 text-sm text-stone-600">
        Es una estimación aproximada, no una garantía.
      </p>
      <ActionMessage state={state} />
    </form>
  );
}

export function RevokeTrackingDialog({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    revokeTrackingAction,
    initialState,
  );
  const router = useRouter();

  useEffect(() => {
    if (state.success || state.error === "CONFLICT") router.refresh();
  }, [router, state.error, state.success]);

  return (
    <Dialog open={state.success ? false : open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger">Desactivar seguimiento</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-xl font-bold text-stone-950">
          Desactivar seguimiento
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-6 text-stone-600">
          El cliente perderá el acceso de inmediato. El pedido y su historial se
          conservarán.
        </DialogDescription>
        <form action={action} className="mt-6" noValidate>
          <input name="orderId" type="hidden" value={orderId} />
          <ActionMessage state={state} />
          <div className="mt-5 flex justify-end gap-2">
            <Button
              disabled={pending}
              onClick={() => setOpen(false)}
              type="button"
              variant="secondary"
            >
              Volver
            </Button>
            <Button disabled={pending} type="submit" variant="danger">
              {pending ? "Desactivando…" : "Confirmar desactivación"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
