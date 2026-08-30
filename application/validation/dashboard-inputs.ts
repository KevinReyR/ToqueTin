import { z } from "zod";

import {
  internalIdSchema,
  utcDateTimeSchema,
} from "@/application/validation/common";

export const selectRestaurantInputSchema = z.object({
  restaurantId: internalIdSchema,
});

export const operationalJourneyInputSchema = z
  .object({
    restaurantId: internalIdSchema,
    startedAt: utcDateTimeSchema,
    endedAt: utcDateTimeSchema,
  })
  .refine((input) => Date.parse(input.startedAt) < Date.parse(input.endedAt), {
    message: "El inicio debe ser anterior al final.",
    path: ["endedAt"],
  });

export const cutoffTimeInputSchema = z.object({
  restaurantId: internalIdSchema,
  cutoffTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "La hora debe usar el formato HH:mm.",
  }),
});

export type SelectRestaurantInput = z.infer<typeof selectRestaurantInputSchema>;
export type OperationalJourneyInput = z.infer<
  typeof operationalJourneyInputSchema
>;
export type CutoffTimeInput = z.infer<typeof cutoffTimeInputSchema>;
