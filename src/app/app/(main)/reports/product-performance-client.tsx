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
import { ChevronDown, ChevronUp, PackageSearch, TrendingDown, TrendingUp } from "lucide-react";

import { ProductPerformanceExportButton } from "@/app/app/(main)/reports/product-performance-export";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type ProductPerformanceRow = {
  key: string;
  name: string;
  quantity: number;
  revenue: number;
  salesCount: number;
  averagePerSale: number;
  share: number;
};

export type ProductWithoutSalesRow = {
  id: string;
  name: string;
};

export type ProductPerformancePayload = {
  period: "day" | "week" | "month";
  metric: "quantity" | "revenue";
  anchorDate: string;
  periodTitle: string;
  startIso: string;
  endIso: string;
  totalProductsSold: number;
  totalUnits: number;
  totalRevenue: number;
  topProductName: string | null;
  lowProductName: string | null;
  topProducts: ProductPerformanceRow[];
  lowProducts: ProductPerformanceRow[];
  noSalesProducts: ProductWithoutSalesRow[];
};

function moneyAr(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

function qtyAr(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 3,
  }).format(value);
}

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

function ProductChart({
  data,
  dataKey,
  fill,
}: {
  data: Array<{ name: string; Cantidad: number; Facturacion: number }>;
  dataKey: "Cantidad" | "Facturacion";
  fill: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 56 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.28)" />
        <XAxis
          dataKey="name"
          angle={-25}
          textAnchor="end"
          height={64}
          interval={0}
          tick={{ fontSize: 11, fill: "currentColor" }}
          className="text-slate-600 dark:text-slate-300"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "currentColor" }}
          className="text-slate-600 dark:text-slate-300"
        />
        <Tooltip
          cursor={{ fill: "rgba(148, 163, 184, 0.10)" }}
          contentStyle={{
            backgroundColor: "rgba(15, 23, 42, 0.96)",
            border: "1px solid rgba(148, 163, 184, 0.28)",
            borderRadius: "12px",
            color: "#f8fafc",
            boxShadow: "0 12px 30px rgba(2, 6, 23, 0.35)",
          }}
          labelStyle={{ color: "#f8fafc", fontWeight: 700 }}
          itemStyle={{ color: "#e2e8f0" }}
          formatter={(value, name) => [
            dataKey === "Facturacion" ? moneyAr(Number(value ?? 0)) : qtyAr(Number(value ?? 0)),
            String(name ?? ""),
          ]}
        />
        <Bar dataKey={dataKey} fill={fill} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ProductRankingTable({
  rows,
  title,
  description,
  tone,
}: {
  rows: ProductPerformanceRow[];
  title: string;
  description: string;
  tone: "up" | "down";
}) {
  const [visibleCount, setVisibleCount] = React.useState(10);
  const visibleRows = rows.slice(0, visibleCount);
  const canExpand = rows.length > visibleCount;
  const Icon = tone === "up" ? TrendingUp : TrendingDown;
  const presetOptions = [10, 20, 50].filter((value) => rows.length > value || value === 10);
  const showingAll = rows.length > 0 && visibleCount >= rows.length;
  return (
    <Card className={tone === "up" ? "border-emerald-500/20" : "border-rose-500/20"}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className={
                "rounded-lg p-1.5 " +
                (tone === "up" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400")
              }
            >
              <Icon className="size-4" />
            </div>
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {rows.length > 10 ? (
              <>
                <span className="text-xs font-medium text-muted-foreground">Mostrar:</span>
                {presetOptions.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={visibleCount === option ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVisibleCount(option)}
                  >
                    {option}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant={showingAll ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVisibleCount(rows.length)}
                >
                  Todos
                </Button>
              </>
            ) : (
              <span className="rounded-lg border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                Mostrando todos: {rows.length} producto{rows.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            No hay productos para mostrar en este período.
          </div>
        ) : (
          <>
            <div className="overflow-auto rounded-xl border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium">Producto</th>
                    <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                    <th className="px-3 py-2 text-right font-medium">Facturación</th>
                    <th className="px-3 py-2 text-right font-medium">Tickets</th>
                    <th className="px-3 py-2 text-right font-medium">Promedio</th>
                    <th className="px-3 py-2 text-right font-medium">Participación</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.key} className="border-b last:border-b-0">
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{qtyAr(row.quantity)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{moneyAr(row.revenue)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.salesCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{moneyAr(row.averagePerSale)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pct(row.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Mostrando {visibleRows.length} de {rows.length} productos.
              </div>
              <div className="flex gap-2">
                {visibleCount > 10 && !showingAll ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setVisibleCount(10)}>
                    <ChevronUp className="size-4" />
                    Volver a 10
                  </Button>
                ) : null}
                {canExpand ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setVisibleCount((count) => count + 10)}>
                    <ChevronDown className="size-4" />
                    Ver más
                  </Button>
                ) : rows.length > 10 ? null : (
                  <span className="self-center text-xs text-muted-foreground">
                    Ya estás viendo todos los productos del período.
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ProductPerformanceClient({ data }: { data: ProductPerformancePayload }) {
  const chartData = data.topProducts.slice(0, 10).map((row) => ({
    name: row.name,
    Cantidad: Number(row.quantity.toFixed(3)),
    Facturacion: Number(row.revenue.toFixed(2)),
  }));
  const lowChartData = data.lowProducts.slice(0, 10).map((row) => ({
    name: row.name,
    Cantidad: Number(row.quantity.toFixed(3)),
    Facturacion: Number(row.revenue.toFixed(2)),
  }));
  const noSalesPreview = data.noSalesProducts.slice(0, 12);

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Productos más y menos vendidos</h2>
          <p className="text-sm text-muted-foreground">
            {data.periodTitle}. Ranking ampliable, gráficos y exportación lista para Excel.
          </p>
          <p className="text-xs font-medium text-sky-700 dark:text-sky-400">
            Para ampliar la lista usá los botones Mostrar: 10, 20, 50 o Todos.
          </p>
        </div>
        <ProductPerformanceExportButton data={data} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-emerald-500/20 bg-emerald-500/[0.04]">
          <CardHeader className="pb-2">
            <CardDescription>Producto líder</CardDescription>
            <CardTitle className="text-lg">{data.topProductName ?? "Sin ventas"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {qtyAr(data.totalUnits)} unidades vendidas en total.
          </CardContent>
        </Card>
        <Card className="border-rose-500/20 bg-rose-500/[0.04]">
          <CardHeader className="pb-2">
            <CardDescription>Menor rotación</CardDescription>
            <CardTitle className="text-lg">{data.lowProductName ?? "Sin datos"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Solo entre productos que sí tuvieron ventas.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Productos vendidos</CardDescription>
            <CardTitle className="text-2xl">{data.totalProductsSold}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Distintos productos con movimiento en el período.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Facturación del período</CardDescription>
            <CardTitle className="text-2xl">{moneyAr(data.totalRevenue)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Tomada desde los ítems de ventas pagadas.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 10 más vendidos</CardTitle>
            <CardDescription>Vista rápida para detectar los productos estrella.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No hay ventas en este período.
              </div>
            ) : (
              <ProductChart data={chartData} dataKey="Cantidad" fill="#10b981" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>10 con menor rotación</CardTitle>
            <CardDescription>Productos que sí se vendieron, pero muy poco.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {lowChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Todavía no hay suficientes datos para esta vista.
              </div>
            ) : (
              <ProductChart data={lowChartData} dataKey="Cantidad" fill="#f97316" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ProductRankingTable
            rows={data.topProducts}
            title="Ranking ampliable"
            description="Empieza en top 10 y podés expandirlo en bloques de 10."
            tone="up"
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-slate-500/10 p-1.5 text-slate-600 dark:text-slate-400">
                <PackageSearch className="size-4" />
              </div>
              <div>
                <CardTitle>Sin ventas en el período</CardTitle>
                <CardDescription>{data.noSalesProducts.length} productos activos sin movimiento.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.noSalesProducts.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-emerald-600 dark:text-emerald-400">
                Excelente: todos los productos activos tuvieron ventas.
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  {noSalesPreview.map((row) => (
                    <div key={row.id} className="rounded-lg border px-3 py-2 text-sm">
                      {row.name}
                    </div>
                  ))}
                </div>
                {data.noSalesProducts.length > noSalesPreview.length ? (
                  <div className="text-xs text-muted-foreground">
                    Hay {data.noSalesProducts.length - noSalesPreview.length} productos más. Están incluidos en el Excel.
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <ProductRankingTable
        rows={data.lowProducts}
        title="Menos vendidos"
        description="También ampliable por bloques de 10 para revisar más abajo en el ranking."
        tone="down"
      />
    </div>
  );
}
