"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodayDeliveryOrderRow } from "@/app/app/(main)/pos/actions";

const AR_TIME_ZONE = "America/Argentina/Buenos_Aires";

type StatusBadge = {
  label: string;
  className: string;
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: AR_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatARS(n: number): string {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function resolveStatusBadge(status: string): StatusBadge {
  if (status === "delivery_closed") {
    return { label: "Cobrado", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  }
  if (status === "delivery_new") {
    return { label: "Nuevo", className: "bg-sky-100 text-sky-700 border-sky-200" };
  }
  if (status === "delivery_preparing") {
    return { label: "En cocina", className: "bg-amber-100 text-amber-700 border-amber-200" };
  }
  if (status === "delivery_ready" || status === "delivery_on_the_way") {
    return { label: "En camino", className: "bg-violet-100 text-violet-700 border-violet-200" };
  }
  return { label: status, className: "bg-slate-100 text-slate-700 border-slate-200" };
}

function orderTime(order: TodayDeliveryOrderRow): string {
  return formatTime(order.closed_at ?? order.updated_at ?? order.created_at);
}

export type DeliveryHistoryTableProps = {
  orders: TodayDeliveryOrderRow[];
  loading?: boolean;
  onRefresh?: () => void;
};

export function DeliveryHistoryTable({ orders, loading = false, onRefresh }: DeliveryHistoryTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700">
          Pedidos delivery de hoy
          {!loading && orders.length > 0 ? (
            <span className="ml-1.5 font-normal text-muted-foreground">({orders.length})</span>
          ) : null}
        </p>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Actualizar
          </button>
        ) : null}
      </div>

      {loading && orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-muted-foreground">
          Cargando historial…
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-sm font-semibold text-slate-500">No hay pedidos delivery hoy</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Los pedidos cobrados y activos del día aparecerán acá.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Dirección</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => {
                const items = order.service_order_items ?? [];
                const itemCount = items.reduce((sum, i) => sum + Number(i.quantity), 0);
                const total = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);
                const badge = resolveStatusBadge(order.status);

                return (
                  <tr key={order.id} className="transition hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                      {orderTime(order)}
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 font-semibold text-slate-900">
                      {order.customer_name || "Sin nombre"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {order.customer_phone || "—"}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-slate-500">
                      {order.delivery_address || "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{itemCount}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-900">
                      {formatARS(total)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                          badge.className
                        )}
                      >
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
