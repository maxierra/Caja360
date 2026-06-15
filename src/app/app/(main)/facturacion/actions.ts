"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { issueFiscalVoucher } from "@/features/billing/fiscal-client";
import type { FiscalVoucher, IssueVoucherResult } from "@/features/billing/types";

async function getBusinessId() {
  const businessId = (await cookies()).get("active_business_id")?.value;
  if (!businessId) throw new Error("Negocio no seleccionado");
  return businessId;
}

export async function emitFiscalVoucherForSale(params: {
  saleId: string;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  concept?: number;
}): Promise<IssueVoucherResult | null> {
  const businessId = await getBusinessId();
  const supabase = await createClient();

  const { data: config } = await supabase
    .from("business_fiscal_config")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (!config?.is_active || config.billing_mode !== "per_sale") {
    return null;
  }
  if (config.tax_condition !== "monotributo") {
    throw new Error("Responsable Inscripto disponible en Fase 3");
  }

  try {
    const result = await issueFiscalVoucher({
      businessId,
      environment: config.environment as "homolog" | "prod",
      saleId: params.saleId,
      items: params.items,
      concept: params.concept ?? 1,
    });
    revalidatePath("/app/facturacion");
    return result;
  } catch (e) {
    await supabase.from("fiscal_vouchers").insert({
      business_id: businessId,
      environment: config.environment,
      sale_id: params.saleId,
      voucher_type: 11,
      pos_number: 0,
      voucher_number: 0,
      issue_date: new Date().toISOString().slice(0, 10),
      total: params.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
      status: "rejected",
      rejection_reason: e instanceof Error ? e.message : "Error AFIP",
      billing_mode: "per_sale",
    });
    throw e;
  }
}

export async function getFiscalVouchers(params?: {
  from?: string;
  to?: string;
  status?: string;
}): Promise<FiscalVoucher[]> {
  const businessId = await getBusinessId();
  const supabase = await createClient();

  let query = supabase
    .from("fiscal_vouchers")
    .select("*, fiscal_voucher_items(*)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (params?.from) query = query.gte("issue_date", params.from);
  if (params?.to) query = query.lte("issue_date", params.to);
  if (params?.status) query = query.eq("status", params.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as FiscalVoucher[];
}

export async function getFiscalVoucherBySaleId(saleId: string) {
  const businessId = await getBusinessId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("fiscal_vouchers")
    .select("*")
    .eq("business_id", businessId)
    .eq("sale_id", saleId)
    .eq("status", "approved")
    .maybeSingle();
  return data;
}

export type PendingConsolidationRow = {
  id: string;
  sale_id: string;
  consolidated_period: string;
  status: string;
  created_at: string;
};

export async function getPendingConsolidationSummary(): Promise<{
  billingMode: "per_sale" | "consolidated" | null;
  pending: PendingConsolidationRow[];
  byPeriod: Record<string, number>;
}> {
  const businessId = await getBusinessId();
  const supabase = await createClient();

  const [{ data: config }, { data: pending }] = await Promise.all([
    supabase.from("business_fiscal_config").select("billing_mode").eq("business_id", businessId).maybeSingle(),
    supabase
      .from("fiscal_pending_consolidation")
      .select("id,sale_id,consolidated_period,status,created_at")
      .eq("business_id", businessId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const rows = (pending ?? []) as PendingConsolidationRow[];
  const byPeriod: Record<string, number> = {};
  for (const row of rows) {
    byPeriod[row.consolidated_period] = (byPeriod[row.consolidated_period] ?? 0) + 1;
  }

  return {
    billingMode: (config?.billing_mode as "per_sale" | "consolidated" | null) ?? null,
    pending: rows,
    byPeriod,
  };
}
