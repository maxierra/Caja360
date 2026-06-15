"use client";

import * as React from "react";
import { ChevronRight, Columns3, CreditCard, LayoutGrid, Plus, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { SalonTableVisual } from "./TableIcon";

export type TableStatus = "libre" | "ocupada" | "en_preparacion" | "servida";

type StatusConfig = {
  label: string;
  cardBg: string;
  cardHover: string;
  cardBorder: string;
  cardText: string;
  dotBg: string;
  colHeader: string;
  advanceBg: string;
  advanceHover: string;
  advanceText: string;
  advanceBorder: string;
};

const STATUS_CONFIG: Record<TableStatus, StatusConfig> = {
  libre: {
    label: "Libre",
    cardBg: "bg-emerald-500",
    cardHover: "hover:bg-emerald-600",
    cardBorder: "border-emerald-600",
    cardText: "text-white",
    dotBg: "bg-emerald-500",
    colHeader: "bg-emerald-50 text-emerald-800 border-emerald-200",
    advanceBg: "bg-emerald-500",
    advanceHover: "hover:bg-emerald-600",
    advanceText: "text-white",
    advanceBorder: "border-emerald-600",
  },
  ocupada: {
    label: "Ocupada",
    cardBg: "bg-amber-500",
    cardHover: "hover:bg-amber-600",
    cardBorder: "border-amber-600",
    cardText: "text-white",
    dotBg: "bg-amber-500",
    colHeader: "bg-amber-50 text-amber-800 border-amber-200",
    advanceBg: "bg-amber-500",
    advanceHover: "hover:bg-amber-600",
    advanceText: "text-white",
    advanceBorder: "border-amber-600",
  },
  en_preparacion: {
    label: "En preparación",
    cardBg: "bg-blue-500",
    cardHover: "hover:bg-blue-600",
    cardBorder: "border-blue-600",
    cardText: "text-white",
    dotBg: "bg-blue-500",
    colHeader: "bg-blue-50 text-blue-800 border-blue-200",
    advanceBg: "bg-blue-500",
    advanceHover: "hover:bg-blue-600",
    advanceText: "text-white",
    advanceBorder: "border-blue-600",
  },
  servida: {
    label: "Servida",
    cardBg: "bg-violet-500",
    cardHover: "hover:bg-violet-600",
    cardBorder: "border-violet-600",
    cardText: "text-white",
    dotBg: "bg-violet-500",
    colHeader: "bg-violet-50 text-violet-800 border-violet-200",
    advanceBg: "bg-violet-500",
    advanceHover: "hover:bg-violet-600",
    advanceText: "text-white",
    advanceBorder: "border-violet-600",
  },
};

type ServiceOrderItem = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
};

type ServiceOrder = {
  id: string;
  status: string;
  service_order_items?: ServiceOrderItem[] | null;
};

type GastronomyTable = {
  id: string;
  name: string;
  active: boolean;
};

export type Props = {
  tables: GastronomyTable[];
  tableOrdersByTableId: Map<string, ServiceOrder>;
  onSelectTable: (tableId: string) => void;
  onAdvanceStatus?: (tableId: string, orderId: string, nextStatus: "occupied" | "preparing" | "served") => void;
  onPayTable?: (tableId: string) => void;
  onEditTableOrder?: (tableId: string) => void;
};

type ViewMode = "grid" | "kanban";

function resolveTableStatus(order: ServiceOrder | undefined): TableStatus {
  if (!order) return "libre";
  if (order.status === "served") return "servida";
  if (order.status === "preparing") return "en_preparacion";
  return "ocupada";
}

function getNextStatus(status: TableStatus): { label: string; value: "occupied" | "preparing" | "served" } | null {
  if (status === "ocupada") return { label: "En prep.", value: "preparing" };
  if (status === "en_preparacion") return { label: "Servida", value: "served" };
  return null;
}

