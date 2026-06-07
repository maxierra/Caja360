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
import {
  ProductPerformanceClient,
  type ProductPerformancePayload,
  type ProductPerformanceRow,
  type ProductWithoutSalesRow,
} from "@/app/app/(main)/reports/product-performance-client";
import { ReportsExportButton } from "@/app/app/(main)/reports/reports-export-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getArgentinaDayRangeUtcIso, nextArgentinaDateYmd } from "@/lib/argentina-time";
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
  name?: string;
  quantity: number | string;
  total: number | string;
  created_at: string;
};

type ProductCostRow = {
  id: string;
  cost: number | string;
};

type ProductListRow = {
  id: string;
  name: string;
  active: boolean;
};

type FixedExpenseRow = {
  id: string;
  name: string;
  amount: number | string;
  frequency: "daily" | "weekly" | "monthly";
  category: string | null;
  active: boolean;
};

type CostLoadResult = {
  rows: ProductCostRow[];
  errorMessage: string | null;
};

type SaleItemsLoadResult = {
  rows: SaleItemRow[];
  errorMessage: string | null;
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

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function loadProductCostsChunked(
  supabase: Awaited<ReturnType<typeof createClient>>,
  uniqueProductIds: string[]
): Promise<CostLoadResult> {
  if (uniqueProductIds.length === 0) {
    return { rows: [], errorMessage: null };
  }

  const rows: ProductCostRow[] = [];
  const chunks = chunkArray(uniqueProductIds, 100);

  for (const ids of chunks) {
    const { data, error } = await supabase.from("products").select("id,cost").in("id", ids);
    if (error) {
      return {
        rows: [],
        errorMessage: `No se pudo calcular el costo de mercadería completo (${error.message}).`,
      };
    }
    rows.push(...((data ?? []) as ProductCostRow[]));
  }

  return { rows, errorMessage: null };
}

async function loadSaleItemsChunked(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  saleIds: string[],
  selectClause: string
): Promise<SaleItemsLoadResult> {
  if (saleIds.length === 0) {
    return { rows: [], errorMessage: null };
  }

  const rows: SaleItemRow[] = [];
  const chunks = chunkArray(saleIds, 100);

  for (const ids of chunks) {
    const { data, error } = await supabase
      .from("sale_items")
      .select(selectClause)
      .eq("business_id", businessId)
      .in("sale_id", ids);

    if (error) {
      return {
        rows: [],
        errorMessage: `No se pudieron cargar los productos vendidos del período (${error.message}).`,
      };
    }

    rows.push(...((data ?? []) as unknown as SaleItemRow[]));
  }

  return { rows, errorMessage: null };
}

function getMonthStartYmd(ymd: string) {
  return `${ymd.slice(0, 7)}-01`;
}

function getNextMonthStartYmd(ymd: string) {
  const [year, month] = ymd.slice(0, 7).split("-").map(Number);
  if (!year || !month) return ymd;
  if (month === 12) return `${String(year + 1).padStart(4, "0")}-01-01`;
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-01`;
}

function getWeekStartYmd(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1, 12, 0, 0, 0));
  const weekday = date.getUTCDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  return nextArgentinaDateYmd(ymd, -offset);
}

function getProductPeriodConfig(period: "day" | "week" | "month", anchorDate: string) {
  if (period === "week") {
    const startYmd = getWeekStartYmd(anchorDate);
    const endYmd = nextArgentinaDateYmd(startYmd, 7);
    return {
      startYmd,
      endYmd,
      startIso: `${startYmd}T00:00:00-03:00`,
      endIso: `${endYmd}T00:00:00-03:00`,
      title: `Semana del ${startYmd} al ${nextArgentinaDateYmd(endYmd, -1)}`,
    };
  }

  if (period === "month") {
    const startYmd = getMonthStartYmd(anchorDate);
    const endYmd = getNextMonthStartYmd(anchorDate);
    return {
      startYmd,
      endYmd,
      startIso: `${startYmd}T00:00:00-03:00`,
      endIso: `${endYmd}T00:00:00-03:00`,
      title: new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(
        new Date(`${startYmd}T12:00:00-03:00`)
      ),
    };
  }

  const { ymd, startIso, endExclusiveIso } = getArgentinaDayRangeUtcIso(anchorDate);
  return {
    startYmd: ymd,
    endYmd: nextArgentinaDateYmd(ymd, 1),
    startIso,
    endIso: endExclusiveIso,
    title: `Día ${ymd}`,
  };
}

function buildProductPerformance(
  items: SaleItemRow[],
  products: ProductListRow[],
  periodTitle: string,
  period: "day" | "week" | "month",
  metric: "quantity" | "revenue",
  anchorDate: string,
  startIso: string,
  endIso: string
): ProductPerformancePayload {
  const aggregated = new Map<
    string,
    { key: string; name: string; quantity: number; revenue: number; saleIds: Set<string> }
  >();

  for (const item of items) {
    const key = item.product_id ? `product:${item.product_id}` : `name:${String(item.name ?? "Producto sin nombre")}`;
    const existing = aggregated.get(key);
    const quantity = toNum(item.quantity);
    const revenue = toNum(item.total);

    if (!existing) {
      aggregated.set(key, {
        key,
        name: String((item as SaleItemRow & { name?: string }).name ?? "Producto sin nombre"),
        quantity,
        revenue,
        saleIds: new Set([item.sale_id]),
      });
      continue;
    }

    existing.quantity += quantity;
    existing.revenue += revenue;
    existing.saleIds.add(item.sale_id);
  }

  const totalRevenue = items.reduce((acc, item) => acc + toNum(item.total), 0);
  const totalUnits = items.reduce((acc, item) => acc + toNum(item.quantity), 0);
  const valueSelector = (row: { quantity: number; revenue: number }) => (metric === "quantity" ? row.quantity : row.revenue);

  const rows: ProductPerformanceRow[] = Array.from(aggregated.values()).map((row) => ({
    key: row.key,
    name: row.name,
    quantity: row.quantity,
    revenue: row.revenue,
    salesCount: row.saleIds.size,
    averagePerSale: row.saleIds.size > 0 ? row.revenue / row.saleIds.size : 0,
    share: totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0,
  }));

  rows.sort((a, b) => {
    const diff = valueSelector(b) - valueSelector(a);
    if (Math.abs(diff) > 0.0001) return diff;
    return b.revenue - a.revenue || a.name.localeCompare(b.name, "es");
  });

  const lowRows = [...rows].sort((a, b) => {
    const diff = valueSelector(a) - valueSelector(b);
    if (Math.abs(diff) > 0.0001) return diff;
    return a.revenue - b.revenue || a.name.localeCompare(b.name, "es");
  });

  const soldProductIds = new Set(
    items.map((item) => item.product_id).filter((value): value is string => Boolean(value))
  );

  const noSalesProducts: ProductWithoutSalesRow[] = products
    .filter((product) => product.active && !soldProductIds.has(product.id))
    .map((product) => ({ id: product.id, name: product.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return {
    period,
    metric,
    anchorDate,
    periodTitle,
    startIso,
    endIso,
    totalProductsSold: rows.length,
    totalUnits,
    totalRevenue,
    topProductName: rows[0]?.name ?? null,
    lowProductName: lowRows[0]?.name ?? null,
    topProducts: rows,
    lowProducts: lowRows,
    noSalesProducts,
  };
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
  searchParams?: Promise<{
    month?: string;
    productsPeriod?: string;
    productsDate?: string;
    productsMetric?: string;
  }>;
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
  const productsPeriod =
    sp.productsPeriod === "day" || sp.productsPeriod === "week" || sp.productsPeriod === "month"
      ? sp.productsPeriod
      : "day";
  const productsMetric = sp.productsMetric === "revenue" ? "revenue" : "quantity";
  const productsAnchorDate =
    typeof sp.productsDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.productsDate)
      ? sp.productsDate
      : currentArYmd;
  const productPeriodConfig = getProductPeriodConfig(productsPeriod, productsAnchorDate);

  const supabase = await createClient();
  const [{ data: salesData }, { data: fixedExpensesData }, { data: productSalesData }, { data: productsListData }] = await Promise.all([
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
    supabase
      .from("sales")
      .select("id,status")
      .eq("business_id", businessId)
      .eq("status", "paid")
      .gte("created_at", productPeriodConfig.startIso)
      .lt("created_at", productPeriodConfig.endIso),
    supabase
      .from("products")
      .select("id,name,active")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("name", { ascending: true }),
  ]);

  const sales = (salesData ?? []) as SaleRow[];
  const paidSales = sales.filter((s) => s.status === "paid");
  const paidSaleIds = paidSales.map((s) => s.id);
  const { rows: items, errorMessage: itemsLoadError } = await loadSaleItemsChunked(
    supabase,
    businessId,
    paidSaleIds,
    "sale_id,product_id,quantity,total,created_at"
  );
  const fixedExpenses = (fixedExpensesData ?? []) as FixedExpenseRow[];
  const productSales = (productSalesData ?? []) as Array<{ id: string; status: string }>;
  const productsList = (productsListData ?? []) as ProductListRow[];

  const productPaidSaleIds = productSales.map((sale) => sale.id);
  const { rows: productItems, errorMessage: productItemsLoadError } = await loadSaleItemsChunked(
    supabase,
    businessId,
    productPaidSaleIds,
    "sale_id,product_id,name,quantity,total,created_at"
  );
  const productPerformance = buildProductPerformance(
    productItems,
    productsList,
    productPeriodConfig.title,
    productsPeriod,
    productsMetric,
    productsAnchorDate,
    productPeriodConfig.startIso,
    productPeriodConfig.endIso
  );

  const uniqueProductIds = Array.from(new Set(items.map((x) => x.product_id).filter(Boolean))) as string[];
  const { rows: productsCost, errorMessage: costLoadError } = await loadProductCostsChunked(
    supabase,
    uniqueProductIds
  );
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

      {costLoadError ? (
        <div className="mt-4 rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">No se pudo calcular correctamente el costo de mercadería</p>
          <p className="mt-1 text-destructive/90">
            {costLoadError} Revisá este período nuevamente o intentá con un rango más corto mientras seguimos mejorando este reporte.
          </p>
        </div>
      ) : null}

      {itemsLoadError ? (
        <div className="mt-4 rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">No se pudo cargar el detalle de ventas para este período</p>
          <p className="mt-1 text-destructive/90">
            {itemsLoadError} Sin ese detalle, el costo de mercadería puede verse en cero.
          </p>
        </div>
      ) : null}

      {productItemsLoadError ? (
        <div className="mt-4 rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">No se pudo cargar el ranking completo de productos</p>
          <p className="mt-1 text-destructive/90">
            {productItemsLoadError} Probá con un período más corto si necesitás revisar solo productos vendidos.
          </p>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">Consulta de productos vendidos</div>
            <div className="text-xs text-muted-foreground">
              Elegí período y fecha base. El ranking arranca en top 10, pero lo podés expandir.
            </div>
          </div>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="month" value={selectedMonth} />
            <div className="grid gap-1">
              <Label htmlFor="productsPeriod" className="text-xs text-muted-foreground">Período</Label>
              <select
                id="productsPeriod"
                name="productsPeriod"
                defaultValue={productsPeriod}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="day">Día</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="productsDate" className="text-xs text-muted-foreground">Fecha base</Label>
              <Input
                id="productsDate"
                name="productsDate"
                type="date"
                defaultValue={productsAnchorDate}
                className="h-9 w-44"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="productsMetric" className="text-xs text-muted-foreground">Ordenar por</Label>
              <select
                id="productsMetric"
                name="productsMetric"
                defaultValue={productsMetric}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="quantity">Cantidad</option>
                <option value="revenue">Facturación</option>
              </select>
            </div>
            <button className="h-9 rounded-lg border px-3 text-sm">Consultar</button>
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

      <ProductPerformanceClient data={productPerformance} />

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
