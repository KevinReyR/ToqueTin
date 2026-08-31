import { redirect } from "next/navigation";

import {
  getOperatorClaims,
  getVerifiedClaims,
} from "@/application/auth/verified-claims";
import { LoginForm } from "@/app/(auth)/login/login-form";

export default async function LoginPage() {
  if (getOperatorClaims(await getVerifiedClaims())) redirect("/operator");

  return (
    <main className="flex min-h-screen items-center justify-center p-5 sm:p-8">
      <section className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-800">
          ToqueTin
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-stone-950">
          Operación del restaurante
        </h1>
        <p className="mt-3 text-base leading-6 text-stone-600">
          Ingresa con las credenciales que te proporcionó tu organización.
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
