import Link from "next/link";
import { notFound } from "next/navigation";
import { Package, Truck } from "lucide-react";

import { getOrderByTrackingToken } from "@/app/pedido/actions";
import { CorreoArgentinoTrackingLinks } from "@/components/store/correo-argentino-tracking-links";
import { OrderFulfillmentSteps } from "@/components/store/order-fulfillment-steps";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function PedidoTrackingPage({ params }: Props) {
  const { token } = await params;
  const order = await getOrderByTrackingToken(token);
  if (!order || !order.paid) notFound();

  const isHardware = order.fulfillmentStatus !== "not_applicable";
  const showCorreoLink =
    Boolean(order.trackingNumber) &&
    (!order.trackingCarrier || /correo/i.test(order.trackingCarrier));

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/90 via-zinc-50 to-emerald-50/70">
      <header className="border-b border-sky-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg px-4 py-4">
          <Link href="/" className="text-sm font-semibold text-slate-900">
            ← Inicio
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            {order.fulfillmentStatus === "shipped" || order.fulfillmentStatus === "delivered" ? (
              <Truck className="size-8 text-sky-700" />
            ) : (
              <Package className="size-8 text-amber-600" />
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-900">Estado de tu pedido</h1>
              <p className="text-sm text-slate-600">{order.productName}</p>
            </div>
          </div>

          {isHardware ? (
            <>
              {order.fulfillmentStatus === "pending_shipment" ? (
                <div className="mt-6 rounded-xl border border-amber-200/80 bg-amber-50/90 p-4">
                  <p className="text-sm font-medium text-amber-950">
                    Estamos preparando tu envío
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
                    Tu combo está en preparación en nuestro depósito. Todavía no tiene número de Correo
                    Argentino: te lo mandamos por mail en cuanto lo despachemos.
                  </p>
                </div>
              ) : null}

              <OrderFulfillmentSteps fulfillmentStatus={order.fulfillmentStatus} />
            </>
          ) : (
            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              Este pedido es solo software; no incluye envío físico.
            </div>
          )}

          {order.trackingNumber ? (
            <div className="mt-6 rounded-xl border border-sky-200 bg-sky-50/80 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                Seguimiento Correo Argentino
              </div>
              <div className="mt-2 font-mono text-lg font-semibold tracking-wide text-slate-900">
                {order.trackingNumber}
              </div>
              {order.trackingCarrier ? (
                <p className="mt-1 text-sm text-slate-600">{order.trackingCarrier}</p>
              ) : null}
              {order.shippedAt ? (
                <p className="mt-1 text-xs text-slate-500">
                  Despachado el {new Date(order.shippedAt).toLocaleDateString("es-AR")}
                </p>
              ) : null}
              <CorreoArgentinoTrackingLinks
                trackingNumber={order.trackingNumber}
                show={showCorreoLink}
              />
            </div>
          ) : null}

          <dl className="mt-6 border-t border-slate-100 pt-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Cliente</dt>
              <dd className="font-medium">{order.customerName}</dd>
            </div>
          </dl>

          <p className="mt-8 text-center text-xs text-slate-500">
            El software ya está activo.{" "}
            <Link href="/auth/login" className="font-medium text-sky-800 underline">
              Ingresar al POS
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
