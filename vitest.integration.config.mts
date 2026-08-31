import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["tests/integration/**/*.test.ts"],
    env: {
      APP_BASE_URL: "http://127.0.0.1:3000",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "test-vapid-public-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      TRACKING_TOKEN_HMAC_SECRET: "12345678901234567890123456789012",
      VAPID_PRIVATE_KEY: "test-vapid-private-key",
    },
  },
});
