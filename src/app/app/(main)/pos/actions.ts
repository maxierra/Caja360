"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createMonitoredAction } from "@/lib/action-wrapper";
import { createClient } from "@/lib/supabase/server";

type CheckoutItem = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
};

type AppliedPromotion = {
  ruleId: string;
  name: string;
  discountPercent: number;
  discountAmount: number;
  kind: "ticket_amount" | "ticket_quantity" | "product_quantity";
  targetMode?: "products" | "categories";
} | null;
type PosSupabaseClient = Awaited<ReturnType<typeof createClient>>;
type CheckoutPaymentDetails = {
  split?: Array<{ method: "cash" | "card" | "transfer" | "mercadopago" | "cuenta_corriente"; amount: number }>;
  cash_received?: number;
  promotion?: {
    rule_id: string;
    name: string;
    target_mode: "products" | "categories" | null;
    percent: number;
    amount: number;
    total_before: number;
    total_after: number;
  };
};

async function evaluatePromotionForCart(params: {
  supabase: PosSupabaseClient;
  businessId: string;
  items: CheckoutItem[];
  payment_method: "cash" | "card" | "transfer" | "mercadopago" | "cuenta_corriente" | "mixed";
}) {
  const { supabase, businessId, items, payment_method } = params;

  const totalBeforeDiscount = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
  const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);

  type RawRule = {
    id: string;
    name: string;
    kind: "ticket_amount" | "ticket_quantity" | "product_quantity";
    target_mode: "products" | "categories" | null;
    category_filters: string[] | null;
    discount_percent: number;
    amount_min: number | null;
    amount_max: number | null;
    quantity_min: number | null;
    payment_methods: string[] | null;
    active: boolean;
    valid_from: string | null;
    valid_until: string | null;
    days_of_week: string[] | null;
    time_start: string | null;
    time_end: string | null;
    promotion_rule_products: { product_id: string | null }[] | null;
  };

  let appliedPromotion: AppliedPromotion = null;

  try {
    const itemProductIds = Array.from(new Set(items.map((item) => item.product_id).filter(Boolean)));
    const { data: productRows } = itemProductIds.length
      ? await supabase.from("products").select("id,category").eq("business_id", businessId).in("id", itemProductIds)
      : { data: [] as Array<{ id: string; category: string | null }> };
    const categoryByProductId = new Map(
      ((productRows ?? []) as Array<{ id: string; category: string | null }>).map((row) => [
        String(row.id),
        String(row.category ?? "").trim().toLowerCase(),
      ])
    );

    const now = new Date();
    const nowMs = now.getTime();

    const arParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Argentina/Buenos_Aires",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const weekdayShort = (arParts.find((p) => p.type === "weekday")?.value ?? "mon").toLowerCase();
    const weekdayMap: Record<string, string> = {
      mon: "mon",
      tue: "tue",
      wed: "wed",
      thu: "thu",
      fri: "fri",
      sat: "sat",
      sun: "sun",
    };
    const weekdayKey =
      weekdayMap[weekdayShort.slice(0, 3) as keyof typeof weekdayMap] ?? weekdayMap.mon;

    const hour = arParts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = arParts.find((p) => p.type === "minute")?.value ?? "00";
    const timeStr = `${hour}:${minute}`;

    const { data: rawRules, error: rulesErr } = await supabase
      .from("promotion_rules")
      .select(
        "id,name,kind,target_mode,category_filters,discount_percent,amount_min,amount_max,quantity_min,active,payment_methods,valid_from,valid_until,days_of_week,time_start,time_end,promotion_rule_products(product_id)"
      )
      .eq("business_id", businessId)
      .eq("active", true)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });

    if (rulesErr) {
      console.warn("[promotions] error loading rules:", rulesErr.message);
    } else {
      const rules = (rawRules ?? []) as RawRule[];
      const paymentMethod = payment_method;

      const findApplied = () => {
        for (const r of rules) {
          if (!r.active) continue;

          const fromMs = r.valid_from ? Date.parse(r.valid_from) : null;
          const untilMs = r.valid_until ? Date.parse(r.valid_until) : null;
          if (fromMs != null && nowMs < fromMs) continue;
          if (untilMs != null && nowMs > untilMs) continue;

          if (r.days_of_week && r.days_of_week.length > 0 && !r.days_of_week.includes(weekdayKey))
            continue;

          if (r.time_start && timeStr < r.time_start.slice(0, 5)) continue;
          if (r.time_end && timeStr > r.time_end.slice(0, 5)) continue;

          if (
            r.payment_methods &&
            r.payment_methods.length > 0 &&
            !r.payment_methods.includes(paymentMethod)
          ) {
            continue;
          }

          if (r.kind === "ticket_amount") {
            const min = r.amount_min ?? 0;
            const max = r.amount_max ?? Number.POSITIVE_INFINITY;
            if (totalBeforeDiscount < min || totalBeforeDiscount > max) continue;
          } else if (r.kind === "ticket_quantity") {
            const qMin = r.quantity_min ?? 1;
            if (totalQuantity < qMin) continue;
          } else if (r.kind === "product_quantity") {
            const qMin = r.quantity_min ?? 1;
            const targetMode = r.target_mode === "categories" ? "categories" : "products";
            const allowedProducts = (r.promotion_rule_products ?? [])
              .map((p) => p.product_id)
              .filter((id): id is string => !!id);
            const allowedCategories = (r.category_filters ?? [])
              .map((category) => String(category ?? "").trim().toLowerCase())
              .filter(Boolean);

            const matchingItems = items.filter((it) =>
              targetMode === "categories"
                ? allowedCategories.includes(categoryByProductId.get(it.product_id) ?? "")
                : allowedProducts.includes(it.product_id)
            );
            if (!matchingItems.length) continue;

            const matchingQty = matchingItems.reduce((sum, it) => sum + it.quantity, 0);
            if (matchingQty < qMin) continue;
          }

          const percent = Math.max(0, Math.min(100, Number(r.discount_percent ?? 0)));
          if (!percent) continue;

          const base =
            r.kind === "product_quantity"
              ? items
                  .filter((it) => {
                    const targetMode = r.target_mode === "categories" ? "categories" : "products";
                    if (targetMode === "categories") {
                      const allowedCategories = (r.category_filters ?? [])
                        .map((category) => String(category ?? "").trim().toLowerCase())
                        .filter(Boolean);
                      return allowedCategories.includes(categoryByProductId.get(it.product_id) ?? "");
                    }

                    const allowedProducts = (r.promotion_rule_products ?? [])
                      .map((p) => p.product_id)
                      .filter((id): id is string => !!id);
                    return allowedProducts.includes(it.product_id);
                  })
                  .reduce((sum, it) => sum + it.unit_price * it.quantity, 0)
              : totalBeforeDiscount;

          if (!base) continue;

          const discountAmount = Math.round(base * (percent / 100) * 100) / 100;

          return {
            ruleId: r.id,
            name: r.name,
            discountPercent: percent,
            discountAmount,
            kind: r.kind,
            targetMode: r.target_mode === "categories" ? "categories" : "products",
          } as AppliedPromotion;
        }
        return null;
      };

      appliedPromotion = findApplied();

      if (process.env.NODE_ENV === "development") {
        console.log("[promotions] evaluation", {
          businessId,
          payment_method,
          totalBeforeDiscount,
          totalQuantity,
          rulesCount: rules.length,
          argentina_time: timeStr,
          applied: appliedPromotion,
        });
      }
    }
  } catch (e) {
    console.warn("[promotions] unexpected error evaluating rules:", e);
  }

  return { appliedPromotion, totalBeforeDiscount, totalQuantity };
}

