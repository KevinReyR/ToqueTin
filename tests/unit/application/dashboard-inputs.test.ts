import { describe, expect, it } from "vitest";

import {
  cutoffTimeInputSchema,
  operationalJourneyInputSchema,
  selectRestaurantInputSchema,
} from "@/application/validation/dashboard-inputs";

describe("dashboard input schemas", () => {
  it("accepts a restaurant, UTC journey, and local cutoff time", () => {
    expect(
      selectRestaurantInputSchema.safeParse({ restaurantId: "17" }).success,
    ).toBe(true);
    expect(
      operationalJourneyInputSchema.safeParse({
        restaurantId: "17",
        startedAt: "2026-08-29T05:00:00Z",
        endedAt: "2026-08-30T05:00:00Z",
      }).success,
    ).toBe(true);
    expect(
      cutoffTimeInputSchema.safeParse({
        restaurantId: "17",
        cutoffTime: "23:45",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid restaurant IDs, intervals, and cutoff formats", () => {
    expect(
      selectRestaurantInputSchema.safeParse({ restaurantId: "-17" }).success,
    ).toBe(false);
    expect(
      operationalJourneyInputSchema.safeParse({
        restaurantId: "17",
        startedAt: "2026-08-30T05:00:00Z",
        endedAt: "2026-08-29T05:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      cutoffTimeInputSchema.safeParse({
        restaurantId: "17",
        cutoffTime: "24:00",
      }).success,
    ).toBe(false);
  });
});
