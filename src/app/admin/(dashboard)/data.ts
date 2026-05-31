import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailIsPlatformAdmin } from "@/lib/platform-admin";
import { parseDbTimestamptzMs } from "@/lib/parse-db-timestamp";
import { DESKTOP_DOWNLOAD_ASSET_KEY } from "@/lib/desktop-download";
import { businessHasAppAccess, type SubscriptionRow } from "@/lib/subscription";

export type AdminLastPayment = {
  provider: string;
  status: string;
  amount: number;
  currency: string;
  created_at: string;
};

export type AdminSubscriptionListItem = {
  subscriptionId: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  planId: string;
  status: string;
  provider: string;
  currentPeriodEnd: string | null;
  /** ms UTC; misma lógica que el middleware para comparar “ya venció” */
  currentPeriodEndMs: number | null;
  updatedAt: string;
  hasAppAccess: boolean;
  /** Cómo se interpreta el cobro para el operador */
  billingSummary:
    | "mp_automatico"
    | "manual_admin"
    | "solo_prueba"
    | "sin_pagos_registrados"
    | "suspendido_admin";
  lastPayment: AdminLastPayment | null;
};

function billingSummaryFromRow(
  sub: SubscriptionRow & { provider: string },
  last: AdminLastPayment | null
): AdminSubscriptionListItem["billingSummary"] {
  if (sub.provider === "admin_suspended") return "suspendido_admin";
  if (sub.status === "trialing") return "solo_prueba";
  if (last?.status === "approved" && last.provider === "manual_transfer") return "manual_admin";
  if (last?.status === "approved" && last.provider === "mercadopago") return "mp_automatico";
  if (sub.provider === "manual_transfer") return "manual_admin";
  if (sub.provider === "mercadopago" && sub.status === "active") return "mp_automatico";
  return "sin_pagos_registrados";
}

export type LoadAdminSubscriptionsResult =
  | { ok: false; error: "forbidden" | "config"; message?: string }
  | { ok: true; rows: AdminSubscriptionListItem[] };

export type AdminDownloadStats = {
  total: number;
  last7d: number;
  last24h: number;
  lastEventAt: string | null;
};

export type LoadAdminDownloadStatsResult =
  | { ok: false; error: "forbidden" | "config"; message?: string }
  | { ok: true; stats: AdminDownloadStats };

export type AdminDailyActivityPoint = {
  day: string;
  registrations: number;
  convertedAfter7d: number;
  productActiveBusinesses: number;
  productsCreated: number;
  salesActiveBusinesses: number;
  paidSalesCount: number;
  paidSalesAmount: number;
};

export type AdminRecentRegistrationRow = {
  businessId: string;
  businessName: string;
  createdAt: string;
  ageDays: number;
  hasProducts: boolean;
  hasPaidSales: boolean;
  productsCreatedInMonth: number;
  paidSalesCountInMonth: number;
  hasApprovedPayment: boolean;
  convertedAfter7d: boolean;
  currentSubscriptionStatus: SubscriptionRow["status"] | "none";
  currentPlanId: string | null;
  hasAppAccess: boolean;
  lastProductAt: string | null;
  lastSaleAt: string | null;
  lastPaymentAt: string | null;
};

export type AdminConversionDashboard = {
  selectedMonth: string;
  availableMonths: string[];
  monthLabel: string;
  monthRegistrations: number;
  monthWithProducts: number;
  monthWithSales: number;
  monthPaidBusinesses: number;
  monthNoActivity: number;
  monthWithProductsPct: number;
  monthWithSalesPct: number;
  monthPaidPct: number;
  last7dRegistrations: number;
  last30dRegistrations: number;
  last30dNoActivity: number;
  last30dWithProducts: number;
  last30dWithSales: number;
  eligibleFor7dConversion: number;
  convertedAfter7d: number;
  conversionAfter7dPct: number;
  daily: AdminDailyActivityPoint[];
  recent: AdminRecentRegistrationRow[];
};

export type LoadAdminConversionDashboardResult =
  | { ok: false; error: "forbidden" | "config"; message?: string }
  | { ok: true; data: AdminConversionDashboard };

/**
 * Solo llamar desde Server Components después de comprobar admin en UI,
 * o confiar en la verificación interna (duplicada).
 */
