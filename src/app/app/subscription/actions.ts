"use server";



import { cookies } from "next/headers";



import { MercadoPagoConfig, Preference } from "mercadopago";



import { getAppBaseUrl } from "@/lib/app-base-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStoreEnvPrice, getStoreEnvTitle } from "@/lib/store-products";
import {
  discountedPlanAmount,
  normalizeSubscriptionPromoCode,
} from "@/lib/subscription-promo";



export type PlanKey = "monthly" | "semester" | "annual";



const PLAN_ENV: Record<PlanKey, { amountKey: string; daysKey: string; titleKey: string; defaultAmount: string; defaultDays: string; defaultTitle: string }> = {

  monthly: {

    amountKey: "MERCADOPAGO_PLAN_MONTHLY_AMOUNT",

    daysKey: "MERCADOPAGO_PLAN_MONTHLY_DAYS",

    titleKey: "MERCADOPAGO_PLAN_MONTHLY_TITLE",

    defaultAmount: "15000",

    defaultDays: "30",

    defaultTitle: "Plan mensual — Punto de venta",

  },

  semester: {

    amountKey: "MERCADOPAGO_PLAN_SEMESTER_AMOUNT",

    daysKey: "MERCADOPAGO_PLAN_SEMESTER_DAYS",

    titleKey: "MERCADOPAGO_PLAN_SEMESTER_TITLE",

    defaultAmount: "75000",

    defaultDays: "180",

    defaultTitle: "Plan semestral — Punto de venta",

  },

  annual: {

    amountKey: "MERCADOPAGO_PLAN_ANNUAL_AMOUNT",

    daysKey: "MERCADOPAGO_PLAN_ANNUAL_DAYS",

    titleKey: "MERCADOPAGO_PLAN_ANNUAL_TITLE",

    defaultAmount: "150000",

    defaultDays: "365",

    defaultTitle: "Plan anual — Punto de venta",

  },

};



export async function getPlanConfig(planKey: PlanKey = "monthly") {

  const cfg = PLAN_ENV[planKey];

  const amount = Number.parseFloat(process.env[cfg.amountKey] ?? cfg.defaultAmount);

  const days = Number.parseInt(process.env[cfg.daysKey] ?? cfg.defaultDays, 10);

  const currency = (process.env.MERCADOPAGO_PLAN_CURRENCY ?? "ARS").trim().toUpperCase();

  const title = (process.env[cfg.titleKey] ?? cfg.defaultTitle).trim();

  if (!Number.isFinite(amount) || amount <= 0) {

    throw new Error("invalid_plan_amount");

  }

  return { amount, currency, title, days, planKey };

}



export async function getAllPlansConfig() {

  const [monthly, semester, annual] = await Promise.all([
    getPlanConfig("monthly"),
    getPlanConfig("semester"),
    getPlanConfig("annual"),
  ]);

  return { monthly, semester, annual };

}

export type ValidatedSubscriptionPromo = {
  planKey: PlanKey;
  discountPercent: number;
  listAmount: number;
  payAmount: number;
  promoId: string;
};

/**
 * Valida un código de descuento (bono) para el negocio activo. No requiere elegir plan: el código ya está asociado a un plan.
 */
