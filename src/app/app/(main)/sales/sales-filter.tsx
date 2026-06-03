"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar as CalendarIcon, FileDown, Search } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toArgentinaDateForExport } from "@/lib/argentina-time";
import { exportToExcel } from "@/lib/excel-utils";

type Props = {
  sales: any[];
};

export function SalesFilter({ sales }: Props) {
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
      case "mixed":
        return "Mixto";
      default:
        return String(m ?? "");
    }
  }, []);

  const statusLabel = React.useCallback((s: string) => {
    switch (String(s ?? "")) {
      case "paid":
        return "Pagada";
      case "cancelled":
        return "Anulada";
      case "refunded":
        return "Devuelta";
      default:
        return String(s ?? "");
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

  const handleExport = () => {
    const reportData = sales.map(s => ({
      "N° Ticket": String(s.id ?? "").slice(0, 8),
      Fecha: s.created_at ? fmtDateTime.format(toArgentinaDateForExport(s.created_at)) : "",
      "Medio de pago": methodLabel(s.payment_method),
      Estado: statusLabel(s.status),
      Total: fmtMoney.format(Number(s.total) || 0),
    }));
    exportToExcel(reportData, `Ventas_${date || "Todas"}`);
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
          router.push("/app/sales");
        }}
        className="h-10 rounded-xl px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-primary/5 hover:text-primary transition-all"
        disabled={!date}
      >
        Limpiar
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <Button
          onClick={handleExport}
          className="h-10 rounded-xl bg-emerald-600 px-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 hover:shadow-emerald-300 dark:shadow-emerald-900/20"
          disabled={sales.length === 0}
        >
          <FileDown className="mr-2 size-4" />
          Exportar Excel
        </Button>
      </div>
    </div>
  );
}
