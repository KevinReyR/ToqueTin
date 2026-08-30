import { describe, expect, it } from "vitest";

import { APPLICATION_ERROR_CODES } from "@/shared/errors";
import { failure, success } from "@/shared/result";
import { ERROR_MESSAGES } from "@/ui/messages/error-messages";

describe("application results and error messages", () => {
  it("discriminates success from a typed failure", () => {
    const succeeded = success({ orderId: "42" });
    const failed = failure("FORBIDDEN");

    expect(succeeded.ok && succeeded.data.orderId).toBe("42");
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.error.code).toBe("FORBIDDEN");
    }
  });

  it("maps every stable error code to a Spanish action message", () => {
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual(
      [...APPLICATION_ERROR_CODES].sort(),
    );
    expect(ERROR_MESSAGES.TRACKING_INVALID).toMatch(/enlace/i);
  });
});
