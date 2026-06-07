"use client";

import * as React from "react";
import { FileSpreadsheet } from "lucide-react";

import type { ProductPerformancePayload } from "@/app/app/(main)/reports/product-performance-client";
import { Button } from "@/components/ui/button";
import { exportStyledWorkbook } from "@/lib/excel-utils";

function safeFilenamePart(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, "-").trim() || "reporte";
}

export function ProductPerformanceExportButton({ data }: { data: ProductPerformancePayload }) {
  const handleExport = React.useCallback(() => {
    const summaryRows: Record<string, unknown>[] = [
      { Concepto: "Período", Detalle: data.periodTitle, Importe: "" },
      { Concepto: "Fecha base", Detalle: data.anchorDate, Importe: "" },
      { Concepto: "Productos vendidos", Detalle: String(data.totalProductsSold), Importe: "" },
      { Concepto: "Unidades vendidas", Detalle: "", Importe: data.totalUnits },
      { Concepto: "Facturación de ítems", Detalle: "", Importe: data.totalRevenue },
      { Concepto: "Producto más vendido", Detalle: data.topProductName ?? "—", Importe: "" },
      { Concepto: "Producto menos vendido", Detalle: data.lowProductName ?? "—", Importe: "" },
      { Concepto: "Productos sin ventas", Detalle: String(data.noSalesProducts.length), Importe: "" },
    ];

    const rankingRows = data.topProducts.map((row, index) => ({
      Posición: index + 1,
      Producto: row.name,
      Cantidad: row.quantity,
      Facturación: row.revenue,
      Tickets: row.salesCount,
      "Promedio por ticket": row.averagePerSale,
      Participación: row.share / 100,
    }));

    const lowRows = data.lowProducts.map((row, index) => ({
      Posición: index + 1,
      Producto: row.name,
      Cantidad: row.quantity,
      Facturación: row.revenue,
      Tickets: row.salesCount,
      "Promedio por ticket": row.averagePerSale,
      Participación: row.share / 100,
    }));

    const noSalesRows = data.noSalesProducts.map((row) => ({
      Producto: row.name,
      Estado: "Sin ventas en el período",
    }));

    const sheets: { name: string; data: Record<string, unknown>[] }[] = [
      { name: "Resumen", data: summaryRows },
    ];
    if (rankingRows.length > 0) sheets.push({ name: "Mas vendidos", data: rankingRows });
    if (lowRows.length > 0) sheets.push({ name: "Menos vendidos", data: lowRows });
    if (noSalesRows.length > 0) sheets.push({ name: "Sin ventas", data: noSalesRows });

    exportStyledWorkbook(sheets, `productos_${safeFilenamePart(data.period)}_${safeFilenamePart(data.anchorDate)}`);
  }, [data]);

  return (
    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleExport}>
      <FileSpreadsheet className="size-4" />
      Exportar Excel
    </Button>
  );
}
