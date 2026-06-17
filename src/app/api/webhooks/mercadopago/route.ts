import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { MercadoPagoConfig, Payment } from "mercadopago";

import { notifyAdminSubscriptionPayment } from "@/lib/admin-alerts-send";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  extractPosCompletionFromOrderJson,
  fetchMercadoPagoOrderWithTokens,
  type MercadoPagoPosOrderCompletion,
} from "@/lib/mercadopago-pos-order-sync";
import { isMercadoPagoPosCheckoutExternalReference } from "@/lib/mp-pos-external-ref";

export const dynamic = "force-dynamic";

type MpPayment = {
  status?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  currency_id?: string;
  id?: number | string;
  metadata?: Record<string, unknown>;
};

function getPlanDays(planKey: string | undefined): number {
  if (!planKey) return 30;
  const planDays: Record<string, number> = {
    monthly: 30,
    semester: 180,
    annual: 365,
  };
  return planDays[planKey] ?? 30;
}

function getPaymentIdFromPayload(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;

  if (o.type === "payment" && o.data && typeof o.data === "object") {
    const id = (o.data as Record<string, unknown>).id;
    if (id != null) return String(id);
  }

  if (o.topic === "payment") {
    if (o.id != null) return String(o.id);
    if (typeof o.resource === "string") {
      const r = o.resource;
      if (/^\d+$/.test(r)) return r;
      const last = r.split("/").pop();
      if (last && /^\d+$/.test(last)) return last;
    }
  }

  if (o.action && o.data && typeof o.data === "object") {
    const id = (o.data as Record<string, unknown>).id;
    if (id != null) {
      const sid = String(id);
      if (/^ORD/i.test(sid)) return null;
      return sid;
    }
  }

  return null;
}

function getOrderIdFromWebhookPayload(body: unknown, requestUrl: string): string | null {
  const url = new URL(requestUrl);
  const qp = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (qp && /^ORD/i.test(qp.trim())) return qp.trim();

  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const data = o.data;
  if (data && typeof data === "object") {
    const id = String((data as Record<string, unknown>).id ?? "").trim();
    if (id && /^ORD/i.test(id)) return id;
  }
  return null;
}

async function collectMercadoPagoAccessTokens(): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (t: string) => {
    const x = t.trim();
    if (x && !seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  };
  push(process.env.MERCADOPAGO_ACCESS_TOKEN ?? "");
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("business_mercadopago_access").select("access_token");
    for (const row of data ?? []) {
      push(String((row as { access_token?: string }).access_token ?? ""));
    }
  } catch {
    /* solo env token */
  }
  return out;
}

async function fetchMercadoPagoPayment(paymentId: string): Promise<MpPayment | null> {
  const tokens = await collectMercadoPagoAccessTokens();
  if (tokens.length === 0) return null;

  for (const token of tokens) {
    try {
      const client = new MercadoPagoConfig({ accessToken: token });
      const paymentApi = new Payment(client);
      const payment = (await paymentApi.get({ id: paymentId })) as MpPayment;
      if (payment && payment.id != null) return payment;
    } catch {
      /* token incorrecto para este pago */
    }
  }
  return null;
}

