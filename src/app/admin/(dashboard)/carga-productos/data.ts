import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailIsPlatformAdmin } from "@/lib/platform-admin";

export type AdminProductLoadTotal = {
  businessId: string;
  businessName: string;
  totalProductos: number;
};

export type LoadAdminProductLoadTotalsResult =
  | { ok: false; error: "forbidden" | "config"; message?: string }
  | { ok: true; rows: AdminProductLoadTotal[] };

export async function loadAdminProductLoadTotals(): Promise<LoadAdminProductLoadTotalsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !emailIsPlatformAdmin(user.email)) {
    return { ok: false, error: "forbidden" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "config", message: "Falta SUPABASE_SERVICE_ROLE_KEY." };
  }

  const { data, error } = await admin.rpc("admin_product_load_totals");

  if (error) {
    return { ok: false, error: "config", message: error.message };
  }

  const rows: AdminProductLoadTotal[] = (data ?? []).map(
    (row: { business_id: string; business_name: string | null; total_productos: number | string }) => ({
      businessId: row.business_id,
      businessName: row.business_name ?? "Negocio desconocido",
      totalProductos: Number(row.total_productos) || 0,
    })
  );

  return { ok: true, rows };
}