async function checkoutSaleImpl(input: {
  payment_method: "cash" | "card" | "transfer" | "mercadopago" | "cuenta_corriente" | "mixed";
  payment_details?: {
    split?: Array<{ method: "cash" | "card" | "transfer" | "mercadopago" | "cuenta_corriente"; amount: number }>;
    cash_received?: number;
  };
  cash_received?: number;
  customer_id?: string | null;
  items: CheckoutItem[];
}) {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;

  if (!businessId) {
    throw new Error("missing_active_business_id");
  }

  if (!input.items || input.items.length === 0) {
    throw new Error("empty_items");
  }

  const items = input.items.map((i) => ({
    product_id: i.product_id,
    name: i.name,
    quantity: i.quantity,
    unit_price: i.unit_price,
  }));

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const cashierUserId = userData.user?.id ?? null;

  const { appliedPromotion, totalBeforeDiscount } = await evaluatePromotionForCart({
    supabase,
    businessId,
    items,
    payment_method: input.payment_method,
  });

  const basePaymentDetails = (input.payment_details ?? null) as CheckoutPaymentDetails | null;
  const promotionDetails = appliedPromotion
    ? {
        ...(basePaymentDetails ?? {}),
        promotion: {
          rule_id: appliedPromotion.ruleId,
          name: appliedPromotion.name,
          target_mode: appliedPromotion.targetMode ?? null,
          percent: appliedPromotion.discountPercent,
          amount: appliedPromotion.discountAmount,
          total_before: totalBeforeDiscount,
          total_after: Math.max(0, Math.round((totalBeforeDiscount - appliedPromotion.discountAmount) * 100) / 100),
        },
      }
    : basePaymentDetails;

  const { data, error } = await supabase.rpc("create_sale_with_items", {
    p_business_id: businessId,
    p_items: items,
    p_payment_method: input.payment_method,
    p_payment_details: promotionDetails ?? null,
    p_customer_id: input.customer_id ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const saleId = data as string;

  /** Si el trigger en `sales` no está aplicado, esta RPC inserta el evento (idempotente). */
  const { error: ensureErr } = await supabase.rpc("ensure_sale_activity_event", {
    p_sale_id: saleId,
  });
  if (ensureErr) {
    console.warn("[checkoutSale] ensure_sale_activity_event:", ensureErr.message);
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[activity-audit] Aplicá la migración 20260331140000_ensure_sale_activity_event.sql en Supabase (y idealmente el trigger en 20260331120000)."
      );
    }
  }

  if (process.env.NODE_ENV === "development") {
    const { data: auditRows, error: auditErr } = await supabase
      .from("business_activity_events")
      .select("id,kind,created_at")
      .eq("business_id", businessId)
      .eq("entity_id", saleId)
      .eq("kind", "sale")
      .limit(1);

    const hasRow = !auditErr && Array.isArray(auditRows) && auditRows.length > 0;

    console.log("[activity-audit] Venta", {
      saleId,
      businessId,
      cashierUserId,
      payment_method: input.payment_method,
      activityRowOk: hasRow,
    });

    if (auditErr) {
      console.warn("[activity-audit] Lectura business_activity_events:", auditErr.message);
    } else if (!hasRow) {
      console.warn("[activity-audit] Sigue sin fila kind=sale: revisá RLS o que exista la tabla.");
    }
  }

  revalidatePath("/app/sales");
  revalidatePath("/app/products");
  revalidatePath("/app/pos");
  revalidatePath("/app/empleados");
  revalidatePath("/app/onboarding");

  return {
    saleId,
    promotion: appliedPromotion
      ? {
          name: appliedPromotion.name,
          percent: appliedPromotion.discountPercent,
          amount: appliedPromotion.discountAmount,
          total_before: totalBeforeDiscount,
          total_after: Math.max(
            0,
            Math.round((totalBeforeDiscount - appliedPromotion.discountAmount) * 100) / 100
          ),
        }
      : null,
  };
}