async function processStoreOrderApproved(payment: MpPayment, paymentId: string): Promise<NextResponse> {
  const orderId = String(payment.external_reference ?? "").trim();
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ ok: true, ignored: "no_store_order_ref" });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "no_admin_client" }, { status: 503 });
  }

  const { data: orderRow } = await admin.from("store_orders").select("id").eq("id", orderId).maybeSingle();
  if (!orderRow) {
    return NextResponse.json({ ok: true, ignored: "not_store_order" });
  }

  const providerPaymentId = String(payment.id ?? paymentId);

  const { provisionStoreOrderFromPayment } = await import("@/lib/store-provision");
  const result = await provisionStoreOrderFromPayment(orderId, payment);

  if (!result.ok) {
    console.error("[mp-webhook] store provision failed:", result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  const { data: provisioned } = await admin
    .from("store_orders")
    .select("provisioned_business_id")
    .eq("id", orderId)
    .maybeSingle();

  const businessId = (provisioned as { provisioned_business_id?: string } | null)?.provisioned_business_id;
  if (businessId) {
    const { data: subRow } = await admin.from("subscriptions").select("id").eq("business_id", businessId).maybeSingle();
    const { error: payErr } = await admin.from("payments").insert({
      business_id: businessId,
      subscription_id: (subRow as { id?: string } | null)?.id ?? null,
      provider: "mercadopago",
      provider_payment_id: providerPaymentId,
      amount: Number(payment.transaction_amount ?? 0),
      currency: String(payment.currency_id ?? "ARS"),
      status: "approved",
      raw: { ...(payment as unknown as Record<string, unknown>), store_order_id: orderId },
    });
    if (payErr) {
      console.warn("[mp-webhook] store payments insert", payErr.message);
    }
  }

  return NextResponse.json({ ok: true, store: true, alreadyProvisioned: result.alreadyProvisioned });
}

async function isStoreOrderReference(extRef: string): Promise<boolean> {
  if (!extRef || !/^[0-9a-f-]{36}$/i.test(extRef)) return false;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("store_orders").select("id").eq("id", extRef).maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

async function processLifetimeUpgradeApproved(payment: MpPayment, paymentId: string): Promise<NextResponse> {
  const businessId = String(payment.external_reference ?? "").trim();
  if (!businessId || !/^[0-9a-f-]{36}$/i.test(businessId)) {
    return NextResponse.json({ ok: true, ignored: "no_business_ref" });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "no_admin_client" }, { status: 503 });
  }

  const providerPaymentId = String(payment.id ?? paymentId);

  const { data: existingPay } = await admin
    .from("payments")
    .select("id")
    .eq("provider", "mercadopago")
    .eq("provider_payment_id", providerPaymentId)
    .maybeSingle();

  if (existingPay) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const now = new Date();

  const { data: subRow } = await admin.from("subscriptions").select("id, plan_id, status").eq("business_id", businessId).maybeSingle();
  const subscriptionId = subRow?.id as string | undefined;

  if (subRow && (subRow as { plan_id?: string; status?: string }).plan_id === "lifetime" && (subRow as { status?: string }).status === "active") {
    const { error: payErr } = await admin.from("payments").insert({
      business_id: businessId,
      subscription_id: subscriptionId ?? null,
      provider: "mercadopago",
      provider_payment_id: providerPaymentId,
      amount: Number(payment.transaction_amount ?? 0),
      currency: String(payment.currency_id ?? "ARS"),
      status: "approved",
      raw: payment as unknown as Record<string, unknown>,
    });
    if (payErr) {
      console.warn("[mp-webhook] lifetime duplicate payment insert", payErr.message);
    }
    return NextResponse.json({ ok: true, already_lifetime: true });
  }

  const { error: payErr } = await admin.from("payments").insert({
    business_id: businessId,
    subscription_id: subscriptionId ?? null,
    provider: "mercadopago",
    provider_payment_id: providerPaymentId,
    amount: Number(payment.transaction_amount ?? 0),
    currency: String(payment.currency_id ?? "ARS"),
    status: "approved",
    raw: payment as unknown as Record<string, unknown>,
  });

  if (payErr) {
    console.error("payments insert (lifetime)", payErr);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const { error: subErr } = await admin.from("subscriptions").upsert(
    {
      business_id: businessId,
      plan_id: "lifetime",
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: null,
      provider: "mercadopago",
      updated_at: now.toISOString(),
    },
    { onConflict: "business_id" }
  );

  if (subErr) {
    console.error("subscriptions upsert (lifetime)", subErr);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const { data: bizRow } = await admin.from("businesses").select("name").eq("id", businessId).maybeSingle();
  const businessName = String((bizRow as { name?: string } | null)?.name ?? "Sin nombre");
  void notifyAdminSubscriptionPayment({
    businessId,
    businessName,
    amount: Number(payment.transaction_amount ?? 0),
    currency: String(payment.currency_id ?? "ARS"),
    mpPaymentId: providerPaymentId,
  });

  revalidatePath("/app/subscription");

  return NextResponse.json({ ok: true, lifetime: true });
}

async function processSubscriptionApproved(payment: MpPayment, paymentId: string): Promise<NextResponse> {
  const businessId = String(payment.external_reference ?? "").trim();
  if (!businessId || !/^[0-9a-f-]{36}$/i.test(businessId)) {
    return NextResponse.json({ ok: true, ignored: "no_business_ref" });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "no_admin_client" }, { status: 503 });
  }

  const providerPaymentId = String(payment.id ?? paymentId);
  const planKey = (payment.metadata as Record<string, unknown>)?.plan_key as string | undefined;
  const periodDays = getPlanDays(planKey);
  const now = new Date();
  const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

  const { data: subRow } = await admin.from("subscriptions").select("id").eq("business_id", businessId).maybeSingle();
  const subscriptionId = subRow?.id as string | undefined;

  const { error: payErr } = await admin.from("payments").insert({
    business_id: businessId,
    subscription_id: subscriptionId ?? null,
    provider: "mercadopago",
    provider_payment_id: providerPaymentId,
    amount: Number(payment.transaction_amount ?? 0),
    currency: String(payment.currency_id ?? "ARS"),
    status: "approved",
    raw: payment as unknown as Record<string, unknown>,
  });

  if (payErr) {
    console.error("payments insert", payErr);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const { error: subErr } = await admin.from("subscriptions").upsert(
    {
      business_id: businessId,
      plan_id: "standard",
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      provider: "mercadopago",
      updated_at: now.toISOString(),
    },
    { onConflict: "business_id" }
  );

  if (subErr) {
    console.error("subscriptions upsert", subErr);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const meta = payment.metadata as Record<string, unknown> | undefined;
  const promoRaw = meta?.promo_code_id;
  const promoId = typeof promoRaw === "string" ? promoRaw.trim() : "";
  if (promoId && /^[0-9a-f-]{36}$/i.test(promoId)) {
    const { error: promoErr } = await admin
      .from("subscription_promo_codes")
      .update({ used_at: now.toISOString() })
      .eq("id", promoId)
      .eq("business_id", businessId)
      .is("used_at", null);
    if (promoErr) {
      console.warn("[mp-webhook] subscription_promo_codes update", promoErr.message);
    }
  }

  const { data: bizRow } = await admin.from("businesses").select("name").eq("id", businessId).maybeSingle();
  const businessName = String((bizRow as { name?: string } | null)?.name ?? "Sin nombre");
  void notifyAdminSubscriptionPayment({
    businessId,
    businessName,
    amount: Number(payment.transaction_amount ?? 0),
    currency: String(payment.currency_id ?? "ARS"),
    mpPaymentId: providerPaymentId,
  });

  revalidatePath("/app/subscription");

  return NextResponse.json({ ok: true });
}

async function completeMercadoPagoPosPending(completion: MercadoPagoPosOrderCompletion): Promise<NextResponse> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: "no_admin_client" }, { status: 503 });
  }

  const { data: saleId, error } = await admin.rpc("mercadopago_pos_complete_pending", {
    p_external_reference: completion.external_reference,
    p_mp_payment_id: completion.mp_payment_id,
    p_paid_amount: completion.amount,
    p_currency_id: completion.currency,
  });

  if (error) {
    console.error("[mp-webhook-pos] mercadopago_pos_complete_pending", error);
    return NextResponse.json({ ok: true, note: error.message });
  }

  if (!saleId) {
    return NextResponse.json({ ok: true, ignored: "pos_not_completed" });
  }

  revalidatePath("/app/sales");
  revalidatePath("/app/pos");
  revalidatePath("/app/products");
  return NextResponse.json({ ok: true, pos_sale_id: saleId });
}

