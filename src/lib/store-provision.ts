import crypto from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { slugifyBusinessName } from "@/lib/store-products";
import { sendStoreWelcomeEmail } from "@/lib/store-welcome-email";
import { normalizeBusinessType } from "@/lib/business-types";

export type StoreOrderRow = {
  id: string;
  product_sku: string;
  amount_ars: number;
  status: string;
  email: string;
  customer_name: string;
  phone: string;
  business_name: string;
  business_type: string;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_province: string | null;
  shipping_postal_code: string | null;
  shipping_notes: string | null;
  fulfillment_status: string;
  tracking_token: string;
  provisioned_at: string | null;
  provisioned_user_id: string | null;
  provisioned_business_id: string | null;
  welcome_email_sent_at: string | null;
};

type MpPaymentSlice = {
  id?: number | string;
  transaction_amount?: number;
};

function generatePassword(): string {
  return crypto.randomBytes(18).toString("base64url");
}

export async function provisionStoreOrderFromPayment(
  orderId: string,
  payment: MpPaymentSlice
): Promise<{ ok: true; alreadyProvisioned: boolean } | { ok: false; error: string }> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "no_admin_client" };
  }

  const { data: orderRaw, error: orderErr } = await admin
    .from("store_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !orderRaw) {
    return { ok: false, error: "order_not_found" };
  }

  const order = orderRaw as StoreOrderRow;

  if (order.provisioned_at && order.provisioned_user_id && order.provisioned_business_id) {
    return { ok: true, alreadyProvisioned: true };
  }

  const { data: product } = await admin
    .from("store_products")
    .select("includes_hardware")
    .eq("sku", order.product_sku)
    .maybeSingle();

  const includesHardware = Boolean((product as { includes_hardware?: boolean } | null)?.includes_hardware);

  const email = order.email.trim().toLowerCase();
  const password = generatePassword();
  let userId = order.provisioned_user_id;

  if (!userId) {
    const { data: existingId } = await admin.rpc("get_auth_user_id_by_email", { p_email: email });
    if (existingId) {
      return { ok: false, error: "email_already_registered" };
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: order.customer_name },
    });

    if (createErr || !created.user?.id) {
      return { ok: false, error: createErr?.message ?? "user_create_failed" };
    }
    userId = created.user.id;
  }

  let businessId = order.provisioned_business_id;
  if (!businessId) {
    const businessType = normalizeBusinessType(order.business_type);
    let slug = slugifyBusinessName(order.business_name);
    let { data: bizId, error: rpcErr } = await admin.rpc("create_business_paid_owner", {
      p_name: order.business_name,
      p_slug: slug,
      p_user_id: userId,
      p_business_type: businessType,
    });

    if (rpcErr?.message?.includes("businesses_slug_key")) {
      slug = slugifyBusinessName(order.business_name);
      ({ data: bizId, error: rpcErr } = await admin.rpc("create_business_paid_owner", {
        p_name: order.business_name,
        p_slug: slug,
        p_user_id: userId,
        p_business_type: businessType,
      }));
    }

    if (rpcErr || !bizId) {
      return { ok: false, error: rpcErr?.message ?? "business_create_failed" };
    }
    businessId = bizId as string;
  }

  const now = new Date().toISOString();
  const mpPaymentId = String(payment.id ?? "");
  const fulfillmentStatus = includesHardware ? "pending_shipment" : "not_applicable";

  const { error: updateErr } = await admin
    .from("store_orders")
    .update({
      status: "paid",
      mp_payment_id: mpPaymentId || null,
      provisioned_user_id: userId,
      provisioned_business_id: businessId,
      provisioned_at: now,
      fulfillment_status: fulfillmentStatus,
      updated_at: now,
    })
    .eq("id", orderId);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  if (!order.welcome_email_sent_at) {
    await sendStoreWelcomeEmail({
      to: email,
      customerName: order.customer_name,
      businessName: order.business_name,
      password,
      trackingToken: order.tracking_token,
      includesHardware,
    });
    await admin
      .from("store_orders")
      .update({ welcome_email_sent_at: now, updated_at: now })
      .eq("id", orderId);
  }

  return { ok: true, alreadyProvisioned: false };
}
