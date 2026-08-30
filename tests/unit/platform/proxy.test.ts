import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type CookieUpdate = {
  name: string;
  value: string;
  options: Record<string, never>;
};

type CookieAdapter = {
  setAll(cookies: CookieUpdate[], headers: Record<string, string>): void;
};

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  createServerClient: vi.fn(),
}));

mocks.createServerClient.mockImplementation(
  (_url: string, _key: string, options: { cookies: CookieAdapter }) => {
    mocks.getClaims.mockImplementation(async () => {
      options.cookies.setAll(
        [{ name: "sb-session", value: "refreshed", options: {} }],
        { "cache-control": "private, no-store" },
      );

      return { data: { claims: null } };
    });

    return { auth: { getClaims: mocks.getClaims } };
  },
);

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

import { updateSession } from "@/platform/supabase/proxy";

describe("Supabase session Proxy", () => {
  beforeEach(() => {
    mocks.createServerClient.mockClear();
    mocks.getClaims.mockClear();
  });

  it("refreshes session cookies on both the request and response", async () => {
    const request = new NextRequest("http://localhost/operator", {
      headers: { cookie: "sb-session=stale" },
    });

    const response = await updateSession(request);

    expect(mocks.getClaims).toHaveBeenCalledOnce();
    expect(request.cookies.get("sb-session")?.value).toBe("refreshed");
    expect(response.cookies.get("sb-session")?.value).toBe("refreshed");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
