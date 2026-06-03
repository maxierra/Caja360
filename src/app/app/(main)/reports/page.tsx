import Link from "next/link";
import { cookies } from "next/headers";
import { 
  TrendingUp, 
  ShoppingBag, 
  Scale, 
  Receipt, 
  Wallet,
} from "lucide-react";

import { createFixedExpense, deleteFixedExpense, updateFixedExpense } from "@/app/app/(main)/reports/actions";
import { ReportsExportButton } from "@/app/app/(main)/reports/reports-export-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getArgentinaDayRangeUtcIso } from "@/lib/argentina-time";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type SaleRow = {
  id: string;
  total: number | string;
  status: string;
  created_at: string;
};

type SaleItemRow = {
  sale_id: string;
  product_id: string | null;
  quantity: number | string;
  total: number | string;
  created_at: string;
};

type ProductCostRow = {
  id: string;
  cost: number | string;
};

type FixedExpenseRow = {
  id: string;
  name: string;
  amount: number | string;
  frequency: "daily" | "weekly" | "monthly";
  category: string | null;
  active: boolean;
};

function toNum(v: number | string | null | undefined) {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function moneyAr(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function periodLabel(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m || 1) - 1, 1, 12, 0, 0, 0));
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(d);
}

function dailyRate(expense: FixedExpenseRow) {
  const amount = toNum(expense.amount);
  if (expense.frequency === "daily") return amount;
  if (expense.frequency === "weekly") return amount / 7;
  return amount / 30;
}

function fixedExpenseForPeriod(expense: FixedExpenseRow, days: number) {
  const amount = toNum(expense.amount);
  if (expense.frequency === "daily") return amount * days;
  if (expense.frequency === "weekly") {
    return (amount / 7) * days;
  }
  return amount;
}

function translateFrequency(f: FixedExpenseRow["frequency"]) {
  if (f === "daily") return "diario";
  if (f === "weekly") return "semanal";
  return "mensual";
}

