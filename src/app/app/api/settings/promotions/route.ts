import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { buildPaymentLabelMap } from "@/lib/business-payment-methods";

type PromotionKind = "ticket_amount" | "ticket_quantity" | "product_quantity";
type PromotionTargetMode = "products" | "categories";
type PromotionRuleProductRow = {
  product_id: string | null;
  products:
    | {
        name: string | null;
        barcode: string | null;
        sku: string | null;
        category: string | null;
      }
    | Array<{
        name: string | null;
        barcode: string | null;
        sku: string | null;
        category: string | null;
      }>
    | null;
};
type PromotionRuleRecord = {
  id: string;
  name: string | null;
  kind: PromotionKind;
  target_mode: PromotionTargetMode | null;
  category_filters: string[] | null;
  discount_percent: number | null;
  amount_min: number | null;
  amount_max: number | null;
  quantity_min: number | null;
  payment_methods: string[] | null;
  active: boolean | null;
  valid_from: string | null;
  valid_until: string | null;
  days_of_week: string[] | null;
  time_start: string | null;
  time_end: string | null;
  promotion_rule_products: PromotionRuleProductRow[] | null;
};
type PaymentMethodRecord = Parameters<typeof buildPaymentLabelMap>[0][number];
type ProductCategoryRow = { category: string | null };
type PromotionPayload = {
  business_id: string;
  name: string;
  kind: PromotionKind;
  target_mode: PromotionTargetMode;
  category_filters: string[] | null;
  discount_percent: number;
  active: boolean;
  payment_methods: string[] | null;
  amount_min?: number | null;
  amount_max?: number | null;
  quantity_min?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  days_of_week?: string[] | null;
  time_start?: string | null;
  time_end?: string | null;
};

function normalizeCategory(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeCategories(values: unknown) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(normalizeCategory).filter(Boolean)));
}

