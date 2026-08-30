import { describe, expect, it } from "vitest";

import { createClient } from "@/platform/supabase/client";

describe("createClient", () => {
  it("creates a browser client with public configuration", () => {
    const client = createClient();

    expect(client.auth).toBeDefined();
    expect(client.from).toBeTypeOf("function");
  });
});