function formatARS(n: number): string {
  return `$${n
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

const MAX_VISIBLE_ORDER_ITEMS = 3;
const MAX_ITEM_NAME_LENGTH = 28;

function formatItemQuantity(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(1).replace(".", ",");
}

function truncateItemName(name: string, maxLen = MAX_ITEM_NAME_LENGTH): string {
  if (name.length <= maxLen) return name;
  return `${name.slice(0, maxLen - 1)}…`;
}

function OrderItemList({
  items,
  itemClassName = "text-xs text-slate-600",
  moreClassName = "text-xs text-slate-500",
}: {
  items: ServiceOrderItem[];
  itemClassName?: string;
  moreClassName?: string;
}) {
  const visible = items.slice(0, MAX_VISIBLE_ORDER_ITEMS);
  const remaining = items.length - visible.length;

  return (
    <ul className="mt-2 space-y-0.5">
      {visible.map((item, idx) => (
        <li key={`${item.product_id}-${idx}`} className={cn("truncate", itemClassName)}>
          • {truncateItemName(item.name)} x{formatItemQuantity(item.quantity)}
        </li>
      ))}
      {remaining > 0 ? <li className={moreClassName}>+ {remaining} más</li> : null}
    </ul>
  );
}

function OrderTotalSummary({
  itemCount,
  total,
  className,
  totalClassName,
}: {
  itemCount: number;
  total: number;
  className?: string;
  totalClassName?: string;
}) {
  return (
    <p className={cn("mt-1.5 text-sm text-slate-600", className)}>
      <span>
        {itemCount} ítem{itemCount !== 1 ? "s" : ""}
      </span>
      <span className="mx-1.5 opacity-60">·</span>
      <span className={cn("font-bold text-slate-800", totalClassName)}>{formatARS(total)}</span>
    </p>
  );
}

export function SalonView({ tables, tableOrdersByTableId, onSelectTable, onAdvanceStatus, onPayTable, onEditTableOrder }: Props) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("kanban");

  if (tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 px-6 py-20 text-center">
        <UtensilsCrossed className="size-12 text-amber-400" />
        <div>
          <p className="text-base font-bold text-amber-800">Sin mesas configuradas</p>
          <p className="mt-1 text-sm text-amber-600">
            Agregá las mesas del local en{" "}
            <a href="/app/settings" className="underline hover:text-amber-800">
              Configuración → Mesas
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  const statusCounts: Record<TableStatus, number> = { libre: 0, ocupada: 0, en_preparacion: 0, servida: 0 };
  for (const table of tables) {
    statusCounts[resolveTableStatus(tableOrdersByTableId.get(table.id))]++;
  }

  return (
    <div className="space-y-4">
      {/* Header bar: status summary + view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["libre", "ocupada", "en_preparacion", "servida"] as TableStatus[]).map((s) => {
            const cfg = STATUS_CONFIG[s];
            if (statusCounts[s] === 0) return null;
            return (
              <span
                key={s}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                  cfg.colHeader
                )}
              >
                <span className={cn("size-2 shrink-0 rounded-full", cfg.dotBg)} />
                {statusCounts[s]} {cfg.label}
              </span>
            );
          })}
        </div>

        {/* Grid / Kanban toggle */}
        <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              viewMode === "grid"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <LayoutGrid className="size-3.5" />
            Cuadrícula
          </button>
          <button
            type="button"
            onClick={() => setViewMode("kanban")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              viewMode === "kanban"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Columns3 className="size-3.5" />
            Kanban
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <GridView
          tables={tables}
          tableOrdersByTableId={tableOrdersByTableId}
          onSelectTable={onSelectTable}
          onPayTable={onPayTable}
          onEditTableOrder={onEditTableOrder}
        />
      ) : (
        <KanbanView
          tables={tables}
          tableOrdersByTableId={tableOrdersByTableId}
          onSelectTable={onSelectTable}
          onAdvanceStatus={onAdvanceStatus}
          onPayTable={onPayTable}
          onEditTableOrder={onEditTableOrder}
        />
      )}
    </div>
  );
}

function ServedTableActions({
  tableId,
  onEditTableOrder,
  onPayTable,
  layout = "stacked",
  className,
}: {
  tableId: string;
  onEditTableOrder?: (tableId: string) => void;
  onPayTable?: (tableId: string) => void;
  layout?: "stacked" | "row";
  className?: string;
}) {
  if (!onEditTableOrder && !onPayTable) return null;

  return (
    <div
      className={cn(
        "overflow-hidden border-t border-violet-200",
        layout === "row" ? "grid grid-cols-2 rounded-b-2xl" : "flex flex-col",
        className
      )}
    >
      {onEditTableOrder ? (
        <button
          type="button"
          onClick={() => onEditTableOrder(tableId)}
          className={cn(
            "flex items-center justify-center gap-1.5 bg-white px-2 py-2.5 text-xs font-bold text-violet-700 transition hover:bg-violet-50 active:bg-violet-100",
            layout === "row" ? "border-r border-violet-200" : "border-b border-violet-200"
          )}
        >
          <Plus className="size-3.5 shrink-0" />
          <span className="truncate">Agregar algo más</span>
        </button>
      ) : null}
      {onPayTable ? (
        <button
          type="button"
          onClick={() => onPayTable(tableId)}
          className="flex items-center justify-center gap-1.5 bg-emerald-500 px-2 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-600 active:bg-emerald-700"
        >
          <CreditCard className="size-3.5 shrink-0" />
          Cobrar
        </button>
      ) : null}
    </div>
  );
}

function GridView({
  tables,
  tableOrdersByTableId,
  onSelectTable,
  onPayTable,
  onEditTableOrder,
}: {
  tables: GastronomyTable[];
  tableOrdersByTableId: Map<string, ServiceOrder>;
  onSelectTable: (id: string) => void;
  onPayTable?: (tableId: string) => void;
  onEditTableOrder?: (tableId: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {tables.map((table) => {
        const order = tableOrdersByTableId.get(table.id);
        const status = resolveTableStatus(order);
        const cfg = STATUS_CONFIG[status];
        const items = order?.service_order_items ?? [];
        const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
        const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
        const isServed = status === "servida";

        return (
          <div key={table.id} className="flex flex-col overflow-hidden rounded-2xl">
            <button
              type="button"
              onClick={() => onSelectTable(table.id)}
              aria-label={`Mesa ${table.name}, ${cfg.label}`}
              className={cn(
                "group flex min-h-[130px] flex-col items-center justify-center rounded-t-2xl border-2 bg-white px-4 py-4 text-center transition-all duration-150",
                "hover:scale-[1.02] hover:shadow-lg active:scale-[0.97]",
                isServed ? "rounded-b-none border-b-0" : "rounded-2xl",
                cfg.cardBorder
              )}
            >
              <SalonTableVisual
                tableName={table.name}
                status={status}
                size="lg"
                itemCount={itemCount > 0 ? itemCount : undefined}
              />
              <span
                className={cn(
                  "mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                  cfg.colHeader
                )}
              >
                <span className={cn("size-1.5 shrink-0 rounded-full", cfg.dotBg)} />
                {cfg.label}
              </span>
              {status !== "libre" && itemCount > 0 ? (
                <div className="mt-2 flex w-full max-w-full flex-col items-stretch px-1 text-left">
                  <OrderItemList items={items} />
                  <OrderTotalSummary itemCount={itemCount} total={total} />
                </div>
              ) : status !== "libre" ? (
                <span className="mt-2 text-xs text-slate-400">Sin ítems cargados</span>
              ) : null}
            </button>

            {/* Acciones — solo mesas servidas */}
            {isServed && (onEditTableOrder || onPayTable) ? (
              <ServedTableActions
                tableId={table.id}
                onEditTableOrder={onEditTableOrder}
                onPayTable={onPayTable}
                layout="row"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function KanbanView({
  tables,
  tableOrdersByTableId,
  onSelectTable,
  onAdvanceStatus,
  onPayTable,
  onEditTableOrder,
}: Props) {
  const columns: TableStatus[] = ["libre", "ocupada", "en_preparacion", "servida"];
  const grouped = new Map<TableStatus, GastronomyTable[]>();
  for (const s of columns) grouped.set(s, []);
  for (const table of tables) {
    const order = tableOrdersByTableId.get(table.id);
    const status = resolveTableStatus(order);
    grouped.get(status)!.push(table);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((status) => {
        const cfg = STATUS_CONFIG[status];
        const tablesInCol = grouped.get(status) ?? [];

        return (
          <div key={status} className="flex min-w-[220px] shrink-0 flex-col gap-3">
            {/* Column header */}
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold",
                cfg.colHeader
              )}
            >
              <span className={cn("size-2.5 shrink-0 rounded-full", cfg.dotBg)} />
              {cfg.label}
              <span className="ml-auto opacity-60">({tablesInCol.length})</span>
            </div>

            {/* Cards */}
            {tablesInCol.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center text-xs text-slate-400">
                Vacío
              </div>
            ) : (
              tablesInCol.map((table) => {
                const order = tableOrdersByTableId.get(table.id);
                const items = order?.service_order_items ?? [];
                const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
                const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
                const nextStatus = getNextStatus(status);

                return (
                  <div
                    key={table.id}
                    className={cn(
                      "overflow-hidden rounded-xl border-l-4 bg-white shadow-sm",
                      cfg.cardBorder
                    )}
                  >
                    {/* Clickable card body → opens order modal */}
                    <button
                      type="button"
                      onClick={() => onSelectTable(table.id)}
                      aria-label={`Mesa ${table.name}, ${cfg.label}`}
                      className="group w-full px-4 py-4 text-left transition hover:bg-slate-50 active:bg-slate-100"
                    >
                      <div className="flex flex-col items-center">
                        <SalonTableVisual
                          tableName={table.name}
                          status={status}
                          size="md"
                          itemCount={itemCount > 0 ? itemCount : undefined}
                        />
                        <span
                          className={cn(
                            "mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                            cfg.colHeader
                          )}
                        >
                          <span className={cn("size-1.5 shrink-0 rounded-full", cfg.dotBg)} />
                          {cfg.label}
                        </span>
                      </div>
                      {itemCount > 0 ? (
                        <>
                          <OrderItemList items={items} />
                          <OrderTotalSummary itemCount={itemCount} total={total} />
                        </>
                      ) : status !== "libre" ? (
                        <p className="mt-2 text-xs text-slate-400">Sin ítems cargados</p>
                      ) : null}
                    </button>

                    {/* Quick advance status button */}
                    {nextStatus && order && onAdvanceStatus ? (
                      <button
                        type="button"
                        onClick={() => onAdvanceStatus(table.id, order.id, nextStatus.value)}
                        className={cn(
                          "flex w-full items-center justify-center gap-1.5 border-t px-3 py-2.5 text-sm font-semibold transition",
                          cfg.advanceBg,
                          cfg.advanceHover,
                          cfg.advanceBorder,
                          cfg.advanceText
                        )}
                      >
                        <ChevronRight className="size-4" />
                        {nextStatus.label}
                      </button>
                    ) : null}

                    {/* Servida: agregar ítems o cobrar */}
                    {status === "servida" && order && (onEditTableOrder || onPayTable) ? (
                      <ServedTableActions
                        tableId={table.id}
                        onEditTableOrder={onEditTableOrder}
                        onPayTable={onPayTable}
                      />
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}
