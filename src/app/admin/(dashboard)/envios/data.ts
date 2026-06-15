import { createAdminClient } from "@/lib/supabase/admin";
import type { StoreShipmentRow } from "@/app/admin/(dashboard)/envios/actions";

export async function loadStoreShipments(filter?: "pending" | "shipped" | "all"): Promise<StoreShipmentRow[]> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  let query = admin
    .from("store_orders")
    .select(
      `
      id,created_at,email,customer_name,phone,business_name,product_sku,
      shipping_address,shipping_city,shipping_province,shipping_postal_code,
      fulfillment_status,tracking_number,tracking_carrier,shipped_at,tracking_token,status,
      store_products(name,includes_hardware)
    `
    )
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filter === "pending") {
    query = query.eq("fulfillment_status", "pending_shipment");
  } else if (filter === "shipped") {
    query = query.in("fulfillment_status", ["shipped", "delivered"]);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = (data as Array<Record<string, unknown>>)
    .map((row) => {
    const product = row.store_products as { name?: string; includes_hardware?: boolean } | null;
    return {
      id: String(row.id),
      created_at: String(row.created_at),
      email: String(row.email),
      customer_name: String(row.customer_name),
      phone: String(row.phone),
      business_name: String(row.business_name),
      product_sku: String(row.product_sku),
      product_name: String(product?.name ?? row.product_sku),
      shipping_address: row.shipping_address as string | null,
      shipping_city: row.shipping_city as string | null,
      shipping_province: row.shipping_province as string | null,
      shipping_postal_code: row.shipping_postal_code as string | null,
      fulfillment_status: String(row.fulfillment_status),
      tracking_number: row.tracking_number as string | null,
      tracking_carrier: row.tracking_carrier as string | null,
      shipped_at: row.shipped_at as string | null,
      tracking_token: String(row.tracking_token),
      status: String(row.status),
      includes_hardware: Boolean(product?.includes_hardware),
    };
  })
    .filter((r) => r.includes_hardware);

  if (filter === "pending") {
    return rows.filter((r) => r.fulfillment_status === "pending_shipment");
  }
  if (filter === "shipped") {
    return rows.filter((r) => r.fulfillment_status === "shipped" || r.fulfillment_status === "delivered");
  }
  return rows;
}
