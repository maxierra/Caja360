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

    const row = data as {
      customer_name: string;
      fulfillment_status: string;
      tracking_number: string | null;
      tracking_carrier: string | null;
      shipped_at: string | null;
      status: string;
      product_sku: string;
    };

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
