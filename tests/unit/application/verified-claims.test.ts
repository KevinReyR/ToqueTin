import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();

vi.mock("@/platform/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getClaims } })),
}));

import { getVerifiedClaims } from "@/application/auth/verified-claims";

describe("getVerifiedClaims", () => {
  beforeEach(() => {
    getClaims.mockReset();
  });

  it("returns signed claims for an authenticated request", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "operator-id" } } });

    await expect(getVerifiedClaims()).resolves.toEqual({ sub: "operator-id" });
  });

  it("returns null when the request has no valid session", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });

    await expect(getVerifiedClaims()).resolves.toBeNull();
  });
});
