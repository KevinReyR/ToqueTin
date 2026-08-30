import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("Home", () => {
  it("shows an accessible Spanish heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "Localizador digital de pedidos" }),
    ).toBeInTheDocument();
  });
});
