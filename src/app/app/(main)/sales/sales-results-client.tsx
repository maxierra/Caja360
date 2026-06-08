"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronDown, ChevronRight } from "lucide-react";

import { SalesRowActions } from "@/app/app/(main)/sales/sales-row-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type SalesDayRow = {
  ymd: string;
  label: string;
  salesCount: number;
  total: number;
  rows: SalesDisplayRow[];
};

export type SalesDisplayRow = {
  key: string;
  id: string;
  created_at: string;
  turnLabel: string;
  matchedLabel: string;
  paymentLabel: string;
  paymentClassName: string;
  statusLabel: string;
  statusClassName: string;
  total: string;
  showActions: boolean;
  saleId: string;
  canVoid: boolean;
};

function moneyAr(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

function SalesChart({ data }: { data: SalesDayRow[] }) {
  const chartData = [...data].reverse().map((day) => ({
    dia: day.label,
    total: Number(day.total.toFixed(2)),
    ventas: day.salesCount,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución del período</CardTitle>
        <CardDescription>Facturación agrupada por día. Tocá un día abajo para ver sus ventas.</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px]">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No hay datos para graficar.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "currentColor" }} className="text-slate-600 dark:text-slate-300" />
              <YAxis tick={{ fontSize: 11, fill: "currentColor" }} className="text-slate-600 dark:text-slate-300" />
              <Tooltip
                cursor={{ fill: "rgba(148,163,184,0.10)" }}
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.96)",
                  border: "1px solid rgba(148, 163, 184, 0.28)",
                  borderRadius: "12px",
                  color: "#f8fafc",
                }}
                formatter={(value, name) =>
                  name === "total"
                    ? [moneyAr(Number(value ?? 0)), "Facturación"]
                    : [String(value ?? 0), "Ventas"]
                }
              />
              <Bar dataKey="total" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function SalesResultsClient({
  days,
  emptyMessage,
}: {
  days: SalesDayRow[];
  emptyMessage: string;
}) {
  const firstDayKey = days[0]?.ymd ?? "";
  const [openDays, setOpenDays] = React.useState<Record<string, boolean>>({});

  if (days.length === 0) {
    return (
      <div className="rounded-2xl border bg-card px-4 py-10 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SalesChart data={days} />

      <div className="space-y-4">
        {days.map((day) => {
          const isOpen = openDays[day.ymd] ?? day.ymd === firstDayKey;
          return (
            <Card key={day.ymd}>
              <button
                type="button"
                onClick={() => setOpenDays((prev) => ({ ...prev, [day.ymd]: !isOpen }))}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                  <div>
                    <div className="font-semibold">{day.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {day.salesCount} venta(s) · {moneyAr(day.total)}
                    </div>
                  </div>
                </div>
              </button>

              {isOpen ? (
                <CardContent className="pt-0">
                  <div className="overflow-auto rounded-xl border">
                    <table className="w-full min-w-[1120px] text-sm">
                      <thead className="bg-[var(--pos-surface-2)] text-muted-foreground">
                        <tr className="border-b">
                          <th className="px-4 py-3 text-left font-medium">Ticket</th>
                          <th className="px-4 py-3 text-left font-medium">Fecha (AR)</th>
                          <th className="px-4 py-3 text-left font-medium">Turno de caja</th>
                          <th className="px-4 py-3 text-left font-medium">Producto buscado</th>
                          <th className="px-4 py-3 text-left font-medium">Método</th>
                          <th className="px-4 py-3 text-left font-medium">Estado</th>
                          <th className="px-4 py-3 text-right font-medium">Total</th>
                          <th className="px-4 py-3 text-right font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.rows.map((row) => (
                          <tr key={row.key} className="border-b last:border-b-0">
                            <td className="px-4 py-3">
                              <div className="font-medium">Venta #{row.id.slice(0, 8)}</div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{row.created_at}</td>
                            <td className="px-4 py-3 text-muted-foreground">{row.turnLabel}</td>
                            <td className="px-4 py-3">
                              <div className="max-w-[280px] text-xs text-muted-foreground">
                                <div className="font-medium text-foreground">{row.matchedLabel}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={row.paymentClassName}>{row.paymentLabel}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={row.statusClassName}>{row.statusLabel}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-numeric font-semibold">{row.total}</td>
                            <td className="px-4 py-3">
                              {row.showActions ? <SalesRowActions saleId={row.saleId} canVoid={row.canVoid} /> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
