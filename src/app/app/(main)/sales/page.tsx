import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { SalesFilter } from "@/app/app/(main)/sales/sales-filter";
import { SalesResultsClient, type SalesDayRow, type SalesDisplayRow } from "@/app/app/(main)/sales/sales-results-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatArgentinaDateTime, getArgentinaDayRangeUtcIso } from "@/lib/argentina-time";
import { effectiveSalePaymentMethod } from "@/lib/sale-payment-method-display";
import { createClient } from "@/lib/supabase/server";

type SaleRow = {
  id: string;
  total: string | number;
  payment_method: string;
  payment_details?: unknown;
  status: string;
  created_at: string;
  cash_register_id: string | null;
};

type DisplaySaleRow = {
  key: string;
  id: string;
  created_at: string;
  payment_method: string;
  status: string;
  total: string | number;
  cash_register_id: string | null;
  isSplit?: boolean;
  isSplitFirst?: boolean;
  matchedProducts?: string[];
};

type SaleItemMatchRow = {
  sale_id: string;
  name: string;
};

type CashRegisterOption = {
  id: string;
  opened_at: string;
  closed_at: string | null;
};

function getSplitDetails(details: unknown): Array<{ method: string; amount: number }> {
  if (!details || typeof details !== "object") return [];
  const d = details as Record<string, unknown>;
  const split = d?.split;
  if (!Array.isArray(split)) return [];

  return split
    .map((x) => {
      const part = x as { method?: unknown; amount?: unknown };
      return { method: String(part.method ?? ""), amount: Number(part.amount ?? 0) };
    })
    .filter((x) => x.method && Number.isFinite(x.amount) && x.amount > 0);
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
            cash_register_id: s.cash_register_id,
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
      cash_register_id: s.cash_register_id,
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

function formatCashTurnLabel(turn: CashRegisterOption) {
  const opened = formatArgentinaDateTime(turn.opened_at);
  return turn.closed_at ? `Turno ${opened}` : `Turno abierto · ${opened}`;
}

function argentinaYmd(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function argentinaDayLabel(ymd: string) {
  const date = new Date(`${ymd}T12:00:00-03:00`);
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; product?: string; turn?: string }>;
}) {
  const params = await searchParams;
  const filterDate = params.date;
  const filterProduct = String(params.product ?? "").trim();
  const filterTurn = String(params.turn ?? "").trim();
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
    .select("id,total,payment_method,payment_details,status,created_at,cash_register_id")
    .eq("business_id", businessId);

  if (filterDate) {
    const { startIso, endExclusiveIso } = getArgentinaDayRangeUtcIso(filterDate);
    query = query.gte("created_at", startIso).lt("created_at", endExclusiveIso);
  }

  if (filterTurn) {
    query = query.eq("cash_register_id", filterTurn);
  }

  const [{ data: salesData }, { data: turnsData }] = await Promise.all([
    query.order("created_at", { ascending: false }).limit(filterDate || filterProduct || filterTurn ? 1000 : 100),
    supabase
      .from("cash_registers")
      .select("id,opened_at,closed_at")
      .eq("business_id", businessId)
      .order("opened_at", { ascending: false })
      .limit(100),
  ]);

  let canVoidForUser = false;
  if (userId) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("role,permissions")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .maybeSingle();

    const membershipRow = membership as { role?: string | null; permissions?: Record<string, unknown> } | null;
    const role = membershipRow?.role ?? null;
    const perms = membershipRow?.permissions ?? {};
    canVoidForUser = role === "owner" || perms.sales_void === true;
  }

  const sales = (salesData ?? []) as SaleRow[];
  const turns = (turnsData ?? []) as CashRegisterOption[];
  const saleIds = sales.map((sale) => sale.id);
  let matchedProductsBySaleId = new Map<string, string[]>();

  if (filterProduct && saleIds.length > 0) {
    const { data: matchedItemsData } = await supabase
      .from("sale_items")
      .select("sale_id,name")
      .eq("business_id", businessId)
      .in("sale_id", saleIds)
      .ilike("name", `%${filterProduct}%`);

    const matchedItems = (matchedItemsData ?? []) as SaleItemMatchRow[];
    matchedProductsBySaleId = matchedItems.reduce((map, item) => {
      const current = map.get(item.sale_id) ?? [];
      if (!current.includes(item.name)) current.push(item.name);
      map.set(item.sale_id, current);
      return map;
    }, new Map<string, string[]>());
  }

  const salesNormalized = sales
    .map((s) => ({
      ...s,
      payment_method: effectiveSalePaymentMethod(s.payment_method, s.payment_details),
    }))
    .filter((sale) => {
      if (!filterProduct) return true;
      return matchedProductsBySaleId.has(sale.id);
    });

  const rows = expandSalesRows(salesNormalized).map((row) => ({
    ...row,
    matchedProducts: matchedProductsBySaleId.get(row.id) ?? [],
  }));
  const salesDaysMap = new Map<string, SalesDayRow>();

  for (const row of rows) {
    const ymd = argentinaYmd(row.created_at);
    const existing = salesDaysMap.get(ymd) ?? {
      ymd,
      label: argentinaDayLabel(ymd),
      salesCount: 0,
      total: 0,
      rows: [],
    };
    const turn = turns.find((entry) => entry.id === row.cash_register_id);
    const methodLabel =
      row.payment_method === "cash"
        ? "Efectivo"
        : row.payment_method === "card"
          ? "Tarjeta"
          : row.payment_method === "mercadopago"
            ? "Mercado Pago"
            : row.payment_method === "transfer"
              ? "Transferencia"
              : row.payment_method === "cuenta_corriente"
                ? "Cuenta corriente"
                : row.payment_method;
    const statusLabel = row.status === "paid" ? "Pagada" : row.status === "voided" ? "Anulada" : row.status;
    const statusKind = row.status === "paid" ? "success" : row.status === "voided" ? "warning" : "neutral";

    const displayRow: SalesDisplayRow = {
      key: row.key,
      id: row.id,
      created_at: formatArgentinaDateTime(row.created_at),
      turnLabel: turn ? formatCashTurnLabel(turn) : "Sin turno",
      matchedLabel:
        row.matchedProducts && row.matchedProducts.length > 0
          ? row.matchedProducts.length > 1
            ? `${row.matchedProducts[0]} (+${row.matchedProducts.length - 1})`
            : row.matchedProducts[0]
          : "Todos los productos",
      paymentLabel: methodLabel,
      paymentClassName:
        "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium " +
        methodBadgeClass(row.payment_method),
      statusLabel,
      statusClassName:
        "inline-flex items-center rounded-lg border px-2 py-1 text-[11px] font-medium " +
        badgeClass(statusKind),
      total: moneyAr(row.total),
      showActions: !(row.isSplit && !row.isSplitFirst),
      saleId: row.id,
      canVoid: row.status === "paid" && canVoidForUser,
    };

    existing.salesCount += row.isSplit && !row.isSplitFirst ? 0 : 1;
    existing.total += typeof row.total === "number" ? row.total : Number(row.total);
    existing.rows.push(displayRow);
    salesDaysMap.set(ymd, existing);
  }

  const groupedDays = Array.from(salesDaysMap.values()).sort((a, b) => b.ymd.localeCompare(a.ymd));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ventas</h1>
        <p className="text-sm text-muted-foreground">
          Historial de tickets, búsqueda por producto y separación por turno de caja.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <div className="flex-1">
            <div className="text-base font-semibold tracking-tight">Listado</div>
            <div className="text-sm text-muted-foreground">{rows.length} ventas visibles</div>
          </div>
          <div className="flex-[1.6]">
            <Suspense fallback={<div className="h-10 max-w-md animate-pulse rounded-xl bg-muted/40" aria-hidden />}>
              <SalesFilter sales={salesNormalized} turns={turns} />
            </Suspense>
          </div>
        </div>

        <div className="p-5">
          <SalesResultsClient
            days={groupedDays}
            emptyMessage="No hay ventas que coincidan con los filtros."
          />
        </div>
      </div>
    </div>
  );
}
