"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileText, Printer, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FiscalVoucher } from "@/features/billing/types";
import { voucherTypeLabel } from "@/features/billing/types";
import { emitCreditNoteForVoucher, closeConsolidatedPeriod } from "@/app/app/(main)/settings/fiscal-actions";
import type { PendingConsolidationRow } from "@/app/app/(main)/facturacion/actions";
import { printFiscalVoucherTicket } from "@/lib/fiscal-ticket-utils";

type Props = {
  vouchers: FiscalVoucher[];
  fiscalActive: boolean;
  billingMode: "per_sale" | "consolidated" | null;
  pendingConsolidation: PendingConsolidationRow[];
  pendingByPeriod: Record<string, number>;
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Aprobado",
  rejected: "Rechazado",
  pending: "Pendiente",
  voided_nc: "Anulado (NC)",
};

export function FacturacionClient({
  vouchers,
  fiscalActive,
  billingMode,
  pendingConsolidation,
  pendingByPeriod,
}: Props) {
  const [pending, startTransition] = React.useTransition();
  const [filter, setFilter] = React.useState<"all" | "today">("today");

  const today = new Date().toISOString().slice(0, 10);
  const rows = filter === "today" ? vouchers.filter((v) => v.issue_date === today) : vouchers;

  const emitNc = (id: string) => {
    startTransition(async () => {
      try {
        await emitCreditNoteForVoucher(id);
        toast.success("Nota de Crédito emitida");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const reprint = (v: FiscalVoucher) => {
    if (!v.cae) return;
    printFiscalVoucherTicket(v);
  };

  const closePeriod = (period: string) => {
    startTransition(async () => {
      try {
        await closeConsolidatedPeriod(period);
        toast.success("Período facturado");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Fase 2 pendiente");
      }
    });
  };

  if (!fiscalActive) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-8 text-center dark:bg-amber-950/20">
        <p className="font-semibold">Facturación electrónica no activa</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Configurá certificados y activá la facturación en Configuración → Facturación ARCA.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {billingMode === "consolidated" && (
        <section className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
          <h2 className="text-sm font-bold">Facturación consolidada (Fase 2)</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Las ventas se acumulan sin CAE hasta cerrar el período. Emisión masiva vía microservicio fiscal — próximamente.
          </p>
          <p className="mt-3 text-sm">
            <strong>{pendingConsolidation.length}</strong> ventas pendientes de facturar
          </p>
          {Object.keys(pendingByPeriod).length > 0 && (
            <ul className="mt-3 space-y-2 text-xs">
              {Object.entries(pendingByPeriod).map(([period, count]) => (
                <li key={period} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2">
                  <span>
                    Período <strong>{period}</strong> · {count} venta{count === 1 ? "" : "s"}
                  </span>
                  <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => closePeriod(period)}>
                    Cerrar período y facturar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("today")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold",
            filter === "today" ? "border-slate-900 bg-slate-900 text-white" : "border-border"
          )}
        >
          Hoy
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold",
            filter === "all" ? "border-slate-900 bg-slate-900 text-white" : "border-border"
          )}
        >
          Todos
        </button>
        <span className="text-xs text-muted-foreground">{rows.length} comprobantes</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/70">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b bg-[var(--pos-surface-2)] text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Nº</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">CAE</th>
              <th className="px-3 py-2">Vto CAE</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Ambiente</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-12 text-center text-muted-foreground">
                  No hay comprobantes{filter === "today" ? " hoy" : ""}.
                </td>
              </tr>
            ) : (
              rows.map((v) => (
                <tr key={v.id} className="border-b border-border/50">
                  <td className="px-3 py-2">{v.issue_date}</td>
                  <td className="px-3 py-2">{voucherTypeLabel(v.voucher_type)}</td>
                  <td className="px-3 py-2">
                    {String(v.pos_number).padStart(4, "0")}-{String(v.voucher_number).padStart(8, "0")}
                  </td>
                  <td className="px-3 py-2">{v.buyer_name ?? "Consumidor Final"}</td>
                  <td className="px-3 py-2 font-medium">${Number(v.total).toLocaleString("es-AR")}</td>
                  <td className="px-3 py-2 font-mono text-xs">{v.cae ?? "—"}</td>
                  <td className="px-3 py-2">{v.cae_expires_at ?? "—"}</td>
                  <td className="px-3 py-2">{STATUS_LABELS[v.status] ?? v.status}</td>
                  <td className="px-3 py-2">{v.environment === "prod" ? "Prod" : "Test"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {v.status === "approved" && v.cae && (
                        <>
                          <Button type="button" size="sm" variant="outline" onClick={() => reprint(v)}>
                            <Printer className="size-3.5" />
                          </Button>
                          {v.voucher_type === 11 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              onClick={() => emitNc(v.id)}
                            >
                              <RotateCcw className="size-3.5" />
                              NC
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FileTextIcon() {
  return <FileText className="size-4" />;
}

export { FileTextIcon };
