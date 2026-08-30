import { describe, expect, it, vi } from "vitest";

import { createServerCookieAdapter } from "@/platform/supabase/server-cookies";

describe("server Supabase cookie adapter", () => {
  it("reads and writes SSR cookies", () => {
    const set = vi.fn();
    const adapter = createServerCookieAdapter({
      getAll: () => [{ name: "session", value: "old" }],
      set,
    });

    expect(adapter.getAll()).toEqual([{ name: "session", value: "old" }]);
    adapter.setAll([
      { name: "session", value: "new", options: { httpOnly: true } },
    ]);
    expect(set).toHaveBeenCalledWith("session", "new", { httpOnly: true });
  });

  it("leaves cookie mutation to Proxy when a Server Component store is read-only", () => {
    const adapter = createServerCookieAdapter({
      getAll: () => [],
      set: () => {
        throw new Error(
          "Cookies can only be modified in a Server Action or Route Handler.",
        );
      },
    });

    expect(() =>
      adapter.setAll([{ name: "session", value: "new", options: {} }]),
    ).not.toThrow();
  });
});
