"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformAdminSessionEmail } from "@/lib/platform-admin-session";
import { sendStoreShippedEmail } from "@/lib/store-welcome-email";
import { revalidatePath } from "next/cache";

export type StoreShipmentRow = {
  id: string;
  created_at: string;
  email: string;
  customer_name: string;
  phone: string;
  business_name: string;
  product_sku: string;
  product_name: string;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_province: string | null;
  shipping_postal_code: string | null;
  fulfillment_status: string;
  tracking_number: string | null;
  tracking_carrier: string | null;
  shipped_at: string | null;
  tracking_token: string;
  status: string;
};

export async function adminMarkOrderShipped(input: {
  orderId: string;
  trackingNumber: string;
  trackingCarrier?: string;
}): Promise<{ ok: true } | { error: string }> {
  const adminEmail = await getPlatformAdminSessionEmail();
  if (!adminEmail) return { error: "No autorizado" };

  const orderId = input.orderId.trim();
  const trackingNumber = input.trackingNumber.trim();
  if (!trackingNumber) return { error: "Ingresá el número de seguimiento." };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Configuración incompleta." };
  }

  const { data: order, error: fetchErr } = await admin
    .from("store_orders")
    .select("id,email,customer_name,fulfillment_status,tracking_token,product_sku")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchErr || !order) return { error: "Pedido no encontrado." };

  const { data: product } = await admin
    .from("store_products")
    .select("includes_hardware")
    .eq("sku", (order as { product_sku: string }).product_sku)
    .maybeSingle();

  const row = order as {
    email: string;
    customer_name: string;
    tracking_token: string;
    fulfillment_status: string;
  };

  if (!(product as { includes_hardware?: boolean } | null)?.includes_hardware) {
    return { error: "Este pedido no incluye hardware." };
  }

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from("store_orders")
    .update({
      fulfillment_status: "shipped",
      tracking_number: trackingNumber,
      tracking_carrier: input.trackingCarrier?.trim() || null,
      shipped_at: now,
      updated_at: now,
    })
    .eq("id", orderId);

  if (updErr) return { error: updErr.message };

  await sendStoreShippedEmail({
    to: row.email,
    customerName: row.customer_name,
    trackingNumber,
    trackingCarrier: input.trackingCarrier?.trim() || null,
    trackingToken: row.tracking_token,
  });

  revalidatePath("/admin/envios");
  revalidatePath(`/pedido/${row.tracking_token}`);
  return { ok: true };
}

export async function adminMarkOrderDelivered(orderId: string): Promise<{ ok: true } | { error: string }> {
  const adminEmail = await getPlatformAdminSessionEmail();
  if (!adminEmail) return { error: "No autorizado" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Configuración incompleta." };
  }

  const { error } = await admin
    .from("store_orders")
    .update({
      fulfillment_status: "delivered",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) return { error: error.message };
  revalidatePath("/admin/envios");
  return { ok: true };
}