async function processPosQrApproved(payment: MpPayment, paymentId: string): Promise<NextResponse> {
  const extRef = String(payment.external_reference ?? "").trim();
  if (!isMercadoPagoPosCheckoutExternalReference(extRef)) {
    return NextResponse.json({ ok: true, ignored: "not_pos_ref" });
  }

  const mpId = String(payment.id ?? paymentId);
  const amount = Number(payment.transaction_amount ?? 0);
  const currency = String(payment.currency_id ?? "ARS");

  return completeMercadoPagoPosPending({
    external_reference: extRef,
    mp_payment_id: mpId,
    amount,
    currency,
  });
}

/**
 * Webhooks QR (Orders API): MP envía type=order / action order.processed con data embebida o solo data.id ORD...
 */
async function processOrderWebhook(raw: unknown, requestUrl: string): Promise<NextResponse | null> {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  if (o.type === "order" && o.data && typeof o.data === "object") {
    const data = o.data as Record<string, unknown>;
    const action = String(o.action ?? "");

    if (action === "order.processed" || String(data.status ?? "") === "processed") {
      const fromBody = extractPosCompletionFromOrderJson(data as Record<string, unknown>);
      if (fromBody) {
        console.info("[mp-webhook] order.processed (body)", { ref: fromBody.external_reference.slice(0, 12) });
        return completeMercadoPagoPosPending(fromBody);
      }
    }

    const oid = String(data.id ?? "").trim();
    if (oid && /^ORD/i.test(oid)) {
      console.info("[mp-webhook] order (fetch ORD)", { order_id: oid.slice(0, 16) });
      return fetchOrderAndCompletePos(oid);
    }
  }

  const qpType = new URL(requestUrl).searchParams.get("type");
  const orderId = getOrderIdFromWebhookPayload(raw, requestUrl);
  if (qpType === "order" && orderId) {
    console.info("[mp-webhook] order (query + fetch)", { order_id: orderId.slice(0, 16) });
    return fetchOrderAndCompletePos(orderId);
  }

  return null;
}

