import { z } from "zod";

import { publicEnvSchema } from "@/platform/env/schema";

const serverEnvSchema = publicEnvSchema.extend({
  APP_BASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TRACKING_TOKEN_HMAC_SECRET: z.string().min(32),
  VAPID_PRIVATE_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  input: Record<string, string | undefined>,
): ServerEnv {
  return serverEnvSchema.parse(input);
}