export async function loadAdminSubscriptionList(): Promise<LoadAdminSubscriptionsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !emailIsPlatformAdmin(user.email)) {
    return { ok: false, error: "forbidden" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "config", message: "Falta SUPABASE_SERVICE_ROLE_KEY." };
  }

  const { data: subRows, error: subErr } = await admin
    .from("subscriptions")
    .select(
      "id, business_id, plan_id, status, current_period_start, current_period_end, provider, updated_at, businesses(name, slug)"
    )
    .order("updated_at", { ascending: false })
    .limit(300);

  if (subErr) {
    return { ok: false, error: "config", message: subErr.message };
  }

  const { data: payRows, error: payErr } = await admin
    .from("payments")
    .select("business_id, provider, status, amount, currency, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (payErr && process.env.NODE_ENV === "development") {
    console.warn("[loadAdminSubscriptionList] payments", payErr.message);
  }

  const lastByBusiness = new Map<string, AdminLastPayment>();
  for (const p of payRows ?? []) {
    const bid = (p as { business_id: string }).business_id;
    if (!bid || lastByBusiness.has(bid)) continue;
    const row = p as {
      business_id: string;
      provider: string;
      status: string;
      amount: number | string;
      currency: string;
      created_at: string;
    };
    lastByBusiness.set(bid, {
      provider: row.provider,
      status: row.status,
      amount: typeof row.amount === "number" ? row.amount : Number.parseFloat(String(row.amount)),
      currency: row.currency,
      created_at: row.created_at,
    });
  }

  const rows: AdminSubscriptionListItem[] = (subRows ?? []).map((raw) => {
    const r = raw as {
      id: string;
      business_id: string;
      plan_id: string;
      status: SubscriptionRow["status"];
      current_period_end: string | null;
      provider: string;
      updated_at: string;
      businesses: { name: string; slug: string } | { name: string; slug: string }[] | null;
    };

    const biz = Array.isArray(r.businesses) ? r.businesses[0] : r.businesses;
    const subRow: SubscriptionRow = {
      status: r.status,
      current_period_start: null,
      current_period_end: r.current_period_end,
      plan_id: r.plan_id,
    };
    const last = lastByBusiness.get(r.business_id) ?? null;

    return {
      subscriptionId: r.id,
      businessId: r.business_id,
      businessName: biz?.name ?? "—",
      businessSlug: biz?.slug ?? "—",
      planId: r.plan_id,
      status: r.status,
      provider: r.provider,
      currentPeriodEnd: r.current_period_end,
      currentPeriodEndMs: parseDbTimestamptzMs(r.current_period_end),
      updatedAt: r.updated_at,
      hasAppAccess: businessHasAppAccess(subRow),
      billingSummary: billingSummaryFromRow({ ...subRow, provider: r.provider }, last),
      lastPayment: last,
    };
  });

  return { ok: true, rows };
}

/**
 * Métricas de descargas del instalador desktop (landing -> redirect API).
 */
export async function loadAdminDownloadStats(): Promise<LoadAdminDownloadStatsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !emailIsPlatformAdmin(user.email)) {
    return { ok: false, error: "forbidden" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "config", message: "Falta SUPABASE_SERVICE_ROLE_KEY." };
  }

  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, dayRes, weekRes, lastRes] = await Promise.all([
    admin
      .from("download_events")
      .select("id", { count: "exact", head: true })
      .eq("asset_key", DESKTOP_DOWNLOAD_ASSET_KEY),
    admin
      .from("download_events")
      .select("id", { count: "exact", head: true })
      .eq("asset_key", DESKTOP_DOWNLOAD_ASSET_KEY)
      .gte("created_at", since24h),
    admin
      .from("download_events")
      .select("id", { count: "exact", head: true })
      .eq("asset_key", DESKTOP_DOWNLOAD_ASSET_KEY)
      .gte("created_at", since7d),
    admin
      .from("download_events")
      .select("created_at")
      .eq("asset_key", DESKTOP_DOWNLOAD_ASSET_KEY)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const firstError = totalRes.error ?? dayRes.error ?? weekRes.error ?? lastRes.error;
  if (firstError) {
    return { ok: false, error: "config", message: firstError.message };
  }

  return {
    ok: true,
    stats: {
      total: totalRes.count ?? 0,
      last24h: dayRes.count ?? 0,
      last7d: weekRes.count ?? 0,
      lastEventAt: (lastRes.data as { created_at: string } | null)?.created_at ?? null,
    },
  };
}

function dayKeyAr(value: string | number | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function monthKeyAr(value: string | number | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(value));
}

function daysSince(iso: string, nowMs: number) {
  const ms = parseDbTimestamptzMs(iso);
  if (ms == null) return 0;
  return Math.max(0, Math.floor((nowMs - ms) / (24 * 60 * 60 * 1000)));
}

function normalizeMonthKey(value: string | undefined | null, fallbackDate: Date) {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  return monthKeyAr(fallbackDate);
}

function monthWindowUtc(monthKey: string) {
  const [yStr, mStr] = monthKey.split("-");
  const year = Number.parseInt(yStr ?? "", 10);
  const month = Number.parseInt(mStr ?? "", 10);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start, end };
}

