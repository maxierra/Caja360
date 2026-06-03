"use client";

import * as React from "react";
import { FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toArgentinaDateForExport } from "@/lib/argentina-time";
import { exportStyledWorkbook } from "@/lib/excel-utils";

export type ReportsExportPayload = {
  monthKey: string;
  periodTitle: string;
  days: number;
  paidSalesCount: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  fixedExpensesTotal: number;
  netProfit: number;
  netMarginPct: number;
  netGauge: number;
  sales: { id: string; total: number; created_at: string }[];
  fixedExpenses: {
    name: string;
    amount: number;
    frequencyLabel: string;
    category: string;
    periodAmount: number;
  }[];
};

function safeFilenamePart(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, "-").trim() || "reporte";
}

export function ReportsExportButton({ data }: { data: ReportsExportPayload }) {
  const handleExport = React.useCallback(() => {
    const summaryRows: Record<string, unknown>[] = [
      { Concepto: "Período", Detalle: data.periodTitle, Importe: "" },
      { Concepto: "Días en el período", Detalle: String(data.days), Importe: "" },
      { Concepto: "Ventas cobradas (cantidad)", Detalle: `${data.paidSalesCount} operaciones`, Importe: "" },
      { Concepto: "Ventas (facturación)", Detalle: "Total pagado en el mes", Importe: data.revenue },
      { Concepto: "Costo mercadería (COGS)", Detalle: "Según costo de productos vendidos", Importe: data.cogs },
      { Concepto: "Margen bruto", Detalle: `${(data.grossMarginPct * 100).toFixed(1)}% sobre ventas`, Importe: data.grossProfit },
      { Concepto: "Gastos fijos (prorrateados)", Detalle: "Suma del período según frecuencia", Importe: data.fixedExpensesTotal },
      { Concepto: "Ganancia neta", Detalle: `${(data.netMarginPct * 100).toFixed(1)}% sobre ventas · KPI aguja ${data.netGauge.toFixed(1)}%`, Importe: data.netProfit },
    ];

    const salesRows = data.sales.map((s) => ({
      "Fecha y hora": toArgentinaDateForExport(s.created_at),
      "Importe venta": s.total,
      "ID venta": s.id,
    }));

    const expenseRows = data.fixedExpenses.map((e) => ({
      Concepto: e.name,
      Monto: e.amount,
      Frecuencia: e.frequencyLabel,
      Categoría: e.category || "—",
      "Total en período": e.periodAmount,
    }));

    const sheets: { name: string; data: Record<string, unknown>[] }[] = [
      { name: "Resumen ejecutivo", data: summaryRows },
    ];
    if (salesRows.length > 0) sheets.push({ name: "Ventas cobradas", data: salesRows });
    if (expenseRows.length > 0) sheets.push({ name: "Gastos fijos", data: expenseRows });

    exportStyledWorkbook(sheets, `reporte_negocio_${safeFilenamePart(data.monthKey)}`);
  }, [data]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2 border-[var(--pos-border)]"
      onClick={handleExport}
    >
      <FileSpreadsheet className="size-4 shrink-0" aria-hidden />
      Exportar Excel
    </Button>
  );
}
