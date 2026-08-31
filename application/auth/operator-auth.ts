import "server-only";

import { failure, success, type Result } from "@/shared/result";
import { createClient } from "@/platform/supabase/server";

export interface SignInOperatorInput {
  email: string;
  password: string;
}

export async function signInOperator(
  input: SignInOperatorInput,
): Promise<Result<void, "INVALID_CREDENTIALS">> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(input);

  return error ? failure("INVALID_CREDENTIALS") : success(undefined);
}

export async function signOutOperator(): Promise<Result<void>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  return error ? failure("AUTHENTICATION_REQUIRED") : success(undefined);
}
