"use client";

import { Button } from "@/ui";

export function PrintQrButton() {
  return (
    <Button onClick={() => window.print()} type="button" variant="secondary">
      Imprimir QR
    </Button>
  );
}
