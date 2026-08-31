import type { ApplicationErrorCode } from "@/shared/errors";

export type Result<T, C extends ApplicationErrorCode = ApplicationErrorCode> =
  { ok: true; data: T } | { ok: false; error: { code: C } };

export function success<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function failure<const C extends ApplicationErrorCode>(
  code: C,
): {
  ok: false;
  error: { code: C };
} {
  return { ok: false, error: { code } };
}
