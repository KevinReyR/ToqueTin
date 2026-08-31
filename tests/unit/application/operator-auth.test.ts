import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPassword = vi.fn();
const signOut = vi.fn();

vi.mock("@/platform/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { signInWithPassword, signOut } })),
}));

import {
  signInOperator,
  signOutOperator,
} from "@/application/auth/operator-auth";

describe("operator authentication", () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    signOut.mockReset();
  });

  it("creates an operator session with valid credentials", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    await expect(
      signInOperator({ email: "operator@example.test", password: "secret" }),
    ).resolves.toEqual({ ok: true, data: undefined });
  });

  it("maps invalid credentials without exposing the provider error", async () => {
    signInWithPassword.mockResolvedValue({
      error: new Error("provider detail"),
    });
    await expect(
      signInOperator({ email: "operator@example.test", password: "wrong" }),
    ).resolves.toEqual({ ok: false, error: { code: "INVALID_CREDENTIALS" } });
  });

  it("closes the local session", async () => {
    signOut.mockResolvedValue({ error: null });
    await expect(signOutOperator()).resolves.toEqual({
      ok: true,
      data: undefined,
    });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
