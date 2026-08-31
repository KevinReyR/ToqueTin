"use client";

import { useActionState } from "react";

import {
  createOrderAction,
  type OperatorActionState,
} from "@/app/(operator)/operator/actions";
import { Button, FieldError, Input, Textarea } from "@/ui";
import { ERROR_MESSAGES } from "@/ui/messages/error-messages";

const initialState: OperatorActionState = {};

export function OrderForm() {
  const [state, action, pending] = useActionState(
    createOrderAction,
    initialState,
  );
  const error = state.error ? ERROR_MESSAGES[state.error] : undefined;

  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <label
          className="mb-2 block text-sm font-semibold text-stone-800"
          htmlFor="orderNumber"
        >
          Número del pedido
        </label>
        <Input id="orderNumber" maxLength={100} name="orderNumber" required />
      </div>
      <div>
        <label
          className="mb-2 block text-sm font-semibold text-stone-800"
          htmlFor="estimatedMinutes"
        >
          Tiempo estimado (minutos)
        </label>
        <Input
          id="estimatedMinutes"
          min="1"
          name="estimatedMinutes"
          required
          type="number"
        />
        <p className="mt-1 text-sm text-stone-600">
          Es una estimación aproximada, no una garantía.
        </p>
      </div>
      <div>
        <label
          className="mb-2 block text-sm font-semibold text-stone-800"
          htmlFor="pickupInstructions"
        >
          Instrucciones de retiro{" "}
          <span className="font-normal">(opcional)</span>
        </label>
        <Textarea
          id="pickupInstructions"
          maxLength={1000}
          name="pickupInstructions"
        />
        <p className="mt-1 text-sm text-stone-600">
          No incluyas nombre, teléfono ni otros datos personales.
        </p>
      </div>
      <FieldError>{error}</FieldError>
      <Button disabled={pending} type="submit">
        {pending ? "Creando pedido…" : "Crear pedido y mostrar QR"}
      </Button>
    </form>
  );
}
