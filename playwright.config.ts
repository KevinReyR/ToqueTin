import { defineConfig, devices } from "@playwright/test";

const testServerEnv = {
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "test-publishable-key",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY:
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "test-vapid-public-key",
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-role-key",
  TRACKING_TOKEN_HMAC_SECRET:
    process.env.TRACKING_TOKEN_HMAC_SECRET ??
    "12345678901234567890123456789012",
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ?? "test-vapid-private-key",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3000",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    env: testServerEnv,
  },
});
