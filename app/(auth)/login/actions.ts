"use server";

import { redirect } from "next/navigation";

import { signInOperator } from "@/application/auth/operator-auth";
import { getActiveRestaurantContext } from "@/application/restaurants/active-restaurant";

export interface LoginActionState {
  error?: "INVALID_CREDENTIALS" | "VALIDATION_ERROR";
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email ||
    !password
  ) {
    return { error: "VALIDATION_ERROR" };
  }

  const result = await signInOperator({ email, password });
  if (!result.ok) return { error: result.error.code };

  await getActiveRestaurantContext();
  redirect("/operator");
}
