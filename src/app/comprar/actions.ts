"use server";

import { MercadoPagoConfig, Preference } from "mercadopago";

import { getAppBaseUrl } from "@/lib/app-base-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStoreProductBySku } from "@/lib/store-products";
import { normalizeBusinessType } from "@/lib/business-types";

export type StoreCheckoutInput = {
  sku: string;
  email: string;
  customerName: string;
  phone: string;
  businessName: string;
  businessType: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingProvince?: string;
  shippingPostalCode?: string;
  shippingNotes?: string;
};

export async function startStoreCheckout(
  input: StoreCheckoutInput
): Promise<{ checkoutUrl: string } | { error: string }> {
  const token = (process.env.MERCADOPAGO_ACCESS_TOKEN ?? "").trim();
  if (!token) {
    return { error: "Pagos no configurados. Contactanos por WhatsApp." };
  }

  const product = await getStoreProductBySku(input.sku);
  if (!product) {
    return { error: "Producto no encontrado." };
  }

  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) {
    return { error: "Email inválido." };
  }

  const customerName = input.customerName.trim();
  const businessName = input.businessName.trim();
  const phone = input.phone.trim();

  if (!customerName || !businessName || !phone) {
    return { error: "Completá todos los campos obligatorios." };
  }

  if (product.includes_hardware && customerName.split(/\s+/).filter(Boolean).length < 2) {
    return { error: "Ingresá nombre y apellido completos para el envío." };
  }

  if (product.includes_hardware) {
    if (!input.shippingAddress?.trim() || !input.shippingCity?.trim() || !input.shippingProvince?.trim()) {
      return { error: "Completá la dirección de envío." };
    }
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Configuración del servidor incompleta." };
  }

  const { data: existingUserId } = await admin.rpc("get_auth_user_id_by_email", { p_email: email });
  if (existingUserId) {
    return {
      error:
        "Este email ya tiene cuenta. Iniciá sesión o escribinos por WhatsApp si querés comprar otro producto.",
    };
  }

  const businessType = normalizeBusinessType(input.businessType);
  const amount = product.price_ars;

  const { data: order, error: orderErr } = await admin
    .from("store_orders")
    .insert({
      product_sku: product.sku,
      amount_ars: amount,
      status: "pending_payment",
      email,
      customer_name: customerName,
      phone,
      business_name: businessName,
      business_type: businessType,
      shipping_address: product.includes_hardware ? input.shippingAddress?.trim() ?? null : null,
      shipping_city: product.includes_hardware ? input.shippingCity?.trim() ?? null : null,
      shipping_province: product.includes_hardware ? input.shippingProvince?.trim() ?? null : null,
      shipping_postal_code: product.includes_hardware ? input.shippingPostalCode?.trim() ?? null : null,
      shipping_notes: product.includes_hardware ? input.shippingNotes?.trim() ?? null : null,
      fulfillment_status: product.includes_hardware ? "pending_shipment" : "not_applicable",
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    return { error: orderErr?.message ?? "No se pudo crear el pedido." };
  }

  const orderId = (order as { id: string }).id;
  const base = getAppBaseUrl();
  const notificationUrl = `${base}/api/webhooks/mercadopago`;
  const currency = (process.env.MERCADOPAGO_PLAN_CURRENCY ?? "ARS").trim().toUpperCase();

  const client = new MercadoPagoConfig({ accessToken: token });
  const preference = new Preference(client);

  const body = {
    items: [
      {
        id: product.sku,
        title: product.name,
        quantity: 1,
        currency_id: currency,
        unit_price: amount,
      },
    ],
    external_reference: orderId,
    metadata: {
      order_type: "store",
      product_sku: product.sku,
      store_order_id: orderId,
    },
    notification_url: notificationUrl,
    back_urls: {
      success: `${base}/comprar/exito?order=${orderId}`,
      pending: `${base}/comprar/exito?order=${orderId}&mp=pending`,
      failure: `${base}/comprar/exito?order=${orderId}&mp=failure`,
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

    await admin
      .from("store_orders")
      .update({ mp_preference_id: String(res.id ?? ""), updated_at: new Date().toISOString() })
      .eq("id", orderId);

    return { checkoutUrl };
  } catch (e) {
    console.error("[store-checkout] preference.create failed:", e);
    return { error: e instanceof Error ? e.message : "Error al iniciar el pago." };
  }
}

export async function getStoreOrderStatus(orderId: string): Promise<{
  status: string;
  provisioned: boolean;
  fulfillmentStatus: string;
  email: string | null;
  trackingToken: string | null;
  includesHardware: boolean;
} | null> {
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) return null;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("store_orders")
      .select("status,provisioned_at,fulfillment_status,email,tracking_token,product_sku")
      .eq("id", orderId)
      .maybeSingle();
    if (!data) return null;
    const row = data as {
      status: string;
      provisioned_at: string | null;
      fulfillment_status: string;
      email: string;
      tracking_token: string;
      product_sku: string;
    };

    const { data: product } = await admin
      .from("store_products")
      .select("includes_hardware")
      .eq("sku", row.product_sku)
      .maybeSingle();

    return {
      status: row.status,
      provisioned: Boolean(row.provisioned_at),
      fulfillmentStatus: row.fulfillment_status,
      email: row.email,
      trackingToken: row.tracking_token,
      includesHardware: Boolean((product as { includes_hardware?: boolean } | null)?.includes_hardware),
    };
  } catch {
    return null;
  }
}
