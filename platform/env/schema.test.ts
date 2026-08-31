import { describe, expect, it } from "vitest";

import { parsePublicEnv } from "@/platform/env/schema";
import { parseServerEnv } from "@/platform/env/server-schema";

const validPublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "test-vapid-public-key",
};

const validServerEnv = {
  ...validPublicEnv,
  APP_BASE_URL: "http://127.0.0.1:3000",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  TRACKING_TOKEN_HMAC_SECRET: "12345678901234567890123456789012",
  VAPID_PRIVATE_KEY: "test-vapid-private-key",
};

describe("environment validation", () => {
  it("accepts complete public and server configuration", () => {
    expect(parsePublicEnv(validPublicEnv)).toEqual(validPublicEnv);
    expect(parseServerEnv(validServerEnv)).toEqual(validServerEnv);
  });

  it("rejects a missing required server secret", () => {
    const missingSecret = {
      ...validServerEnv,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    };

    expect(() => parseServerEnv(missingSecret)).toThrow(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
  });

  it("rejects malformed public URLs and short HMAC secrets", () => {
    expect(() =>
      parsePublicEnv({
        ...validPublicEnv,
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      }),
    ).toThrow("NEXT_PUBLIC_SUPABASE_URL");

    expect(() =>
      parseServerEnv({
        ...validServerEnv,
        TRACKING_TOKEN_HMAC_SECRET: "too-short",
      }),
    ).toThrow("TRACKING_TOKEN_HMAC_SECRET");
  });
});
