"use client";

import * as React from "react";
import { Plus, ChevronRight, CreditCard, Bike, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PosBusinessInfo } from "@/lib/ticket-utils";
import {
  formatDeliveryTicketPlainText,
  formatKitchenTicketPlainText,
  printPlainTextTicketInBrowser,
  type DeliveryTicketOrder,
} from "@/lib/delivery-ticket-utils";
import { isAndroidUserAgent, printTicket as printTicketRawBt } from "@/utils/printTicket";

type ServiceOrderItem = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
};

export type DeliveryOrder = {
  id: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  notes: string | null;
  created_at?: string | null;
  service_order_items: ServiceOrderItem[] | null;
};

type DeliveryColStatus = "delivery_new" | "delivery_preparing" | "delivery_on_the_way" | "cobrado";

type ColumnConfig = {
  status: DeliveryColStatus;
  label: string;
  colHeader: string;
  cardBorder: string;
  dotBg: string;
  advanceBg: string;
  advanceText: string;
  advanceBorder: string;
  advanceHover: string;
  advanceLabel: string | null;
};

const COLUMNS: ColumnConfig[] = [
  {
    status: "delivery_new",
    label: "Nuevo",
    colHeader: "bg-sky-100 text-sky-700 border-sky-200",
    cardBorder: "border-sky-400",
    dotBg: "bg-sky-500",
    advanceBg: "bg-sky-500",
    advanceText: "text-white",
    advanceBorder: "border-sky-600",
    advanceHover: "hover:bg-sky-600",
    advanceLabel: "→ En cocina",
  },
  {
    status: "delivery_preparing",
    label: "En cocina",
    colHeader: "bg-amber-100 text-amber-700 border-amber-200",
    cardBorder: "border-amber-400",
    dotBg: "bg-amber-500",
    advanceBg: "bg-amber-500",
    advanceText: "text-white",
    advanceBorder: "border-amber-600",
    advanceHover: "hover:bg-amber-600",
    advanceLabel: "→ En camino",
  },
  {
    status: "delivery_on_the_way",
    label: "En camino",
    colHeader: "bg-violet-100 text-violet-700 border-violet-200",
    cardBorder: "border-violet-400",
    dotBg: "bg-violet-500",
    advanceBg: "bg-violet-500",
    advanceText: "text-white",
    advanceBorder: "border-violet-600",
    advanceHover: "hover:bg-violet-600",
    advanceLabel: null,
  },
  {
    status: "cobrado",
    label: "Cobrado",
    colHeader: "bg-emerald-100 text-emerald-700 border-emerald-200",
    cardBorder: "border-emerald-400",
    dotBg: "bg-emerald-500",
    advanceBg: "bg-emerald-500",
    advanceText: "text-white",
    advanceBorder: "border-emerald-600",
    advanceHover: "hover:bg-emerald-600",
    advanceLabel: null,
  },
];

const NEXT_STATUS: Partial<Record<DeliveryColStatus, "delivery_preparing" | "delivery_on_the_way">> = {
  delivery_new: "delivery_preparing",
  delivery_preparing: "delivery_on_the_way",
};