function SpeedometerGauge({
  value,
  label,
  recommended,
}: {
  value: number;
  label: string;
  recommended: string;
}) {
  const v = Math.max(0, Math.min(100, value));

  const W = 260;
  const H = 155;
  const cx = W / 2;
  const cy = H - 20;
  const R = 100;
  const sw = 20;

  function pointOnArc(pct: number, radius: number) {
    const ang = Math.PI * (1 - pct / 100);
    return { x: cx + radius * Math.cos(ang), y: cy - radius * Math.sin(ang) };
  }

  function arcPath(fromPct: number, toPct: number) {
    const p1 = pointOnArc(fromPct, R);
    const p2 = pointOnArc(toPct, R);
    const span = Math.abs(toPct - fromPct);
    const large = span > 50 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${R} ${R} 0 ${large} 1 ${p2.x} ${p2.y}`;
  }

  const needleTip = pointOnArc(v, R - 12);
  const needleBase = pointOnArc(v, 18);

  const pctText = `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;

  return (
    <div className="flex flex-col items-center">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
        <defs>
          <filter id="gShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="rgba(0,0,0,0.22)" />
          </filter>
        </defs>

        <path d={arcPath(0, 100)} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth={sw} strokeLinecap="round" />

        <g filter="url(#gShadow)">
          <path d={arcPath(0, 33)} fill="none" stroke="rgb(239,68,68)" strokeWidth={sw} strokeLinecap="round" />
          <path d={arcPath(33, 66)} fill="none" stroke="rgb(245,158,11)" strokeWidth={sw} strokeLinecap="round" />
          <path d={arcPath(66, 100)} fill="none" stroke="rgb(16,185,129)" strokeWidth={sw} strokeLinecap="round" />
        </g>

        <line
          x1={needleBase.x} y1={needleBase.y}
          x2={needleTip.x} y2={needleTip.y}
          className="stroke-slate-900 dark:stroke-white transition-all duration-700 ease-out"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={10} className="fill-slate-900 dark:fill-white" />
        <circle cx={cx} cy={cy} r={5.5} className="fill-white dark:fill-slate-900" />

        <text x={cx} y={cy - 22} textAnchor="middle" className="fill-foreground text-2xl font-bold">
          {pctText}
        </text>
        <text x={cx} y={cy - 40} textAnchor="middle" className="fill-muted-foreground text-[11px] font-medium">
          {label}
        </text>
      </svg>
      <div className="mt-1 text-sm text-muted-foreground">{recommended}</div>
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const currentArYmd = getArgentinaDayRangeUtcIso().ymd;
  const selectedMonth =
    typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month)
      ? sp.month
      : currentArYmd.slice(0, 7);

  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;

  if (!businessId) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Reportes</CardTitle>
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

  const [selYear, selMonth] = selectedMonth.split("-").map(Number);
  const monthStartYmd = `${String(selYear).padStart(4, "0")}-${String(selMonth || 1).padStart(2, "0")}-01`;
  const nextMonthYmd =
    (selMonth || 1) === 12
      ? `${String(selYear + 1).padStart(4, "0")}-01-01`
      : `${String(selYear).padStart(4, "0")}-${String((selMonth || 1) + 1).padStart(2, "0")}-01`;
  const { startIso: periodStartIso } = getArgentinaDayRangeUtcIso(monthStartYmd);
  const { startIso: periodEndIso } = getArgentinaDayRangeUtcIso(nextMonthYmd);

  const supabase = await createClient();
  const [{ data: salesData }, { data: fixedExpensesData }] = await Promise.all([
    supabase
      .from("sales")
      .select("id,total,status,created_at")
      .eq("business_id", businessId)
      .gte("created_at", periodStartIso)
      .lt("created_at", periodEndIso),
    supabase
      .from("fixed_expenses")
      .select("id,name,amount,frequency,category,active")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("created_at", { ascending: false }),
  ]);

  const sales = (salesData ?? []) as SaleRow[];
  const paidSales = sales.filter((s) => s.status === "paid");
  const paidSaleIds = paidSales.map((s) => s.id);
  const { data: itemsData } = paidSaleIds.length
    ? await supabase
        .from("sale_items")
        .select("sale_id,product_id,quantity,total,created_at")
        .eq("business_id", businessId)
        .in("sale_id", paidSaleIds)
    : { data: [] };
  const items = (itemsData ?? []) as SaleItemRow[];
  const fixedExpenses = (fixedExpensesData ?? []) as FixedExpenseRow[];

  const uniqueProductIds = Array.from(new Set(items.map((x) => x.product_id).filter(Boolean))) as string[];
  const { data: productsCostData } = uniqueProductIds.length
    ? await supabase.from("products").select("id,cost").in("id", uniqueProductIds)
    : { data: [] };
  const productsCost = (productsCostData ?? []) as ProductCostRow[];
  const costMap = new Map(productsCost.map((p) => [p.id, toNum(p.cost)]));

  const revenue = paidSales.reduce((acc, s) => acc + toNum(s.total), 0);
  const cogs = items.reduce((acc, it) => acc + toNum(it.quantity) * toNum(costMap.get(String(it.product_id ?? ""))), 0);
  const grossProfit = revenue - cogs;
  const grossMarginPct = revenue > 0 ? grossProfit / revenue : 0;

  const days =
    Math.max(
      1,
      Math.round((Date.parse(periodEndIso) - Date.parse(periodStartIso)) / (1000 * 60 * 60 * 24))
    );
  const fixedExpensesTotal = fixedExpenses.reduce((acc, e) => acc + fixedExpenseForPeriod(e, days), 0);
  const netProfit = grossProfit - fixedExpensesTotal;
  const netMarginPct = revenue > 0 ? netProfit / revenue : 0;

  const netGaugeRaw = Math.max(0, Math.min(100, netMarginPct * 100));
  const netGauge = Math.round(netGaugeRaw * 10) / 10;

  const exportPayload = {
    monthKey: selectedMonth,
    periodTitle: periodLabel(selectedMonth),
    days,
    paidSalesCount: paidSales.length,
    revenue,
    cogs,
    grossProfit,
    grossMarginPct,
    fixedExpensesTotal,
    netProfit,
    netMarginPct,
    netGauge,
    sales: paidSales.map((s) => ({
      id: s.id,
      total: toNum(s.total),
      created_at: s.created_at,
    })),
    fixedExpenses: fixedExpenses.map((e) => ({
      name: e.name,
      amount: toNum(e.amount),
      frequencyLabel: translateFrequency(e.frequency),
      category: e.category ?? "",
      periodAmount: fixedExpenseForPeriod(e, days),
    })),
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
          <p className="text-sm text-muted-foreground">Resultado del negocio: ventas, costos, gastos y ganancia neta.</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground capitalize">{periodLabel(selectedMonth)}</div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <ReportsExportButton data={exportPayload} />
            <span className="max-w-[220px] text-xs text-muted-foreground">
              Excel con estilo: resumen del mes, ventas cobradas y gastos fijos (según el mes elegido).
            </span>
          </div>
          <form method="get" className="flex items-center gap-2">
            <Label htmlFor="month" className="text-xs text-muted-foreground">Mes</Label>
            <Input id="month" name="month" type="month" defaultValue={selectedMonth} className="h-9 w-44" />
            <button className="h-9 rounded-lg border px-3 text-sm">Ver</button>
          </form>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Card className="xl:col-span-2 relative overflow-hidden border-l-4 border-l-sky-500 border-sky-500/10 bg-sky-500/[0.03] dark:bg-sky-500/[0.07]">
          <TrendingUp className="absolute -right-2 -top-2 size-24 text-sky-500/10 dark:text-sky-500/20" />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-sky-500/10 p-1.5 dark:bg-sky-500/20">
                <TrendingUp className="size-4 text-sky-600 dark:text-sky-400" />
              </div>
              <CardDescription className="font-medium text-sky-900/60 dark:text-sky-400/60">Ventas</CardDescription>
            </div>
            <CardTitle className="text-2xl pt-1">{moneyAr(revenue)}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-violet-500 border-violet-500/10 bg-violet-500/[0.03] dark:bg-violet-500/[0.07]">
          <ShoppingBag className="absolute -right-2 -top-2 size-24 text-violet-500/10 dark:text-violet-500/20" />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-violet-500/10 p-1.5 dark:bg-violet-500/20">
                <ShoppingBag className="size-4 text-violet-600 dark:text-violet-400" />
              </div>
              <CardDescription className="font-medium text-violet-900/60 dark:text-violet-400/60">Costo mercadería</CardDescription>
            </div>
            <CardTitle className="text-2xl pt-1">{moneyAr(cogs)}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-amber-500 border-amber-500/10 bg-amber-500/[0.03] dark:bg-amber-500/[0.07]">
          <Scale className="absolute -right-2 -top-2 size-24 text-amber-500/10 dark:text-amber-500/20" />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-500/10 p-1.5 dark:bg-amber-500/20">
                <Scale className="size-4 text-amber-600 dark:text-amber-400" />
              </div>
              <CardDescription className="font-medium text-amber-900/60 dark:text-amber-400/60">Margen bruto</CardDescription>
            </div>
            <CardTitle className="text-2xl pt-1">{moneyAr(grossProfit)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs font-bold text-amber-600 dark:text-amber-400">
            {pct(grossMarginPct)}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-l-4 border-l-slate-500 border-slate-500/10 bg-slate-500/[0.03] dark:bg-slate-500/[0.07]">
          <Receipt className="absolute -right-2 -top-2 size-24 text-slate-500/10 dark:text-slate-500/20" />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-slate-500/10 p-1.5 dark:bg-slate-500/20">
                <Receipt className="size-4 text-slate-600 dark:text-slate-400" />
              </div>
              <CardDescription className="font-medium text-slate-900/60 dark:text-slate-400/60">Gastos fijos</CardDescription>
            </div>
            <CardTitle className="text-2xl pt-1">{moneyAr(fixedExpensesTotal)}</CardTitle>
          </CardHeader>
        </Card>

        <Card className={cn(
          "relative overflow-hidden border-l-4 shadow-sm",
          netProfit >= 0 
            ? "border-l-emerald-500 border-emerald-500/10 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.07]" 
            : "border-l-rose-500 border-rose-500/10 bg-rose-500/[0.03] dark:bg-rose-500/[0.07]"
        )}>
          <Wallet className={cn(
            "absolute -right-2 -top-2 size-24",
            netProfit >= 0 ? "text-emerald-500/10 dark:text-emerald-500/20" : "text-rose-500/10 dark:text-rose-500/20"
          )} />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className={cn(
                "rounded-lg p-1.5",
                netProfit >= 0 ? "bg-emerald-500/10 dark:bg-emerald-500/20" : "bg-rose-500/10 dark:bg-rose-500/20"
              )}>
                <Wallet className={cn("size-4", netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")} />
              </div>
              <CardDescription className={cn(
                "font-medium",
                netProfit >= 0 ? "text-emerald-900/60 dark:text-emerald-400/60" : "text-rose-900/60 dark:text-rose-400/60"
              )}>Ganancia neta</CardDescription>
            </div>
            <CardTitle className="text-2xl pt-1">{moneyAr(netProfit)}</CardTitle>
          </CardHeader>
          <CardContent className={cn(
            "pt-0 text-xs font-bold",
            netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          )}>
            {pct(netMarginPct)}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Margen de ganancia neto</CardTitle>
            <CardDescription>KPI principal del período seleccionado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 md:items-center">
              <SpeedometerGauge value={netGauge} label="% neto" recommended="Objetivo recomendado: 15%+" />

              <div className="grid gap-3">
                <div className="rounded-xl border bg-card p-4">
                  <div className="text-xs text-muted-foreground">Resultado neto</div>
                  <div className={"mt-1 text-2xl font-semibold " + (netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    {moneyAr(netProfit)}
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="text-xs text-muted-foreground">Margen bruto</div>
                  <div className="mt-1 text-lg font-semibold">{moneyAr(grossProfit)} · {pct(grossMarginPct)}</div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="text-xs text-muted-foreground">Fórmula</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Ventas {moneyAr(revenue)} - Costo mercadería {moneyAr(cogs)} - Gastos {moneyAr(fixedExpensesTotal)}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">Reporte mensual del período seleccionado.</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gastos fijos</CardTitle>
            <CardDescription>Cargá tus costos del negocio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={createFixedExpense} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Concepto</Label>
                <Input id="name" name="name" placeholder="Alquiler, internet, sueldos..." required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="amount">Monto</Label>
                <Input id="amount" name="amount" type="number" step="0.01" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="frequency">Frecuencia</Label>
                <select id="frequency" name="frequency" className="h-10 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue="monthly">
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="category">Categoría (opcional)</Label>
                <Input id="category" name="category" placeholder="Operativo, administración..." />
              </div>
              <button className="h-10 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">Agregar gasto</button>
            </form>

            <div className="grid gap-2">
              {fixedExpenses.length === 0 ? (
                <div className="text-sm text-muted-foreground">No hay gastos fijos cargados.</div>
              ) : (
                fixedExpenses.map((e) => (
                  <div key={e.id} className="rounded-lg border p-2">
                    <div className="grid gap-2">
                      <form action={updateFixedExpense} className="grid gap-2 md:grid-cols-4">
                        <input type="hidden" name="id" value={e.id} />
                        <Input name="name" defaultValue={e.name} className="h-8 text-xs" />
                        <Input name="amount" type="number" step="0.01" defaultValue={toNum(e.amount)} className="h-8 text-xs" />
                        <select
                          name="frequency"
                          defaultValue={e.frequency}
                          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                        >
                          <option value="daily">Diario</option>
                          <option value="weekly">Semanal</option>
                          <option value="monthly">Mensual</option>
                        </select>
                        <Input name="category" defaultValue={e.category ?? ""} className="h-8 text-xs" placeholder="Categoría" />
                        <div className="md:col-span-4 flex items-center justify-between gap-2">
                          <div className="text-xs text-muted-foreground">
                            {moneyAr(toNum(e.amount))} · {translateFrequency(e.frequency)}
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="rounded-md border px-2 py-1 text-xs">Guardar</button>
                          </div>
                        </div>
                      </form>
                      <form action={deleteFixedExpense} className="flex justify-end">
                        <input type="hidden" name="id" value={e.id} />
                        <button className="rounded-md border px-2 py-1 text-xs">Eliminar</button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
