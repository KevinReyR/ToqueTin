import { redirect } from "next/navigation";

import { getActiveRestaurantContext } from "@/application/restaurants/active-restaurant";
import { OrderForm } from "@/app/(operator)/operator/orders/new/order-form";

export default async function NewOrderPage() {
  const { activeRestaurant } = await getActiveRestaurantContext();
  if (!activeRestaurant) redirect("/operator");

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
        <p className="text-sm font-semibold text-amber-800">
          {activeRestaurant.name}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">
          Nuevo pedido
        </h1>
        <p className="mt-3 text-stone-600">
          Registra lo necesario para iniciar el seguimiento.
        </p>
        <div className="mt-8">
          <OrderForm />
        </div>
      </section>
    </main>
  );
}
