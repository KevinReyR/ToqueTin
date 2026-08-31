import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoginForm } from "@/app/(auth)/login/login-form";

describe("LoginForm", () => {
  it("shows an accessible Spanish operator login without public account options", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText("Correo de operador")).toBeRequired();
    expect(screen.getByLabelText("Contraseña")).toBeRequired();
    expect(
      screen.getByRole("button", { name: "Ingresar al panel" }),
    ).toBeEnabled();
    expect(screen.queryByText(/registr/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recuper/i)).not.toBeInTheDocument();
  });
});