export async function validateSubscriptionPromoCode(
  rawCode: string
): Promise<{ ok: true; data: ValidatedSubscriptionPromo } | { ok: false; error: string }> {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;
  if (!businessId) {
    return { ok: false, error: "No hay negocio activo." };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { ok: false, error: "Sesión inválida." };
  }

  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("business_id")
    .eq("business_id", businessId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (memErr || !membership) {
    return { ok: false, error: "No tenés acceso a este negocio." };
  }

  const code = normalizeSubscriptionPromoCode(rawCode);
  if (code.length < 4) {
    return { ok: false, error: "Ingresá un código válido." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Configuración del servidor incompleta." };
  }

  const { data: row, error: qErr } = await admin
    .from("subscription_promo_codes")
    .select("id, discount_percent, plan_key, expires_at, used_at")
    .eq("code", code)
    .eq("business_id", businessId)
    .maybeSingle();

  if (qErr) {
    return { ok: false, error: qErr.message };
  }
  if (!row) {
    return { ok: false, error: "Código no encontrado o no corresponde a este negocio." };
  }
  if (row.used_at) {
    return { ok: false, error: "Este código ya fue usado." };
  }
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { ok: false, error: "Este código venció." };
  }

  const planKey = row.plan_key as PlanKey;
  const { amount: listAmount } = await getPlanConfig(planKey);
  const payAmount = discountedPlanAmount(listAmount, Number(row.discount_percent));
  if (payAmount < 1) {
    return { ok: false, error: "Monto con descuento inválido." };
  }

  return {
    ok: true,
    data: {
      planKey,
      discountPercent: Number(row.discount_percent),
      listAmount,
      payAmount,
      promoId: row.id as string,
    },
  };
}

export async function startMercadoPagoCheckout(
  planKey: PlanKey = "monthly",
  promoCodeRaw?: string | null
): Promise<{ checkoutUrl: string } | { error: string }> {

  const token = (process.env.MERCADOPAGO_ACCESS_TOKEN ?? "").trim();

  if (!token) {

    return { error: "Falta MERCADOPAGO_ACCESS_TOKEN en el servidor." };

  }



  const cookieStore = await cookies();

  const businessId = cookieStore.get("active_business_id")?.value;

  if (!businessId) {

    return { error: "No hay negocio activo." };

  }



  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {

    return { error: "Sesión inválida." };

  }



  const { data: membership, error: memErr } = await supabase

    .from("memberships")

    .select("business_id")

    .eq("business_id", businessId)

    .eq("user_id", userData.user.id)

    .maybeSingle();



  if (memErr || !membership) {

    return { error: "No tenés acceso a este negocio." };

  }

  const { amount: listAmount, currency, title } = await getPlanConfig(planKey);
  let unitPrice = listAmount;
  let itemTitle = title;
  let promoId: string | null = null;

  const trimmedPromo = (promoCodeRaw ?? "").trim();
  if (trimmedPromo) {
    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { error: "Configuración del servidor incompleta." };
    }
    const code = normalizeSubscriptionPromoCode(trimmedPromo);
    const { data: row, error: pErr } = await admin
      .from("subscription_promo_codes")
      .select("id, discount_percent, plan_key, expires_at, used_at")
      .eq("code", code)
      .eq("business_id", businessId)
      .maybeSingle();

    if (pErr) {
      return { error: pErr.message };
    }
    if (!row) {
      return { error: "Código no encontrado o no corresponde a este negocio." };
    }
    if (row.used_at) {
      return { error: "Este código ya fue usado." };
    }
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return { error: "Este código venció." };
    }
    if ((row.plan_key as PlanKey) !== planKey) {
      return { error: "Este código aplica a otro plan. Elegí el plan correcto o quitá el código." };
    }
    unitPrice = discountedPlanAmount(listAmount, Number(row.discount_percent));
    if (unitPrice < 1) {
      return { error: "Monto con descuento inválido." };
    }
    promoId = row.id as string;
    itemTitle = `${title} (−${Number(row.discount_percent)}%)`;
  }

  const base = getAppBaseUrl();
  const notificationUrl = `${base}/api/webhooks/mercadopago`;

  const client = new MercadoPagoConfig({ accessToken: token });
  const preference = new Preference(client);

  const metadata: Record<string, string> = {
    business_id: businessId,
    plan_key: planKey,
    list_price: String(listAmount),
    final_price: String(unitPrice),
    promo_code_id: promoId ?? "",
  };

  const body = {
    items: [
      {
        id: `${planKey}-plan`,

        title: itemTitle,

        quantity: 1,

        currency_id: currency,

        unit_price: unitPrice,

      },

    ],

    external_reference: businessId,

    metadata,

    notification_url: notificationUrl,

    back_urls: {

      success: `${base}/app/subscription?mp=success`,

      pending: `${base}/app/subscription?mp=pending`,

      failure: `${base}/app/subscription?mp=failure`,

    },

    auto_return: "approved" as const,

  };



  try {

    const res = await preference.create({ body });

    const useSandbox = process.env.MERCADOPAGO_USE_SANDBOX === "1";

    const checkoutUrl = useSandbox ? res.sandbox_init_point : res.init_point;

    if (!checkoutUrl) {

      return { error: "Mercado Pago no devolvió URL de pago." };

    }

    return { checkoutUrl };

  } catch (e) {
    console.error("[mercadopago] preference.create failed:", e);

    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e && typeof (e as { message: unknown }).message === "string"
          ? (e as { message: string }).message
          : String(e);

    return {
      error: msg && msg !== "[object Object]" ? msg : "Error al crear el checkout.",
    };
  }

}

export async function startLifetimeUpgradeCheckout(): Promise<{ checkoutUrl: string } | { error: string }> {
  const token = (process.env.MERCADOPAGO_ACCESS_TOKEN ?? "").trim();
  if (!token) {
    return { error: "Falta MERCADOPAGO_ACCESS_TOKEN en el servidor." };
  }

  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;
  if (!businessId) {
    return { error: "No hay negocio activo." };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "Sesión inválida." };
  }

  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("business_id")
    .eq("business_id", businessId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (memErr || !membership) {
    return { error: "No tenés acceso a este negocio." };
  }

  const amount = getStoreEnvPrice("software_lifetime");
  const title = getStoreEnvTitle("software_lifetime");
  const currency = (process.env.MERCADOPAGO_PLAN_CURRENCY ?? "ARS").trim().toUpperCase();

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Precio de licencia inválido." };
  }

  const base = getAppBaseUrl();
  const notificationUrl = `${base}/api/webhooks/mercadopago`;

  const client = new MercadoPagoConfig({ accessToken: token });
  const preference = new Preference(client);

  const metadata: Record<string, string> = {
    business_id: businessId,
    upgrade_type: "lifetime",
    product_sku: "software_lifetime",
    final_price: String(amount),
  };

  const body = {
    items: [
      {
        id: "software_lifetime",
        title,
        quantity: 1,
        currency_id: currency,
        unit_price: amount,
      },
    ],
    external_reference: businessId,
    metadata,
    notification_url: notificationUrl,
    back_urls: {
      success: `${base}/app/subscription?mp=success`,
      pending: `${base}/app/subscription?mp=pending`,
      failure: `${base}/app/subscription?mp=failure`,
    },
    auto_return: "approved" as const,
  };

  try {
    const res = await preference.create({ body });
    const useSandbox = process.env.MERCADOPAGO_USE_SANDBOX === "1";
    const checkoutUrl = useSandbox ? res.sandbox_init_point : res.init_point;

    if (!checkoutUrl) {
      return { error: "Mercado Pago no devolvió URL de pago." };
    }

    return { checkoutUrl };
  } catch (e) {
    console.error("[mercadopago] lifetime preference.create failed:", e);

    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e && typeof (e as { message: unknown }).message === "string"
          ? (e as { message: string }).message
          : String(e);

    return {
      error: msg && msg !== "[object Object]" ? msg : "Error al crear el checkout.",
    };
  }
}

