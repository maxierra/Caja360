"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar as CalendarIcon, FileDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toArgentinaDateForExport } from "@/lib/argentina-time";
import { exportToExcel } from "@/lib/excel-utils";

type Props = {
  sales: Array<{
    id: string;
    created_at: string;
    payment_method: string;
    status: string;
    total: string | number;
  }>;
  turns: Array<{ id: string; opened_at: string; closed_at: string | null }>;
};

function formatTurnLabel(turn: { opened_at: string; closed_at: string | null }) {
  const opened = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(toArgentinaDateForExport(turn.opened_at));

  return turn.closed_at ? `Turno ${opened}` : `Turno abierto · ${opened}`;
}

export function SalesFilter({ sales, turns }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams?.get("date") ?? "";
  const turn = searchParams?.get("turn") ?? "";
  const searchProduct = searchParams?.get("product") ?? "";

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
      case "cuenta_corriente":
        return "Cuenta corriente";
      default:
        return String(m ?? "");
    }
  }, []);

  const statusLabel = React.useCallback((s: string) => {
    switch (String(s ?? "")) {
      case "paid":
        return "Pagada";
      case "cancelled":
      case "voided":
        return "Anulada";
      case "refunded":
        return "Devuelta";
      default:
        return String(s ?? "");
    }
  }, []);

  const pushParams = React.useCallback(
    (next: { date?: string; product?: string; turn?: string }) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      const finalDate = next.date ?? date;
      const finalProduct = next.product ?? searchProduct;
      const finalTurn = next.turn ?? turn;

      if (finalDate) params.set("date", finalDate);
      else params.delete("date");

      if (finalProduct) params.set("product", finalProduct);
      else params.delete("product");

      if (finalTurn) params.set("turn", finalTurn);
      else params.delete("turn");

      router.push(`/app/sales?${params.toString()}`);
    },
    [date, searchProduct, turn, router, searchParams]
  );

  const handleExport = () => {
    const reportData = sales.map((s) => ({
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
      <form
        method="get"
        action="/app/sales"
        className="flex flex-wrap items-center gap-3"
      >
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="turn" value={turn} />
        <div className="relative inline-flex items-center">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
            <Search className="size-4" />
          </div>
          <Input
            type="text"
            name="product"
            defaultValue={searchProduct}
            placeholder="Buscar producto vendido"
            className="h-10 w-56 rounded-xl border-primary/20 bg-background/50 pl-10 backdrop-blur-sm"
          />
        </div>

        <Button
          variant="outline"
          type="submit"
          className="h-10 rounded-xl px-4 text-xs font-semibold uppercase tracking-wider"
        >
          Buscar producto
        </Button>
      </form>

      <div className="relative inline-flex items-center">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
          <CalendarIcon className="size-4" />
        </div>
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            const newDate = e.target.value;
            pushParams({ date: newDate });
          }}
          className="h-10 w-48 rounded-xl border-primary/20 bg-background/50 pl-10 backdrop-blur-sm"
        />
      </div>

      <select
        value={turn}
        onChange={(e) => {
          const value = e.target.value;
          pushParams({ turn: value });
        }}
        className="h-10 rounded-xl border border-primary/20 bg-background/50 px-3 text-sm"
      >
        <option value="">Todos los turnos</option>
        {turns.map((turnOption) => (
          <option key={turnOption.id} value={turnOption.id}>
            {formatTurnLabel(turnOption)}
          </option>
        ))}
      </select>

      <Button
        variant="outline"
        onClick={() => {
          router.push("/app/sales");
        }}
        className="h-10 rounded-xl px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-primary/5 hover:text-primary transition-all"
        disabled={!date && !searchProduct && !turn}
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
