import Image from "next/image";
import { redirect } from "next/navigation";

import { getActiveOperatorOrder } from "@/application/orders/operator-orders";
import { createTrackingQrDataUrl } from "@/application/tracking/tracking-qr";
import {
  CancelOrderDialog,
  EstimateForm,
  RevokeTrackingDialog,
  TransitionAction,
} from "@/app/(operator)/operator/orders/[orderId]/order-actions";
import { PrintQrButton } from "@/app/(operator)/operator/orders/[orderId]/print-qr-button";

const STATUS_LABELS = {
  RECEIVED: "Recibido",
  PREPARING: "Preparando",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
} as const;

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getActiveOperatorOrder(orderId);
  if (!order) redirect("/operator");
  const qrDataUrl = order.trackingAvailable
    ? await createTrackingQrDataUrl({
        nonce: order.trackingSession.publicNonce,
        version: order.trackingSession.tokenVersion,
      })
    : null;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
          <p className="text-sm font-semibold text-amber-800">
            Pedido {order.orderNumber}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">
            {STATUS_LABELS[order.status]}
          </h1>
          <dl className="mt-7 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-stone-600">Estimación vigente</dt>
              <dd className="mt-1 font-semibold text-stone-950">
                {new Intl.DateTimeFormat("es-CO", {
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(order.estimatedReadyAt))}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-stone-600">Última actualización</dt>
              <dd className="mt-1 font-semibold text-stone-950">
                {new Intl.DateTimeFormat("es-CO", {
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(order.updatedAt))}
              </dd>
            </div>
            {order.pickupInstructions ? (
              <div className="sm:col-span-2">
                <dt className="text-sm text-stone-600">
                  Instrucciones de retiro
                </dt>
                <dd className="mt-1 text-stone-950">
                  {order.pickupInstructions}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="no-print mt-8 flex flex-wrap gap-3">
            <TransitionAction order={order} />
            <CancelOrderDialog order={order} />
          </div>
          <EstimateForm order={order} />
        </section>
        <aside className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
          <h2 className="text-lg font-bold text-stone-950">
            Código de seguimiento
          </h2>
          {qrDataUrl ? (
            <>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                El cliente puede escanearlo para seguir este pedido.
              </p>
              <Image
                alt={`Código QR del pedido ${order.orderNumber}`}
                className="mx-auto mt-5 aspect-square w-full max-w-72"
                height={384}
                src={qrDataUrl}
                unoptimized
                width={384}
              />
              <div className="no-print mt-5 flex flex-col gap-3">
                <PrintQrButton />
                <RevokeTrackingDialog orderId={order.id} />
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-5 text-left">
              <p className="font-semibold text-stone-950">
                Seguimiento no disponible
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                {order.trackingSession.revokedAt
                  ? "Este acceso fue desactivado y ya no muestra datos al cliente."
                  : "El acceso finalizó después de su periodo de consulta."}
              </p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