function normalizePromotionProduct(row: PromotionRuleProductRow) {
  const related = Array.isArray(row.products) ? row.products[0] ?? null : row.products;
  return {
    id: String(row.product_id),
    name: related?.name ? String(related.name) : null,
    barcode: related?.barcode ? String(related.barcode) : null,
    sku: related?.sku ? String(related.sku) : null,
    category: related?.category ? String(related.category) : null,
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: "Sesión expirada" }, { status: 401 });
  }

  const cookies = await import("next/headers").then((m) => m.cookies());
  const businessId = cookies.get("active_business_id")?.value;
  if (!businessId) {
    return NextResponse.json({ error: "No hay negocio activo" }, { status: 400 });
  }

  const { data: promos, error } = await supabase
    .from("promotion_rules")
    .select(
      "id,name,kind,target_mode,category_filters,discount_percent,amount_min,amount_max,quantity_min,active,payment_methods,valid_from,valid_until,days_of_week,time_start,time_end,promotion_rule_products(product_id,products(name,barcode,sku,category))"
    )
    .eq("business_id", businessId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: pmRows } = await supabase
    .from("business_payment_methods")
    .select("id,business_id,method_code,label,icon_key,icon_url,is_active,sort_order")
    .eq("business_id", businessId);

  const { data: categoriesRows } = await supabase
    .from("products")
    .select("category")
    .eq("business_id", businessId)
    .not("category", "is", null)
    .order("category", { ascending: true })
    .limit(1000);

  const paymentMethodLabels = buildPaymentLabelMap((pmRows ?? []) as PaymentMethodRecord[]);
  const availableCategories = Array.from(
    new Set(((categoriesRows ?? []) as ProductCategoryRow[]).map((row) => normalizeCategory(row.category)).filter(Boolean))
  );

  const rows =
    ((promos ?? []) as PromotionRuleRecord[]).map((r) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
      kind: r.kind as PromotionKind,
      target_mode: (r.target_mode as PromotionTargetMode | null) ?? "products",
      categories: normalizeCategories(r.category_filters),
      discount_percent: Number(r.discount_percent ?? 0),
      amount_min: r.amount_min != null ? Number(r.amount_min) : null,
      amount_max: r.amount_max != null ? Number(r.amount_max) : null,
      quantity_min: r.quantity_min != null ? Number(r.quantity_min) : null,
      payment_methods: Array.isArray(r.payment_methods) ? (r.payment_methods as string[]) : null,
      active: Boolean(r.active),
      valid_from: r.valid_from ?? null,
      valid_until: r.valid_until ?? null,
      days_of_week: Array.isArray(r.days_of_week) ? (r.days_of_week as string[]) : null,
      time_start: r.time_start ?? null,
      time_end: r.time_end ?? null,
      products:
        Array.isArray(r.promotion_rule_products) && r.promotion_rule_products.length
          ? r.promotion_rule_products.map(normalizePromotionProduct)
          : [],
    })) ?? [];

  return NextResponse.json({ rows, paymentMethodLabels, availableCategories });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    id?: string;
    name?: string;
    kind?: PromotionKind;
    target_mode?: PromotionTargetMode;
    categories?: string[] | null;
    discount_percent?: number;
    amount_min?: number | null;
    amount_max?: number | null;
    quantity_min?: number | null;
    payment_methods?: string[] | null;
    active?: boolean;
    valid_from?: string | null;
    valid_until?: string | null;
    days_of_week?: string[] | null;
    time_start?: string | null;
    time_end?: string | null;
    products?: { id: string; name?: string | null; barcode?: string | null; sku?: string | null; category?: string | null }[];
  };

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: "Sesión expirada" }, { status: 401 });
  }

  const cookies = await import("next/headers").then((m) => m.cookies());
  const businessId = cookies.get("active_business_id")?.value;
  if (!businessId) {
    return NextResponse.json({ error: "No hay negocio activo" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const kind: PromotionKind = body.kind ?? "ticket_amount";
  const targetMode: PromotionTargetMode = body.target_mode === "categories" ? "categories" : "products";
  const categoryFilters = normalizeCategories(body.categories);
  const discount = Number(body.discount_percent ?? 0);

  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }
  if (!Number.isFinite(discount) || discount <= 0 || discount > 100) {
    return NextResponse.json({ error: "El porcentaje debe estar entre 0 y 100" }, { status: 400 });
  }

  const payload: PromotionPayload = {
    business_id: businessId,
    name,
    kind,
    target_mode: targetMode,
    category_filters: kind === "product_quantity" && targetMode === "categories" && categoryFilters.length ? categoryFilters : null,
    discount_percent: discount,
    active: body.active ?? true,
    payment_methods: body.payment_methods && body.payment_methods.length ? body.payment_methods : null,
  };

  if (kind === "ticket_amount") {
    payload.amount_min = body.amount_min ?? 0;
    payload.amount_max = body.amount_max ?? null;
    payload.quantity_min = null;
  } else if (kind === "ticket_quantity") {
    payload.quantity_min = body.quantity_min ?? 1;
    payload.amount_min = null;
    payload.amount_max = null;
  } else if (kind === "product_quantity") {
    payload.quantity_min = body.quantity_min ?? 1;
    payload.amount_min = null;
    payload.amount_max = null;
  }

  payload.valid_from = body.valid_from ?? null;
  payload.valid_until = body.valid_until ?? null;
  payload.days_of_week = body.days_of_week && body.days_of_week.length ? body.days_of_week : null;
  payload.time_start = body.time_start ?? null;
  payload.time_end = body.time_end ?? null;

  const isInsert = !body.id || String(body.id).startsWith("temp-");

  const { data: upserted, error } = isInsert
    ? await supabase
        .from("promotion_rules")
        .insert(payload)
        .select(
          "id,name,kind,discount_percent,amount_min,amount_max,quantity_min,active,payment_methods,valid_from,valid_until,days_of_week,time_start,time_end"
        )
        .single()
    : await supabase
        .from("promotion_rules")
        .update(payload)
        .eq("id", body.id)
        .eq("business_id", businessId)
        .select(
          "id,name,kind,discount_percent,amount_min,amount_max,quantity_min,active,payment_methods,valid_from,valid_until,days_of_week,time_start,time_end"
        )
        .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ruleId = String((upserted as { id: string }).id);

  if (kind === "product_quantity" && targetMode === "products") {
    const products = Array.isArray(body.products) ? body.products : [];
    const uniqueIds = Array.from(new Set(products.map((p) => p.id).filter(Boolean)));

    await supabase.from("promotion_rule_products").delete().eq("promotion_id", ruleId);

    if (uniqueIds.length) {
      const rows = uniqueIds.map((pid) => ({ promotion_id: ruleId, product_id: pid }));
      await supabase.from("promotion_rule_products").insert(rows);
    }
  } else {
    await supabase.from("promotion_rule_products").delete().eq("promotion_id", ruleId);
  }

  const refetch = await supabase
    .from("promotion_rules")
    .select(
      "id,name,kind,target_mode,category_filters,discount_percent,amount_min,amount_max,quantity_min,active,payment_methods,valid_from,valid_until,days_of_week,time_start,time_end,promotion_rule_products(product_id,products(name,barcode,sku,category))"
    )
    .eq("id", ruleId)
    .maybeSingle();

  if (refetch.error || !refetch.data) {
    return NextResponse.json({ error: refetch.error?.message ?? "No se pudo recargar la promoción" }, { status: 500 });
  }

  const r = refetch.data as PromotionRuleRecord;

  const normalized = {
    id: String(r.id),
    name: String(r.name ?? ""),
    kind: r.kind as PromotionKind,
    target_mode: (r.target_mode as PromotionTargetMode | null) ?? "products",
    categories: normalizeCategories(r.category_filters),
    discount_percent: Number(r.discount_percent ?? 0),
    amount_min: r.amount_min != null ? Number(r.amount_min) : null,
    amount_max: r.amount_max != null ? Number(r.amount_max) : null,
    quantity_min: r.quantity_min != null ? Number(r.quantity_min) : null,
    payment_methods: Array.isArray(r.payment_methods) ? (r.payment_methods as string[]) : null,
    active: Boolean(r.active),
    valid_from: r.valid_from ?? null,
    valid_until: r.valid_until ?? null,
    days_of_week: Array.isArray(r.days_of_week) ? (r.days_of_week as string[]) : null,
    time_start: r.time_start ?? null,
    time_end: r.time_end ?? null,
    products:
      Array.isArray(r.promotion_rule_products) && r.promotion_rule_products.length
        ? r.promotion_rule_products.map(normalizePromotionProduct)
        : [],
  };

  return NextResponse.json({ row: normalized });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: "Sesión expirada" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = (url.searchParams.get("id") ?? "").trim();

  const cookies = await import("next/headers").then((m) => m.cookies());
  const businessId = cookies.get("active_business_id")?.value;
  if (!businessId) {
    return NextResponse.json({ error: "No hay negocio activo" }, { status: 400 });
  }

  if (!id) {
    return NextResponse.json({ error: "Falta id de promoción" }, { status: 400 });
  }

  const { error } = await supabase
    .from("promotion_rules")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