async function fetchOrderAndCompletePos(orderId: string): Promise<NextResponse> {
  const tokens = await collectMercadoPagoAccessTokens();
  const json = await fetchMercadoPagoOrderWithTokens(orderId, tokens);
  if (!json) {
    console.warn("[mp-webhook] GET /v1/orders falló para todos los tokens", { order_id: orderId.slice(0, 20) });
    return NextResponse.json({ ok: false, error: "order_fetch" }, { status: 502 });
  }
  const completion = extractPosCompletionFromOrderJson(json);
  if (!completion) {
    return NextResponse.json({ ok: true, ignored: "order_not_pos_or_not_processed" });
  }
  return completeMercadoPagoPosPending(completion);
}

async function processPaymentNotification(paymentId: string): Promise<NextResponse> {
  const payment = await fetchMercadoPagoPayment(paymentId);
  if (!payment) {
    return NextResponse.json({ ok: false, error: "payment_fetch" }, { status: 502 });
  }

  if (payment.status !== "approved") {
    return NextResponse.json({ ok: true, status: payment.status });
  }

  const extRef = String(payment.external_reference ?? "").trim();
  if (isMercadoPagoPosCheckoutExternalReference(extRef)) {
    return processPosQrApproved(payment, paymentId);
  }

  if (await isStoreOrderReference(extRef)) {
    return processStoreOrderApproved(payment, paymentId);
  }

  const meta = payment.metadata as Record<string, unknown> | undefined;
  if (meta?.upgrade_type === "lifetime") {
    return processLifetimeUpgradeApproved(payment, paymentId);
  }

  return processSubscriptionApproved(payment, paymentId);
}

/**
 * IPN Mercado Pago:
 * - Suscripción: notificación payment + external_reference = UUID del negocio.
 * - QR POS: Mercado Pago envía webhooks **Order** (`type: order`, `order.processed`), no siempre `payment`.
 * En el panel: Webhooks → evento **Order (Mercado Pago)** → URL https://tu-dominio/api/webhooks/mercadopago
 */
export async function POST(request: Request) {
  let raw: unknown;
  const ct = request.headers.get("content-type") ?? "";

  try {
    if (ct.includes("application/json")) {
      raw = await request.json();
    } else {
      const text = await request.text();
      try {
        raw = JSON.parse(text);
      } catch {
        const params = new URLSearchParams(text);
        const topic = params.get("topic");
        const id = params.get("id") ?? params.get("data.id");
        raw = topic && id ? { topic, id } : {};
      }
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const url = request.url;
  const orderRes = await processOrderWebhook(raw, url);
  if (orderRes) return orderRes;

  const paymentId = getPaymentIdFromPayload(raw);
  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  return processPaymentNotification(paymentId);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const topic = url.searchParams.get("topic");
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id") ?? url.searchParams.get("data.id");
  if (topic === "payment" && id) {
    return processPaymentNotification(id);
  }
  if (type === "order" && id && /^ORD/i.test(id)) {
    return fetchOrderAndCompletePos(id);
  }
  return NextResponse.json({ ok: true });
}
