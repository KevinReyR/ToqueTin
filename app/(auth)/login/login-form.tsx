"use client";

import { useActionState } from "react";

import { loginAction, type LoginActionState } from "@/app/(auth)/login/actions";
import { Button, FieldError, Input } from "@/ui";
import { ERROR_MESSAGES } from "@/ui/messages/error-messages";

const initialState: LoginActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);
  const error = state.error ? ERROR_MESSAGES[state.error] : undefined;

  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <label
          className="mb-2 block text-sm font-semibold text-stone-800"
          htmlFor="email"
        >
          Correo de operador
        </label>
        <Input
          autoComplete="email"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>
      <div>
        <label
          className="mb-2 block text-sm font-semibold text-stone-800"
          htmlFor="password"
        >
          Contraseña
        </label>
        <Input
          autoComplete="current-password"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>
      <FieldError>{error}</FieldError>
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Ingresando…" : "Ingresar al panel"}
      </Button>
    </form>
  );
}