export const checkoutSale = createMonitoredAction(checkoutSaleImpl, "pos/checkoutSale");

async function previewPromotionImpl(input: {
  payment_method: "cash" | "card" | "transfer" | "mercadopago" | "cuenta_corriente" | "mixed";
  items: CheckoutItem[];
}) {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;

  if (!businessId) {
    throw new Error("missing_active_business_id");
  }

  if (!input.items || input.items.length === 0) {
    return { promotion: null as null };
  }

  const items = input.items.map((i) => ({
    product_id: i.product_id,
    name: i.name,
    quantity: i.quantity,
    unit_price: i.unit_price,
  }));

  const supabase = await createClient();

  const { appliedPromotion, totalBeforeDiscount } = await evaluatePromotionForCart({
    supabase,
    businessId,
    items,
    payment_method: input.payment_method,
  });

  return {
    promotion: appliedPromotion
      ? {
          name: appliedPromotion.name,
          percent: appliedPromotion.discountPercent,
          amount: appliedPromotion.discountAmount,
          total_before: totalBeforeDiscount,
          total_after: Math.max(
            0,
            Math.round((totalBeforeDiscount - appliedPromotion.discountAmount) * 100) / 100
          ),
        }
      : null,
  };
}

export const previewPromotion = createMonitoredAction(previewPromotionImpl, "pos/previewPromotion");
