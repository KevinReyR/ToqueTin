import { z } from "zod";

export const internalIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Debe ser un identificador positivo.");

export const utcDateTimeSchema = z.iso.datetime({ offset: true });

export function isFutureDate(value: string, now: Date): boolean {
  return Date.parse(value) > now.getTime();
}
