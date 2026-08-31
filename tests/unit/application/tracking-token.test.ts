import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import QRCode from "qrcode";

import {
  createTrackingQrDataUrl,
  createTrackingUrl,
} from "@/application/tracking/tracking-qr";
import {
  createTrackingToken,
  validateTrackingToken,
} from "@/application/tracking/tracking-token";

const input = {
  nonce: "123e4567-e89b-12d3-a456-426614174000",
  version: 1,
};
const secret = "12345678901234567890123456789012";

describe("tracking token generation", () => {
  it("creates a deterministic versioned HMAC token", () => {
    expect(createTrackingToken(input, secret)).toBe(
      "v1.123e4567-e89b-12d3-a456-426614174000.SFUf0V2Av_4MMGsWeIBCs_VwtEwt7pikeUkCbVKiYqg",
    );
  });

  it("changes the signature when the nonce is altered", () => {
    const altered = createTrackingToken(
      { ...input, nonce: "123e4567-e89b-12d3-a456-426614174001" },
      secret,
    );
    expect(altered).not.toBe(createTrackingToken(input, secret));
  });

  it("accepts an issued token and rejects malformed, altered, or unknown versions", () => {
    const token = createTrackingToken(input, secret);
    expect(validateTrackingToken(token, secret)).toEqual(input);
    expect(validateTrackingToken(token.slice(0, -1), secret)).toBeNull();
    expect(
      validateTrackingToken(
        token.replace("426614174000", "426614174001"),
        secret,
      ),
    ).toBeNull();
    expect(
      validateTrackingToken(token.replace("v1.", "v2."), secret),
    ).toBeNull();
  });

  it("builds and decodes a fragment-only QR URL without order data", async () => {
    const url = createTrackingUrl(input);
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:3000\/track#v1\./);
    expect(url).not.toContain("order_number");
    expect(url).not.toContain("?");
    await expect(createTrackingQrDataUrl(input)).resolves.toMatch(
      /^data:image\/png;base64,/,
    );

    const png = PNG.sync.read(await QRCode.toBuffer(url, { width: 384 }));
    expect(
      jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data,
    ).toBe(url);
  });
});
