import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type ProductLookupRow = {
  id: string;
  name: string | null;
  barcode: string | null;
  sku: string | null;
  category: string | null;
};

function sanitizeLike(value: string) {
  return value.replace(/[%_]/g, "").trim();
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.json({ error: "Sesión expirada" }, { status: 401 });
  }

  const url = new URL(request.url);
  const code = (url.searchParams.get("code") ?? "").trim();

  const cookies = await import("next/headers").then((m) => m.cookies());
  const businessId = cookies.get("active_business_id")?.value;
  if (!businessId) {
    return NextResponse.json({ error: "No hay negocio activo" }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "Falta código o texto" }, { status: 400 });
  }

  const normalized = sanitizeLike(code);
  const pattern = `%${normalized}%`;

  const { data, error } = await supabase
    .from("products")
    .select("id,name,barcode,sku,category")
    .eq("business_id", businessId)
    .or(`barcode.eq.${code},sku.eq.${code},name.ilike.${pattern},barcode.ilike.${pattern},sku.ilike.${pattern}`)
    .order("name", { ascending: true })
    .limit(8);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = ((data ?? []) as ProductLookupRow[]).map((row) => ({
    id: String(row.id),
    name: row.name ? String(row.name) : null,
    barcode: row.barcode ? String(row.barcode) : null,
    sku: row.sku ? String(row.sku) : null,
    category: row.category ? String(row.category) : null,
  }));

  if (results.length === 0) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    id: results[0]!.id,
    name: results[0]!.name,
    barcode: results[0]!.barcode,
    sku: results[0]!.sku,
    category: results[0]!.category,
    results,
  });
}
