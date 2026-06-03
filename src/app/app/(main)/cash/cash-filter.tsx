"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar as CalendarIcon, FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toArgentinaDateForExport } from "@/lib/argentina-time";
import { exportToExcel } from "@/lib/excel-utils";

type Props = {
  ledgerRows: any[];
  turns: any[];
};

export function CashFilter({ ledgerRows, turns }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [date, setDate] = React.useState(() => searchParams?.get("date") ?? "");

  React.useEffect(() => {
    setDate(searchParams?.get("date") ?? "");
  }, [searchParams]);

  const fmtDateTime = React.useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  const fmtMoney = React.useMemo(
    () =>
      new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 2,
      }),
    []
  );

  const methodLabel = React.useCallback((m: string) => {
    switch (String(m ?? "")) {
      case "cash":
        return "Efectivo";
      case "card":
        return "Tarjeta";
      case "transfer":
        return "Transferencia";
      case "mercadopago":
        return "Mercado Pago";
      case "cuenta_corriente":
        return "Cuenta corriente";
      default:
        return String(m ?? "");
    }
  }, []);

  const kindLabel = React.useCallback((k: string) => {
    switch (String(k ?? "")) {
      case "sale":
        return "Venta";
      case "manual":
        return "Movimiento manual";
      case "opening":
        return "Apertura";
      case "closing":
        return "Cierre";
      case "cc_sale":
        return "Venta cuenta corriente";
      case "cc_payment":
        return "Cobro deuda";
      default:
        return String(k ?? "");
    }
  }, []);

  const movementLabel = React.useCallback((m: string) => {
    switch (String(m ?? "")) {
      case "in":
        return "Ingreso";
      case "out":
        return "Egreso";
      case "neutral":
        return "Pendiente (sin ingreso)";
      default:
        return String(m ?? "");
    }
  }, []);

  const onDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setDate(newDate);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (newDate) {
      params.set("date", newDate);
    } else {
      params.delete("date");
    }
    router.push(`?${params.toString()}`);
  };

  const handleExportLedger = () => {
    const reportData = ledgerRows.map(r => ({
      Fecha: r.created_at ? fmtDateTime.format(toArgentinaDateForExport(r.created_at)) : "",
      Tipo: kindLabel(r.kind),
      Movimiento: movementLabel(r.movement_type),
      "Medio de pago": methodLabel(r.method),
      Monto: fmtMoney.format(Number(r.amount) || 0),
      Motivo: String(r.reason ?? ""),
    }));
    exportToExcel(reportData, `Libro_Caja_${date || "Hoy"}`);
  };

  const handleExportTurns = () => {
    const reportData = turns.map(t => ({
      Apertura: t.opened_at ? fmtDateTime.format(toArgentinaDateForExport(t.opened_at)) : "",
      Cierre: t.closed_at ? fmtDateTime.format(toArgentinaDateForExport(t.closed_at)) : "",
      "Inicial (caja)": fmtMoney.format(Number(t.opening_amount) || 0),
      "Vendido (turno)": fmtMoney.format(Number(t.sold_total) || 0),
      "Final (caja)": fmtMoney.format(Number(t.closing_amount) || 0),
    }));
    exportToExcel(reportData, `Turnos_Caja_${date || "Recientes"}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative inline-flex items-center">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
          <CalendarIcon className="size-4" />
        </div>
        <Input
          type="date"
          value={date}
          onChange={onDateChange}
          className="w-48 pl-10 h-10 rounded-xl border-primary/20 bg-background/50 backdrop-blur-sm focus:border-primary/40 focus:ring-primary/10 transition-all"
        />
      </div>

      <Button
        variant="outline"
        onClick={() => {
          setDate("");
          router.push("/app/cash");
        }}
        className="h-10 rounded-xl px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-primary/5 hover:text-primary transition-all"
        disabled={!date}
      >
        Limpiar
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <Button
          onClick={handleExportLedger}
          className="h-10 rounded-xl bg-emerald-600 px-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 hover:shadow-emerald-300 dark:shadow-emerald-900/20"
          disabled={ledgerRows.length === 0}
        >
          <FileDown className="mr-2 size-4" />
          Exportar Libro
        </Button>
        <Button
          onClick={handleExportTurns}
          className="h-10 rounded-xl border-emerald-600/30 text-emerald-600 px-4 text-xs font-bold uppercase tracking-widest transition-all hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
          variant="outline"
          disabled={turns.length === 0}
        >
          <FileDown className="mr-2 size-4" />
          Exportar Turnos
        </Button>
      </div>
    </div>
  );
}
