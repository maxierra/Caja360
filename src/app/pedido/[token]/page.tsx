import Link from "next/link";
import { notFound } from "next/navigation";
import { Package, Truck } from "lucide-react";

import { getOrderByTrackingToken } from "@/app/pedido/actions";

const STATUS: Record<string, { label: string; desc: string }> = {
  pending_shipment: {
    label: "En preparación",
    desc: "Estamos armando tu pedido de hardware. Ya tenés acceso al software.",
  },
  shipped: {
    label: "Despachado",
    desc: "Tu pedido salió de nuestro depósito.",
  },
  delivered: {
    label: "Entregado",
    desc: "Pedido marcado como entregado.",
  },
  not_applicable: {
    label: "Sin envío",
    desc: "Este pedido no incluye hardware.",
  },
};

type Props = {
  params: Promise<{ token: string }>;
};

export default async function PedidoTrackingPage({ params }: Props) {
  const { token } = await params;
  const order = await getOrderByTrackingToken(token);
  if (!order || !order.paid) notFound();

  const st = STATUS[order.fulfillmentStatus] ?? { label: order.fulfillmentStatus, desc: "" };

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
              <h1 className="text-xl font-bold text-slate-900">Seguimiento de pedido</h1>
              <p className="text-sm text-slate-600">{order.productName}</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-sky-50 p-4">
            <div className="text-sm font-semibold text-sky-900">{st.label}</div>
            <p className="mt-1 text-sm text-slate-600">{st.desc}</p>
          </div>

          <dl className="mt-6 space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Cliente</dt>
              <dd className="font-medium">{order.customerName}</dd>
            </div>
            {order.trackingNumber ? (
              <>
                <div>
                  <dt className="text-muted-foreground">Nº de seguimiento</dt>
                  <dd className="font-mono font-medium">{order.trackingNumber}</dd>
                </div>
                {order.trackingCarrier ? (
                  <div>
                    <dt className="text-muted-foreground">Transportista</dt>
                    <dd>{order.trackingCarrier}</dd>
                  </div>
                ) : null}
                {order.shippedAt ? (
                  <div>
                    <dt className="text-muted-foreground">Fecha de despacho</dt>
                    <dd>{new Date(order.shippedAt).toLocaleDateString("es-AR")}</dd>
                  </div>
                ) : null}
              </>
            ) : null}
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