function formatARS(n: number): string {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Maps raw DB status values to a display column. */
function resolveColStatus(rawStatus: string): DeliveryColStatus {
  if (rawStatus === "delivery_new") return "delivery_new";
  if (rawStatus === "delivery_preparing") return "delivery_preparing";
  if (rawStatus === "delivery_ready" || rawStatus === "delivery_on_the_way") return "delivery_on_the_way";
  return "delivery_new";
}

export type DeliveryKanbanProps = {
  business: PosBusinessInfo;
  orders: DeliveryOrder[];
  onNewOrder: () => void;
  onEditOrder: (orderId: string) => void;
  onAdvanceStatus: (orderId: string, nextStatus: string) => void;
  onPayOrder: (orderId: string) => void;
};

function printTicketText(plainText: string) {
  if (isAndroidUserAgent()) {
    printTicketRawBt(plainText);
  } else {
    printPlainTextTicketInBrowser(plainText);
  }
}

function toTicketOrder(order: DeliveryOrder): DeliveryTicketOrder {
  return {
    id: order.id,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    delivery_address: order.delivery_address,
    notes: order.notes,
    created_at: order.created_at,
    service_order_items: order.service_order_items,
  };
}

export function DeliveryKanban({
  business,
  orders,
  onNewOrder,
  onEditOrder,
  onAdvanceStatus,
  onPayOrder,
}: DeliveryKanbanProps) {
  const grouped = React.useMemo(() => {
    const map = new Map<DeliveryColStatus, DeliveryOrder[]>();
    for (const col of COLUMNS) map.set(col.status, []);
    for (const order of orders) {
      const colStatus = resolveColStatus(order.status);
      map.get(colStatus)?.push(order);
    }
    return map;
  }, [orders]);

  if (orders.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onNewOrder}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 active:bg-emerald-800"
          >
            <Plus className="size-4" />
            Nuevo pedido
          </button>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50 px-6 py-20 text-center">
          <Bike className="size-12 text-sky-400" />
          <div>
            <p className="text-base font-bold text-sky-800">Sin pedidos activos</p>
            <p className="mt-1 text-sm text-sky-600">
              Presioná <span className="font-semibold">Nuevo pedido</span> para tomar el primero.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {COLUMNS.slice(0, 3).map((col) => {
            const count = grouped.get(col.status)?.length ?? 0;
            if (count === 0) return null;
            return (
              <span
                key={col.status}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                  col.colHeader
                )}
              >
                <span className={cn("size-2 shrink-0 rounded-full", col.dotBg)} />
                {count} {col.label}
              </span>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onNewOrder}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 active:bg-emerald-800"
        >
          <Plus className="size-4" />
          Nuevo pedido
        </button>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colOrders = grouped.get(col.status) ?? [];
          const isOnTheWay = col.status === "delivery_on_the_way";
          const showPrintActions =
            col.status === "delivery_preparing" || col.status === "delivery_on_the_way";

          return (
            <div key={col.status} className="flex min-w-[240px] shrink-0 flex-col gap-3">
              {/* Column header */}
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold",
                  col.colHeader
                )}
              >
                <span className={cn("size-2.5 shrink-0 rounded-full", col.dotBg)} />
                {col.label}
                <span className="ml-auto opacity-60">({colOrders.length})</span>
              </div>

              {/* Cards */}
              {colOrders.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center text-xs text-slate-400">
                  Vacío
                </div>
              ) : (
                colOrders.map((order) => {
                  const items = order.service_order_items ?? [];
                  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
                  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
                  const nextStatus = NEXT_STATUS[col.status] ?? null;

                  return (
                    <div
                      key={order.id}
                      className={cn(
                        "overflow-hidden rounded-xl border-l-4 bg-white shadow-sm",
                        col.cardBorder
                      )}
                    >
                      {/* Card body — click to edit */}
                      <button
                        type="button"
                        onClick={() => onEditOrder(order.id)}
                        className="w-full px-4 py-4 text-left transition hover:bg-slate-50 active:bg-slate-100"
                      >
                        <p className="truncate text-base font-bold text-slate-900">
                          {order.customer_name || "Sin nombre"}
                        </p>
                        {order.customer_phone ? (
                          <p className="mt-0.5 text-xs text-slate-400">{order.customer_phone}</p>
                        ) : null}
                        {order.delivery_address ? (
                          <p className="mt-0.5 truncate text-xs text-slate-400">
                            {order.delivery_address}
                          </p>
                        ) : null}
                        {itemCount > 0 ? (
                          <div className="mt-2.5 flex items-center gap-2 text-sm text-slate-600">
                            <span>
                              {itemCount} ítem{itemCount !== 1 ? "s" : ""}
                            </span>
                            <span className="font-bold text-slate-800">{formatARS(total)}</span>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-slate-400">Sin ítems cargados</p>
                        )}
                      </button>

                      {showPrintActions ? (
                        <div className="flex border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              const text = formatKitchenTicketPlainText({
                                business,
                                order: toTicketOrder(order),
                              });
                              printTicketText(text);
                            }}
                            className="flex flex-1 items-center justify-center gap-1 border-r border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
                          >
                            <Printer className="size-3.5" />
                            Cocina
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const text = formatDeliveryTicketPlainText({
                                business,
                                order: toTicketOrder(order),
                                paymentStatus: "Pendiente de cobro",
                              });
                              printTicketText(text);
                            }}
                            className="flex flex-1 items-center justify-center gap-1 bg-white px-2 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
                          >
                            <Printer className="size-3.5" />
                            Envío
                          </button>
                        </div>
                      ) : null}

                      {/* Advance status button */}
                      {nextStatus ? (
                        <button
                          type="button"
                          onClick={() => onAdvanceStatus(order.id, nextStatus)}
                          className={cn(
                            "flex w-full items-center justify-center gap-1.5 border-t px-3 py-2.5 text-sm font-semibold transition",
                            col.advanceBg,
                            col.advanceHover,
                            col.advanceBorder,
                            col.advanceText
                          )}
                        >
                          <ChevronRight className="size-4" />
                          {col.advanceLabel}
                        </button>
                      ) : null}

                      {/* Cobrar — only for "En camino" */}
                      {isOnTheWay ? (
                        <button
                          type="button"
                          onClick={() => onPayOrder(order.id)}
                          className="flex w-full items-center justify-center gap-1.5 border-t border-emerald-200 bg-emerald-500 px-3 py-3 text-sm font-bold text-white transition hover:bg-emerald-600 active:bg-emerald-700"
                        >
                          <CreditCard className="size-4" />
                          Cobrar
                        </button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
