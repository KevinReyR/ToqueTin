"use client";

import { useActionState } from "react";

import {
  scheduleCutoffAction,
  type OperatorActionState,
} from "@/app/(operator)/operator/actions";
import { Button, Input } from "@/ui";
import { ERROR_MESSAGES } from "@/ui/messages/error-messages";

export function CutoffForm({ currentCutoff }: { currentCutoff: string }) {
  const [state, action, pending] = useActionState<
    OperatorActionState,
    FormData
  >(scheduleCutoffAction, {});

  return (
    <form
      action={action}
      className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="w-full sm:max-w-52">
        <label
          className="mb-1 block text-sm font-medium text-stone-800"
          htmlFor="cutoff-time"
        >
          Nueva hora de corte
        </label>
        <Input
          defaultValue={currentCutoff.slice(0, 5)}
          id="cutoff-time"
          name="cutoffTime"
          required
          type="time"
        />
      </div>
      <Button disabled={pending} type="submit" variant="secondary">
        {pending ? "Programando…" : "Programar cambio"}
      </Button>
      <span aria-live="polite" className="text-sm text-stone-700" role="status">
        {state.success
          ? "Cambio programado para la próxima jornada."
          : state.error
            ? ERROR_MESSAGES[state.error]
            : ""}
      </span>
    </form>
  );
}
