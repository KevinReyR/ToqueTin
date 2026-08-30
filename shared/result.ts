import type { ApplicationErrorCode } from "@/shared/errors";

export type Result<T, C extends ApplicationErrorCode = ApplicationErrorCode> =
  { ok: true; data: T } | { ok: false; error: { code: C } };

export function success<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function failure<C extends ApplicationErrorCode>(
  code: C,
): Result<never, C> {
  return { ok: false, error: { code } };
}
