"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createMonitoredAction } from "@/lib/action-wrapper";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type MembershipRow = {
  role: string | null;
  permissions: Record<string, unknown> | null;
};

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

function toNullableText(input: FormDataEntryValue | null) {
  const raw = String(input ?? "").trim();
  return raw || null;
}

function splitVariantValues(input: FormDataEntryValue | null) {
  const raw = String(input ?? "").trim();
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function normalizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getImageExtension(file: File) {
  const fromType = file.type.split("/")[1]?.trim().toLowerCase();
  if (fromType) {
    if (fromType === "jpeg") return "jpg";
    return fromType;
  }
  const fromName = file.name.split(".").pop()?.trim().toLowerCase();
  return fromName || "bin";
}

function buildProductImagePath(businessId: string, productId: string, file: File) {
  const ext = getImageExtension(file);
  const baseName = normalizeFileName(file.name.replace(/\.[^.]+$/, "")) || "foto";
  return `${businessId}/${productId}/${baseName}.${ext}`;
}

async function uploadProductImage(params: {
  businessId: string;
  productId: string;
  file: File;
}) {
  const admin = createAdminClient();
  const path = buildProductImagePath(params.businessId, params.productId, params.file);
  const bytes = Buffer.from(await params.file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from("product-images").upload(path, bytes, {
    contentType: params.file.type || undefined,
    upsert: true,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = admin.storage.from("product-images").getPublicUrl(path);
  return { imagePath: path, imageUrl: data.publicUrl };
}

async function deleteProductImage(path: string | null | undefined) {
  if (!path) return;
  const admin = createAdminClient();
  const { error } = await admin.storage.from("product-images").remove([path]);
  if (error) {
    console.warn("[products] delete image:", error.message);
  }
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
  const businessType = String(formData.get("business_type") ?? "retail").trim();
  const baseCategory = toNullableText(formData.get("category"));
  const baseCost = toNumber(formData.get("cost"));
  const basePrice = toNumber(formData.get("price"));
  const baseActive = String(formData.get("active") ?? "") !== "off";
  const baseStock = soldByWeight ? 0 : Math.trunc(toNumber(formData.get("stock")));
  const baseStockDecimal = soldByWeight ? toNumber(formData.get("stock_decimal")) : 0;
  const baseLowStockThreshold = soldByWeight ? 0 : Math.trunc(toNumber(formData.get("low_stock_threshold")));
  const baseLowStockThresholdDecimal = soldByWeight ? toNumber(formData.get("low_stock_threshold_decimal")) : 0;
  const imageFile = formData.get("image_file");
  const image = imageFile instanceof File && imageFile.size > 0 ? imageFile : null;

  if (businessType === "fashion") {
    const sizes = splitVariantValues(formData.get("sizes_input"));
    const colors = splitVariantValues(formData.get("colors_input"));
    const variantGroup = toNullableText(formData.get("variant_group")) ?? crypto.randomUUID();
    const sizeValues = sizes.length ? sizes : [null];
    const colorValues = colors.length ? colors : [null];
    const rowIds = sizeValues.flatMap(() => colorValues.map(() => crypto.randomUUID()));
    let index = 0;
    const rows: Array<{
      id: string;
      business_id: string;
      name: string;
      barcode: string | null;
      scale_code: string | null;
      category: string | null;
      variant_group: string;
      size: string | null;
      color: string | null;
      image_path: string | null;
      image_url: string | null;
      cost: number;
      price: number;
      expires_at: null;
      sold_by_weight: boolean;
      stock: number;
      stock_decimal: number;
      low_stock_threshold: number;
      low_stock_threshold_decimal: number;
      active: boolean;
    }> = sizeValues.flatMap((size) =>
      colorValues.map((color) => ({
        id: rowIds[index++],
        business_id: businessId,
        name,
        barcode: null,
        scale_code: null,
        category: baseCategory,
        variant_group: variantGroup,
        size,
        color,
        image_path: null,
        image_url: null,
        cost: baseCost,
        price: basePrice,
        expires_at: null,
        sold_by_weight: false,
        stock: baseStock,
        stock_decimal: 0,
        low_stock_threshold: baseLowStockThreshold,
        low_stock_threshold_decimal: 0,
        active: baseActive,
      }))
    );

    const supabase = await createClient();
    if (image) {
      const uploads = await Promise.all(rowIds.map((productId) => uploadProductImage({ businessId, productId, file: image })));
      rows.forEach((row, rowIndex) => {
        row.image_path = uploads[rowIndex]?.imagePath ?? null;
        row.image_url = uploads[rowIndex]?.imageUrl ?? null;
      });
    }
    const { error } = await supabase.from("products").insert(rows);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/app/products");
    revalidatePath("/app/onboarding");
    return;
  }

  const supabase = await createClient();
  const productId = crypto.randomUUID();
  const imageUpload = image ? await uploadProductImage({ businessId, productId, file: image }) : null;
  const { error } = await supabase.from("products").insert({
    id: productId,
    business_id: businessId,
    name,
    image_path: imageUpload?.imagePath ?? null,
    image_url: imageUpload?.imageUrl ?? null,
    barcode: toNullableText(formData.get("barcode")),
    scale_code: toNullableText(formData.get("scale_code")),
    category: baseCategory,
    variant_group: toNullableText(formData.get("variant_group")),
    size: toNullableText(formData.get("size")),
    color: toNullableText(formData.get("color")),
    cost: baseCost,
    price: basePrice,
    expires_at: toNullableDate(formData.get("expires_at")),
    sold_by_weight: soldByWeight,
    stock: baseStock,
    stock_decimal: baseStockDecimal,
    low_stock_threshold: baseLowStockThreshold,
    low_stock_threshold_decimal: baseLowStockThresholdDecimal,
    active: baseActive,
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
  const { data: existing } = await supabase
    .from("products")
    .select("image_path")
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle();

  await deleteProductImage((existing as { image_path?: string | null } | null)?.image_path);
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
  const imageFile = formData.get("image_file");
  const image = imageFile instanceof File && imageFile.size > 0 ? imageFile : null;

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
  const currentImagePath = (beforeRow as { image_path?: string | null }).image_path ?? null;
  const currentImageUrl = (beforeRow as { image_url?: string | null }).image_url ?? null;
  const nextImage = image ? await uploadProductImage({ businessId, productId: id, file: image }) : null;
  if (image && currentImagePath && currentImagePath !== nextImage?.imagePath) {
    await deleteProductImage(currentImagePath);
  }

  const { data: afterRow, error } = await supabase
    .from("products")
    .update({
      name,
      image_path: nextImage?.imagePath ?? currentImagePath,
      image_url: nextImage?.imageUrl ?? currentImageUrl,
      barcode: toNullableText(formData.get("barcode")),
      scale_code,
      category: toNullableText(formData.get("category")),
      variant_group: toNullableText(formData.get("variant_group")),
      size: toNullableText(formData.get("size")),
      color: toNullableText(formData.get("color")),
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

    const typedMembership = membership as MembershipRow | null;
    const role = typedMembership?.role ?? null;
    const perms = typedMembership?.permissions ?? {};

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
