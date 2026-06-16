"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type PublicOrderTracking = {
  productName: string;
  customerName: string;
  fulfillmentStatus: string;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  shippedAt: string | null;
  includesHardware: boolean;
  paid: boolean;
};

export async function getOrderByTrackingToken(token: string): Promise<PublicOrderTracking | null> {
  if (!token || token.length < 20) return null;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("store_orders")
      .select(
        "customer_name,fulfillment_status,tracking_number,tracking_carrier,shipped_at,status,product_sku"
      )
      .eq("tracking_token", token)
      .maybeSingle();

    if (error || !data) return null;

    return await mapOrderRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

async function mapOrderRow(data: Record<string, unknown>): Promise<PublicOrderTracking | null> {
  const row = data as {
    customer_name: string;
    fulfillment_status: string;
    tracking_number: string | null;
    tracking_carrier: string | null;
    shipped_at: string | null;
    status: string;
    product_sku: string;
  };

  try {
    const admin = createAdminClient();
    const { data: product } = await admin
      .from("store_products")
      .select("name,includes_hardware")
      .eq("sku", row.product_sku)
      .maybeSingle();

    const prod = product as { name: string; includes_hardware: boolean } | null;
    if (!prod) return null;

    return {
      productName: prod.name,
      customerName: row.customer_name,
      fulfillmentStatus: row.fulfillment_status,
      trackingNumber: row.tracking_number,
      trackingCarrier: row.tracking_carrier,
      shippedAt: row.shipped_at,
      includesHardware: prod.includes_hardware,
      paid: row.status === "paid",
    };
  } catch {
    return null;
  }
}

/** Busca el último combo con envío pagado para ese email. */
export async function lookupHardwareOrderByEmail(
  email: string
): Promise<{ token: string } | { error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { error: "Ingresá el email con el que compraste." };
  }

  try {
    const admin = createAdminClient();
    const { data: orders, error } = await admin
      .from("store_orders")
      .select("tracking_token, product_sku, status, created_at, email")
      .eq("status", "paid")
      .ilike("email", normalized)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) return { error: "No pudimos buscar el pedido. Intentá de nuevo." };
    if (!orders?.length) {
      return {
        error: "No encontramos una compra con ese email. Revisá el mail de confirmación o contactanos.",
      };
    }

    for (const order of orders) {
      const row = order as { tracking_token: string; product_sku: string };
      const { data: product } = await admin
        .from("store_products")
        .select("includes_hardware")
        .eq("sku", row.product_sku)
        .maybeSingle();

      if ((product as { includes_hardware?: boolean } | null)?.includes_hardware) {
        return { token: row.tracking_token };
      }
    }

    return {
      error: "Ese email tiene compra de software sin envío físico. El acceso llegó por mail al pagar.",
    };
  } catch {
    return { error: "No pudimos buscar el pedido. Intentá de nuevo." };
  }
}
