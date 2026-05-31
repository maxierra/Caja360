"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createMonitoredAction } from "@/lib/action-wrapper";
import { createClient } from "@/lib/supabase/server";

function getActiveBusinessId(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return cookieStore.get("active_business_id")?.value ?? null;
}

function toNumber(input: FormDataEntryValue | null) {
  const raw = String(input ?? "").replace(",", ".").trim();
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function toNullableDate(input: FormDataEntryValue | null) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  return raw;
}

async function createProductImpl(formData: FormData) {
  const cookieStore = await cookies();
  const businessId = getActiveBusinessId(cookieStore);
  if (!businessId) {
    throw new Error("missing_active_business_id");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("missing_name");
  }

  const soldByWeight = String(formData.get("sold_by_weight") ?? "off") === "on";

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    business_id: businessId,
    name,
    barcode: String(formData.get("barcode") ?? "").trim() || null,
    scale_code: String(formData.get("scale_code") ?? "").trim() || null,
    category: String(formData.get("category") ?? "").trim() || null,
    cost: toNumber(formData.get("cost")),
    price: toNumber(formData.get("price")),
    expires_at: toNullableDate(formData.get("expires_at")),
    sold_by_weight: soldByWeight,
    stock: soldByWeight ? 0 : Math.trunc(toNumber(formData.get("stock"))),
    stock_decimal: soldByWeight ? toNumber(formData.get("stock_decimal")) : 0,
    low_stock_threshold: soldByWeight ? 0 : Math.trunc(toNumber(formData.get("low_stock_threshold"))),
    low_stock_threshold_decimal: soldByWeight ? toNumber(formData.get("low_stock_threshold_decimal")) : 0,
    active: String(formData.get("active") ?? "") !== "off",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app/products");
  revalidatePath("/app/onboarding");
}

async function deleteProductImpl(formData: FormData) {
  const cookieStore = await cookies();
  const businessId = getActiveBusinessId(cookieStore);
  if (!businessId) {
    throw new Error("missing_active_business_id");
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("missing_id");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id).eq("business_id", businessId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app/products");
}

async function updateProductImpl(formData: FormData) {
  const cookieStore = await cookies();
  const businessId = getActiveBusinessId(cookieStore);
  if (!businessId) {
    throw new Error("missing_active_business_id");
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("missing_id");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("missing_name");
  }

  const soldByWeight = String(formData.get("sold_by_weight") ?? "off") === "on";

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id ?? null;
  const { data: beforeRow, error: exErr } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();

  if (exErr || !beforeRow) {
    throw new Error(exErr?.message ?? "product_not_found");
  }

  const ex = beforeRow as {
    cost: number;
    price: number;
    stock: number;
    stock_decimal: number | string;
    low_stock_threshold: number;
    low_stock_threshold_decimal: number | string;
    scale_code: string | null;
  };

  const exStockDec = Number(ex.stock_decimal);
  const exMinDec = Number(ex.low_stock_threshold_decimal);

  // Nuevos valores propuestos
  const nextCost = toNumber(formData.get("cost"));
  const nextPrice = toNumber(formData.get("price"));

  let stock: number;
  let stock_decimal: number;
  let low_stock_threshold: number;
  let low_stock_threshold_decimal: number;

  if (soldByWeight) {
    stock = 0;
    low_stock_threshold = 0;
    stock_decimal = formData.has("stock_decimal")
      ? toNumber(formData.get("stock_decimal"))
      : Number.isFinite(exStockDec)
        ? exStockDec
        : 0;
    low_stock_threshold_decimal = formData.has("low_stock_threshold_decimal")
      ? toNumber(formData.get("low_stock_threshold_decimal"))
      : Number.isFinite(exMinDec)
        ? exMinDec
        : 0;
  } else {
    stock_decimal = 0;
    low_stock_threshold_decimal = 0;
    stock = formData.has("stock") ? Math.trunc(toNumber(formData.get("stock"))) : Number(ex.stock);
    low_stock_threshold = formData.has("low_stock_threshold")
      ? Math.trunc(toNumber(formData.get("low_stock_threshold")))
      : Number(ex.low_stock_threshold);
  }

  const scale_code = formData.has("scale_code")
    ? String(formData.get("scale_code") ?? "").trim() || null
    : ex.scale_code;

  const { data: afterRow, error } = await supabase
    .from("products")
    .update({
      name,
      barcode: String(formData.get("barcode") ?? "").trim() || null,
      scale_code,
      category: String(formData.get("category") ?? "").trim() || null,
      cost: toNumber(formData.get("cost")),
      price: toNumber(formData.get("price")),
      expires_at: toNullableDate(formData.get("expires_at")),
      sold_by_weight: soldByWeight,
      stock,
      stock_decimal,
      low_stock_threshold,
      low_stock_threshold_decimal,
      active: String(formData.get("active") ?? "") !== "off",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("business_id", businessId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Validar permisos finos para cambios en precio/stock (solo para empleados que no son dueño)
  if (userId) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("role,permissions")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .maybeSingle();

    const role = (membership as any)?.role as string | null;
    const perms = ((membership as any)?.permissions ?? {}) as Record<string, unknown>;

    if (role !== "owner") {
      const priceChanged = nextCost !== Number(ex.cost) || nextPrice !== Number(ex.price);
      const stockChanged =
        stock !== Number(ex.stock) ||
        stock_decimal !== Number(ex.stock_decimal) ||
        low_stock_threshold !== Number(ex.low_stock_threshold) ||
        low_stock_threshold_decimal !== Number(ex.low_stock_threshold_decimal);

      if (priceChanged && perms.products_edit_price !== true) {
        throw new Error("forbidden_edit_price");
      }
      if (stockChanged && perms.products_edit_stock !== true) {
        throw new Error("forbidden_edit_stock");
      }
    }
  }

  const { error: activityErr } = await supabase.rpc("record_product_change_activity", {
    p_product_id: id,
    p_before: beforeRow as Record<string, unknown>,
    p_after: (afterRow ?? beforeRow) as Record<string, unknown>,
  });
  if (activityErr) {
    console.warn("[updateProduct] record_product_change_activity:", activityErr.message);
  }

  revalidatePath("/app/products");
  revalidatePath(`/app/products/${id}`);
  revalidatePath("/app/empleados");
}

export const createProduct = createMonitoredAction(createProductImpl, "products/createProduct");
export const deleteProduct = createMonitoredAction(deleteProductImpl, "products/deleteProduct");
export const updateProduct = createMonitoredAction(updateProductImpl, "products/updateProduct");
