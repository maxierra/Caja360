import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { Banknote, CreditCard, Landmark, NotebookPen, Wallet } from "lucide-react";

import { SalesRowActions } from "@/app/app/(main)/sales/sales-row-actions";
import { SalesFilter } from "@/app/app/(main)/sales/sales-filter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatArgentinaDateTime, getArgentinaDayRangeUtcIso } from "@/lib/argentina-time";
import { createClient } from "@/lib/supabase/server";
import { effectiveSalePaymentMethod } from "@/lib/sale-payment-method-display";

type SaleRow = {
  id: string;
  total: string | number;
  payment_method: string;
  payment_details?: unknown;
  status: string;
  created_at: string;
};

type DisplaySaleRow = {
  key: string;
  id: string;
  created_at: string;
  payment_method: string;
  status: string;
  total: string | number;
  isSplit?: boolean;
  isSplitFirst?: boolean;
};

function getSplitDetails(details: unknown): Array<{ method: string; amount: number }> {
  if (!details || typeof details !== "object") return [];
  const d = details as any;
  const split = d?.split;
  if (!Array.isArray(split)) return [];

  return split
    .map((x) => ({ method: String(x?.method ?? ""), amount: Number(x?.amount ?? 0) }))
    .filter((x) => x.method && Number.isFinite(x.amount) && x.amount > 0);
}

function MethodBadgeIcon({ method }: { method: string }) {
  if (method === "cash") return <Banknote className="size-3.5" />;
  if (method === "card") return <CreditCard className="size-3.5" />;
  if (method === "mercadopago") return <Wallet className="size-3.5" />;
  if (method === "cuenta_corriente") return <NotebookPen className="size-3.5" />;
  return <Landmark className="size-3.5" />;
}

function expandSalesRows(sales: SaleRow[]): DisplaySaleRow[] {
  const out: DisplaySaleRow[] = [];

  for (const s of sales) {
    if (s.payment_method === "mixed") {
      const split = getSplitDetails(s.payment_details);
      if (split.length >= 2) {
        split.slice(0, 2).forEach((part, idx) => {
          out.push({
            key: `${s.id}-${idx}`,
            id: s.id,
            created_at: s.created_at,
            payment_method: part.method,
            status: s.status,
            total: part.amount,
            isSplit: true,
            isSplitFirst: idx === 0,
          });
        });
        continue;
      }
    }

    out.push({
      key: s.id,
      id: s.id,
      created_at: s.created_at,
      payment_method: s.payment_method,
      status: s.status,
      total: s.total,
    });
  }

  return out;
}

function moneyAr(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return `$${value}`;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(n);
}

function badgeClass(kind: "success" | "warning" | "neutral") {
  switch (kind) {
    case "success":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "warning":
      return "border-[var(--pos-amber)]/30 bg-[var(--pos-amber)]/10 text-[var(--pos-amber)]";
    default:
      return "border-[var(--pos-border)] bg-[var(--pos-surface-2)] text-muted-foreground";
  }
}

function methodBadgeClass(method: string) {
  switch (method) {
    case "cash":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "card":
      return "border-[var(--pos-amber)]/30 bg-[var(--pos-amber)]/10 text-[var(--pos-amber)]";
    case "transfer":
      return "border-violet-500/30 bg-violet-500/10 text-violet-400";
    case "mercadopago":
      return "border-sky-500/30 bg-sky-500/10 text-sky-400";
    case "cuenta_corriente":
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
    case "mixed":
      return "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400";
    default:
      return badgeClass("neutral");
  }
}

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const filterDate = params.date;
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;

  if (!businessId) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Ventas</CardTitle>
            <CardDescription>Primero tenés que crear o seleccionar un negocio.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="text-sm underline" href="/app/setup">
              Ir a /app/setup
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id ?? null;
  let query = supabase
    .from("sales")
    .select("id,total,payment_method,payment_details,status,created_at")
    .eq("business_id", businessId);

  if (filterDate) {
    const { startIso, endExclusiveIso } = getArgentinaDayRangeUtcIso(filterDate);
    query = query.gte("created_at", startIso).lt("created_at", endExclusiveIso);
  }

  const { data } = await query.order("created_at", { ascending: false }).limit(filterDate ? 1000 : 100);

  let canVoidForUser = false;
  if (userId) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("role,permissions")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .maybeSingle();

    const role = (membership as any)?.role as string | null;
    const perms = ((membership as any)?.permissions ?? {}) as Record<string, unknown>;

    canVoidForUser = role === "owner" || perms.sales_void === true;
  }

  const sales = (data ?? []) as SaleRow[];
  const salesNormalized = sales.map((s) => ({
    ...s,
    payment_method: effectiveSalePaymentMethod(s.payment_method, s.payment_details),
  }));
  const rows = expandSalesRows(salesNormalized);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ventas</h1>
        <p className="text-sm text-muted-foreground">Historial de tickets y métodos de pago.</p>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <div className="flex-1">
            <div className="text-base font-semibold tracking-tight">Listado</div>
            <div className="text-sm text-muted-foreground">{sales.length} ventas</div>
          </div>
          <div className="flex-1">
            <Suspense fallback={<div className="h-10 max-w-md animate-pulse rounded-xl bg-muted/40" aria-hidden />}>
              <SalesFilter sales={salesNormalized} />
            </Suspense>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-[var(--pos-surface-2)] text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium">Ticket</th>
                <th className="px-4 py-3 text-left font-medium">Fecha (AR)</th>
                <th className="px-4 py-3 text-left font-medium">Método</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No hay ventas registradas.
                  </td>
                </tr>
              ) : (
                rows.map((s) => {
                  const methodLabel =
                    s.payment_method === "cash"
                      ? "Efectivo"
                      : s.payment_method === "card"
                        ? "Tarjeta"
                        : s.payment_method === "mercadopago"
                          ? "Mercado Pago"
                          : s.payment_method === "transfer"
                            ? "Transferencia"
                            : s.payment_method === "cuenta_corriente"
                              ? "Cuenta corriente"
                              : s.payment_method;

                  const statusLabel =
                    s.status === "paid" ? "Pagada" : s.status === "voided" ? "Anulada" : s.status;
                  const statusKind = s.status === "paid" ? "success" : s.status === "voided" ? "warning" : "neutral";
                  const canVoid = s.status === "paid" && canVoidForUser;

                  return (
                    <tr key={s.key} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">Venta #{s.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatArgentinaDateTime(s.created_at)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium " +
                            methodBadgeClass(s.payment_method)
                          }
                        >
                          <MethodBadgeIcon method={s.payment_method} />
                          {methodLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            "inline-flex items-center rounded-lg border px-2 py-1 text-[11px] font-medium " +
                            badgeClass(statusKind)
                          }
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-numeric font-semibold">{moneyAr(s.total)}</td>
                      <td className="px-4 py-3">
                        {s.isSplit && !s.isSplitFirst ? null : <SalesRowActions saleId={s.id} canVoid={canVoid} />}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
