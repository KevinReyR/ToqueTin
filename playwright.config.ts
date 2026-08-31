import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";

function readLocalSupabaseEnvironment() {
  try {
    const output = execFileSync(
      "pnpm",
      ["exec", "supabase", "status", "-o", "env"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return Object.fromEntries(
      output
        .trim()
        .split("\n")
        .map((line) => {
          const separator = line.indexOf("=");
          return [
            line.slice(0, separator),
            line.slice(separator + 1).replaceAll(/^"|"$/g, ""),
          ];
        }),
    );
  } catch {
    return {};
  }
}

const localSupabase = readLocalSupabaseEnvironment();

const testServerEnv = {
  APP_BASE_URL: process.env.APP_BASE_URL ?? "http://127.0.0.1:3000",
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    localSupabase.API_URL ??
    "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    localSupabase.PUBLISHABLE_KEY ??
    "test-publishable-key",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY:
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "test-vapid-public-key",
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    localSupabase.SERVICE_ROLE_KEY ??
    "test-service-role-key",
  TRACKING_TOKEN_HMAC_SECRET:
    process.env.TRACKING_TOKEN_HMAC_SECRET ??
    "12345678901234567890123456789012",
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ?? "test-vapid-private-key",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:3000" },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    env: testServerEnv,
  },
});