function monthLabelEs(monthKey: string) {
  const [yStr, mStr] = monthKey.split("-");
  const year = Number.parseInt(yStr ?? "", 10);
  const month = Number.parseInt(mStr ?? "", 10);
  const d = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0, 0));
  return d.toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export async function loadAdminConversionDashboard(selectedMonth?: string): Promise<LoadAdminConversionDashboardResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !emailIsPlatformAdmin(user.email)) {
    return { ok: false, error: "forbidden" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "config", message: "Falta SUPABASE_SERVICE_ROLE_KEY." };
  }

  const nowMs = Date.now();
  const selectedMonthKey = normalizeMonthKey(selectedMonth, new Date(nowMs));
  const { start: monthStart, end: monthEnd } = monthWindowUtc(selectedMonthKey);
  const since30d = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since90d = new Date(nowMs - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [bizRes, productsRes, salesRes, payRes, subRes] = await Promise.all([
    admin.from("businesses").select("id,name,created_at").order("created_at", { ascending: false }).limit(2000),
    admin.from("products").select("business_id,created_at").gte("created_at", since90d).limit(40000),
    admin
      .from("sales")
      .select("business_id,created_at,total,status")
      .eq("status", "paid")
      .gte("created_at", since90d)
      .limit(50000),
    admin
      .from("payments")
      .select("business_id,created_at,status,amount")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(30000),
    admin
      .from("subscriptions")
      .select("business_id,status,current_period_start,current_period_end,plan_id")
      .order("updated_at", { ascending: false })
      .limit(4000),
  ]);

  const firstError = bizRes.error ?? productsRes.error ?? salesRes.error ?? payRes.error ?? subRes.error;
  if (firstError) {
    return { ok: false, error: "config", message: firstError.message };
  }

  const businesses = (bizRes.data ?? []) as Array<{ id: string; name: string | null; created_at: string }>;
  const products = (productsRes.data ?? []) as Array<{ business_id: string; created_at: string }>;
  const sales = (salesRes.data ?? []) as Array<{ business_id: string; created_at: string; total: number | string }>;
  const payments = (payRes.data ?? []) as Array<{ business_id: string; created_at: string; amount: number | string }>;
  const subRows = (subRes.data ?? []) as Array<{
    business_id: string;
    status: SubscriptionRow["status"];
    current_period_start: string | null;
    current_period_end: string | null;
    plan_id: string;
  }>;

  const productBizSet = new Set<string>();
  const saleBizSet = new Set<string>();
  const lastProductAt = new Map<string, string>();
  const lastSaleAt = new Map<string, string>();
  const earliestApprovedPaymentAt = new Map<string, string>();
  const monthProductsCountByBusiness = new Map<string, number>();
  const monthSalesCountByBusiness = new Map<string, number>();
  const monthPaidBizSet = new Set<string>();
  const subByBusiness = new Map<
    string,
    {
      status: SubscriptionRow["status"];
      current_period_start: string | null;
      current_period_end: string | null;
      plan_id: string;
      hasAppAccess: boolean;
    }
  >();

  const dailyMap = new Map<string, AdminDailyActivityPoint>();
  const cursor = new Date(monthStart);
  while (cursor < monthEnd) {
    const day = dayKeyAr(cursor.toISOString());
    dailyMap.set(day, {
      day,
      registrations: 0,
      convertedAfter7d: 0,
      productActiveBusinesses: 0,
      productsCreated: 0,
      salesActiveBusinesses: 0,
      paidSalesCount: 0,
      paidSalesAmount: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const dailyProductBusinesses = new Map<string, Set<string>>();
  for (const p of products) {
    if (!p.business_id || !p.created_at) continue;
    productBizSet.add(p.business_id);
    if (!lastProductAt.has(p.business_id) || p.created_at > String(lastProductAt.get(p.business_id))) {
      lastProductAt.set(p.business_id, p.created_at);
    }
    const day = dayKeyAr(p.created_at);
    if (monthKeyAr(p.created_at) === selectedMonthKey) {
      monthProductsCountByBusiness.set(p.business_id, (monthProductsCountByBusiness.get(p.business_id) ?? 0) + 1);
    }
    const point = dailyMap.get(day);
    if (point) {
      point.productsCreated += 1;
      if (!dailyProductBusinesses.has(day)) dailyProductBusinesses.set(day, new Set<string>());
      dailyProductBusinesses.get(day)!.add(p.business_id);
    }
  }

  const dailySaleBusinesses = new Map<string, Set<string>>();
  for (const s of sales) {
    if (!s.business_id || !s.created_at) continue;
    saleBizSet.add(s.business_id);
    if (!lastSaleAt.has(s.business_id) || s.created_at > String(lastSaleAt.get(s.business_id))) {
      lastSaleAt.set(s.business_id, s.created_at);
    }
    const day = dayKeyAr(s.created_at);
    if (monthKeyAr(s.created_at) === selectedMonthKey) {
      monthSalesCountByBusiness.set(s.business_id, (monthSalesCountByBusiness.get(s.business_id) ?? 0) + 1);
    }
    const point = dailyMap.get(day);
    if (point) {
      point.paidSalesCount += 1;
      const amount = typeof s.total === "number" ? s.total : Number.parseFloat(String(s.total ?? 0));
      point.paidSalesAmount += Number.isFinite(amount) ? amount : 0;
      if (!dailySaleBusinesses.has(day)) dailySaleBusinesses.set(day, new Set<string>());
      dailySaleBusinesses.get(day)!.add(s.business_id);
    }
  }

  for (const p of payments) {
    if (!p.business_id || !p.created_at) continue;
    const prev = earliestApprovedPaymentAt.get(p.business_id);
    if (!prev || p.created_at < prev) {
      earliestApprovedPaymentAt.set(p.business_id, p.created_at);
    }
    if (monthKeyAr(p.created_at) === selectedMonthKey) {
      monthPaidBizSet.add(p.business_id);
    }
  }

  for (const s of subRows) {
    if (!s.business_id || subByBusiness.has(s.business_id)) continue;
    const sub: SubscriptionRow = {
      status: s.status,
      current_period_start: s.current_period_start,
      current_period_end: s.current_period_end,
      plan_id: s.plan_id,
    };
    subByBusiness.set(s.business_id, {
      status: s.status,
      current_period_start: s.current_period_start,
      current_period_end: s.current_period_end,
      plan_id: s.plan_id,
      hasAppAccess: businessHasAppAccess(sub),
    });
  }

  let last7dRegistrations = 0;
  let last30dRegistrations = 0;
  let last30dNoActivity = 0;
  let last30dWithProducts = 0;
  let last30dWithSales = 0;
  let eligibleFor7dConversion = 0;
  let convertedAfter7d = 0;
  let monthRegistrations = 0;
  let monthWithProducts = 0;
  let monthWithSales = 0;
  let monthNoActivity = 0;

  const availableMonthsSet = new Set<string>();
  const recent: AdminRecentRegistrationRow[] = [];
  for (const b of businesses) {
    if (!b.id || !b.created_at) continue;
    const createdMs = parseDbTimestamptzMs(b.created_at);
    if (createdMs == null) continue;
    const createdMonth = monthKeyAr(b.created_at);
    availableMonthsSet.add(createdMonth);
    const ageDays = daysSince(b.created_at, nowMs);
    const hasProducts = productBizSet.has(b.id);
    const hasPaidSales = saleBizSet.has(b.id);

    if (createdMs >= nowMs - 7 * 24 * 60 * 60 * 1000) last7dRegistrations += 1;
    if (createdMs >= nowMs - 30 * 24 * 60 * 60 * 1000) {
      last30dRegistrations += 1;
      if (!hasProducts && !hasPaidSales) last30dNoActivity += 1;
      if (hasProducts) last30dWithProducts += 1;
      if (hasPaidSales) last30dWithSales += 1;
    }

    const monthProducts = monthProductsCountByBusiness.get(b.id) ?? 0;
    const monthSales = monthSalesCountByBusiness.get(b.id) ?? 0;
    if (createdMonth === selectedMonthKey) {
      monthRegistrations += 1;
      if (monthProducts > 0) monthWithProducts += 1;
      if (monthSales > 0) monthWithSales += 1;
      if (monthProducts === 0 && monthSales === 0) monthNoActivity += 1;
    }

    const firstPaymentAt = earliestApprovedPaymentAt.get(b.id) ?? null;
    const firstPaymentMs = firstPaymentAt ? parseDbTimestamptzMs(firstPaymentAt) : null;
    const sub = subByBusiness.get(b.id);
    const converted = firstPaymentMs != null && firstPaymentMs >= createdMs + 7 * 24 * 60 * 60 * 1000;
    if (ageDays >= 7) {
      eligibleFor7dConversion += 1;
      if (converted) convertedAfter7d += 1;
    }

    const regPoint = dailyMap.get(dayKeyAr(b.created_at));
    if (regPoint) {
      regPoint.registrations += 1;
      if (converted) regPoint.convertedAfter7d += 1;
    }

    if (recent.length < 40) {
      recent.push({
        businessId: b.id,
        businessName: b.name ?? "Sin nombre",
        createdAt: b.created_at,
        ageDays,
        hasProducts,
        hasPaidSales,
        productsCreatedInMonth: monthProducts,
        paidSalesCountInMonth: monthSales,
        hasApprovedPayment: firstPaymentAt != null,
        convertedAfter7d: converted,
        currentSubscriptionStatus: sub?.status ?? "none",
        currentPlanId: sub?.plan_id ?? null,
        hasAppAccess: sub?.hasAppAccess ?? true,
        lastProductAt: lastProductAt.get(b.id) ?? null,
        lastSaleAt: lastSaleAt.get(b.id) ?? null,
        lastPaymentAt: firstPaymentAt,
      });
    }
  }

  for (const [day, set] of dailyProductBusinesses) {
    const point = dailyMap.get(day);
    if (point) point.productActiveBusinesses = set.size;
  }
  for (const [day, set] of dailySaleBusinesses) {
    const point = dailyMap.get(day);
    if (point) point.salesActiveBusinesses = set.size;
  }

  const conversionAfter7dPct =
    eligibleFor7dConversion > 0 ? (convertedAfter7d / eligibleFor7dConversion) * 100 : 0;
  const monthWithProductsPct = monthRegistrations > 0 ? (monthWithProducts / monthRegistrations) * 100 : 0;
  const monthWithSalesPct = monthRegistrations > 0 ? (monthWithSales / monthRegistrations) * 100 : 0;
  const monthPaidBusinesses = businesses.filter(
    (b) => monthKeyAr(b.created_at) === selectedMonthKey && monthPaidBizSet.has(b.id)
  ).length;
  const monthPaidPct = monthRegistrations > 0 ? (monthPaidBusinesses / monthRegistrations) * 100 : 0;
  const availableMonths = Array.from(availableMonthsSet).sort((a, b) => (a < b ? 1 : -1)).slice(0, 12);
  if (!availableMonths.includes(selectedMonthKey)) availableMonths.unshift(selectedMonthKey);

  return {
    ok: true,
    data: {
      selectedMonth: selectedMonthKey,
      availableMonths,
      monthLabel: monthLabelEs(selectedMonthKey),
      monthRegistrations,
      monthWithProducts,
      monthWithSales,
      monthPaidBusinesses,
      monthNoActivity,
      monthWithProductsPct,
      monthWithSalesPct,
      monthPaidPct,
      last7dRegistrations,
      last30dRegistrations,
      last30dNoActivity,
      last30dWithProducts,
      last30dWithSales,
      eligibleFor7dConversion,
      convertedAfter7d,
      conversionAfter7dPct,
      daily: Array.from(dailyMap.values()),
      recent,
    },
  };
}
