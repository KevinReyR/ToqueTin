import Link from "next/link";

import { getDashboardSummary } from "@/application/dashboard/dashboard";
import { getActiveRestaurantContext } from "@/application/restaurants/active-restaurant";
import { CutoffForm } from "@/app/(operator)/operator/cutoff-form";
import { DashboardRealtime } from "@/app/(operator)/operator/dashboard-realtime";
import type { OrderStatus } from "@/domain/orders/types";

const STATUS_LABELS: Record<OrderStatus, string> = {
  RECEIVED: "Recibidos",
  PREPARING: "En preparación",
  READY: "Listos para retirar",
  DELIVERED: "Entregados",
  CANCELLED: "Cancelados",
};
const STATUS_ORDER: OrderStatus[] = [
  "READY",
  "PREPARING",
  "RECEIVED",
  "DELIVERED",
  "CANCELLED",
];

function formatDuration(seconds: number | null) {
  if (seconds === null) return "Aún no hay datos";
  const minutes = Math.round(seconds / 60);
  return minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function dateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export default async function OperatorPage() {
  const { activeRestaurant } = await getActiveRestaurantContext();
  if (!activeRestaurant) {
    return (
      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <section className="max-w-xl rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-stone-950">
            Aún no tienes un restaurante asignado
          </h1>
          <p className="mt-3 leading-6 text-stone-600">
            Pide a la persona administradora de tu organización que te asigne
            acceso a un restaurante.
          </p>
        </section>
      </main>
    );
  }

  const result = await getDashboardSummary();
  if (!result.ok) {
    return (
      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"
        >
          No fue posible cargar la operación de este restaurante.
        </p>
      </main>
    );
  }
  const dashboard = result.data;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <DashboardRealtime restaurantId={activeRestaurant.id} />
      <header className="flex flex-col gap-5 border-b border-stone-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-800">
            Operación actual
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-950">
            {activeRestaurant.name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            {dateTime(
              dashboard.operationalDay.startedAt,
              activeRestaurant.timezone,
            )}{" "}
            -{" "}
            {dateTime(
              dashboard.operationalDay.endedAt,
              activeRestaurant.timezone,
            )}
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-amber-700 px-4 text-sm font-semibold text-white transition hover:bg-amber-800 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
          href="/operator/orders/new"
        >
          Crear pedido
        </Link>
      </header>

      <section
        aria-label="Resumen de la jornada"
        className="grid grid-cols-2 gap-3 py-6 lg:grid-cols-4"
      >
        <div className="rounded-xl bg-stone-900 p-5 text-stone-50">
          <p className="text-sm text-stone-300">Pedidos creados</p>
          <p className="mt-2 text-3xl font-bold">{dashboard.totalCreated}</p>
        </div>
        <div className="rounded-xl bg-amber-100 p-5 text-amber-950">
          <p className="text-sm text-amber-900">Pedidos activos</p>
          <p className="mt-2 text-3xl font-bold">{dashboard.totalActive}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-600">Preparación promedio</p>
          <p className="mt-2 text-xl font-bold text-stone-950">
            {formatDuration(dashboard.averagePreparationSeconds)}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-600">Recogida promedio</p>
          <p className="mt-2 text-xl font-bold text-stone-950">
            {formatDuration(dashboard.averagePickupSeconds)}
          </p>
        </div>
      </section>

      {dashboard.orders.length === 0 ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <h2 className="text-xl font-bold text-stone-950">
            La jornada todavía está vacía
          </h2>
          <p className="mx-auto mt-2 max-w-md leading-6 text-stone-600">
            Crea el primer pedido para empezar a seguir la operación de hoy.
          </p>
          <Link
            className="mt-5 inline-flex min-h-11 items-center font-semibold text-amber-800 underline-offset-4 hover:underline"
            href="/operator/orders/new"
          >
            Crear el primer pedido
          </Link>
        </section>
      ) : (
        <section aria-labelledby="orders-heading">
          <h2 id="orders-heading" className="text-xl font-bold text-stone-950">
            Pedidos por estado
          </h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {STATUS_ORDER.map((status) => {
              const orders = dashboard.orders.filter(
                (order) => order.status === status,
              );
              if (orders.length === 0) return null;
              return (
                <section
                  key={status}
                  className="rounded-xl border border-stone-200 bg-white p-5"
                >
                  <h3 className="flex items-baseline justify-between gap-3 font-semibold text-stone-950">
                    {STATUS_LABELS[status]}
                    <span className="text-sm font-medium text-stone-500">
                      {orders.length}
                    </span>
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {orders.map((order) => (
                      <li key={order.id}>
                        <Link
                          className="flex min-h-11 items-center justify-between rounded-lg bg-stone-50 px-3 py-2 font-medium text-stone-900 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                          href={`/operator/orders/${order.id}`}
                        >
                          <span>Pedido {order.orderNumber}</span>
                          <span className="text-sm text-stone-500">
                            {new Intl.DateTimeFormat("es-CO", {
                              hour: "numeric",
                              minute: "2-digit",
                              timeZone: activeRestaurant.timezone,
                            }).format(new Date(order.createdAt))}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </section>
      )}

      <section
        className="mt-8 border-t border-stone-200 pt-6"
        aria-labelledby="cutoff-heading"
      >
        <h2 id="cutoff-heading" className="text-xl font-bold text-stone-950">
          Hora de corte
        </h2>
        <p className="mt-2 max-w-2xl leading-6 text-stone-600">
          El corte vigente es {activeRestaurant.dayCutoffTime.slice(0, 5)}. Un
          cambio se aplica desde la próxima jornada y no reagrupa pedidos
          actuales.
        </p>
        {activeRestaurant.pendingDayCutoffTime &&
        activeRestaurant.pendingCutoffEffectiveAt ? (
          <p className="mt-2 text-sm font-medium text-amber-900">
            Próximo corte: {activeRestaurant.pendingDayCutoffTime.slice(0, 5)},
            vigente desde{" "}
            {dateTime(
              activeRestaurant.pendingCutoffEffectiveAt,
              activeRestaurant.timezone,
            )}
            .
          </p>
        ) : null}
        <CutoffForm currentCutoff={activeRestaurant.dayCutoffTime} />
      </section>
    </main>
  );
}
