import { Check, Circle, Package, Truck } from "lucide-react";

import { cn } from "@/lib/utils";

type Step = {
  key: string;
  label: string;
  detail: string;
  state: "done" | "current" | "upcoming";
};

function buildSteps(fulfillmentStatus: string): Step[] {
  const shipped = fulfillmentStatus === "shipped" || fulfillmentStatus === "delivered";
  const delivered = fulfillmentStatus === "delivered";
  const preparing = fulfillmentStatus === "pending_shipment";

  return [
    {
      key: "paid",
      label: "Compra confirmada",
      detail: "Pago acreditado y software activo.",
      state: "done",
    },
    {
      key: "preparing",
      label: "Preparando envío",
      detail: preparing
        ? "Estamos armando tu combo y verificando el pedido antes de entregarlo al correo."
        : shipped
          ? "Combo listo y entregado al correo para despacho."
          : "Pendiente.",
      state: preparing ? "current" : shipped ? "done" : "upcoming",
    },
    {
      key: "shipped",
      label: "Despachado",
      detail: shipped
        ? delivered
          ? "El paquete fue entregado al transportista."
          : "En camino con Correo Argentino."
        : "Cuando lo despachemos, acá vas a ver el número de seguimiento.",
      state: delivered ? "done" : fulfillmentStatus === "shipped" ? "current" : "upcoming",
    },
    {
      key: "delivered",
      label: "Entregado",
      detail: delivered ? "Pedido recibido en la dirección indicada." : "Te avisamos cuando llegue.",
      state: delivered ? "done" : "upcoming",
    },
  ];
}

export function OrderFulfillmentSteps({ fulfillmentStatus }: { fulfillmentStatus: string }) {
  const steps = buildSteps(fulfillmentStatus);

  return (
    <ol className="mt-6 space-y-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const Icon =
          step.key === "shipped" ? Truck : step.key === "preparing" ? Package : step.state === "done" ? Check : Circle;

        return (
          <li key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast ? (
              <span
                className={cn(
                  "absolute left-[11px] top-7 h-[calc(100%-12px)] w-0.5",
                  step.state === "done" ? "bg-emerald-400" : "bg-slate-200"
                )}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                step.state === "done" && "border-emerald-500 bg-emerald-500 text-white",
                step.state === "current" && "border-amber-500 bg-amber-50 text-amber-700",
                step.state === "upcoming" && "border-slate-200 bg-white text-slate-300"
              )}
            >
              <Icon className="size-3.5" strokeWidth={step.state === "upcoming" ? 1.5 : 2.5} />
            </span>
            <div className="min-w-0 pt-0.5">
              <div
                className={cn(
                  "text-sm font-semibold",
                  step.state === "current" && "text-amber-900",
                  step.state === "done" && "text-slate-900",
                  step.state === "upcoming" && "text-slate-400"
                )}
              >
                {step.label}
              </div>
              <p
                className={cn(
                  "mt-0.5 text-xs leading-relaxed",
                  step.state === "upcoming" ? "text-slate-400" : "text-slate-600"
                )}
              >
                {step.detail}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
