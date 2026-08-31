import "server-only";

import { z } from "zod";

const anonymousClaimsSchema = z.object({
  is_anonymous: z.literal(true),
  sub: z.string().uuid(),
});

export function getAnonymousTrackingSubject(claims: unknown): string | null {
  const parsed = anonymousClaimsSchema.safeParse(claims);
  return parsed.success ? parsed.data.sub : null;
}
