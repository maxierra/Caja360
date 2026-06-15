"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  generateFiscalCsr,
  uploadFiscalCertificate,
  testFiscalConnection,
  syncLastVoucherNumber,
  issueFiscalCreditNote,
  downloadFiscalCsr,
} from "@/features/billing/fiscal-client";
import type {
  BusinessFiscalConfig,
  FiscalCertificate,
  FiscalEnvironment,
  FiscalPointOfSale,
} from "@/features/billing/types";

async function getBusinessContext() {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;
  if (!businessId) throw new Error("Negocio no seleccionado");
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  return { businessId, userId: userData.user?.id ?? null, supabase };
}

export async function getFiscalSettings(): Promise<{
  config: BusinessFiscalConfig | null;
  posHomolog: FiscalPointOfSale | null;
  posProd: FiscalPointOfSale | null;
  certHomolog: FiscalCertificate | null;
  certProd: FiscalCertificate | null;
}> {
  const { businessId, supabase } = await getBusinessContext();

  const [{ data: config }, { data: posRows }, { data: certRows }] = await Promise.all([
    supabase.from("business_fiscal_config").select("*").eq("business_id", businessId).maybeSingle(),
    supabase.from("fiscal_points_of_sale").select("*").eq("business_id", businessId),
    supabase.from("fiscal_certificates").select("id,business_id,environment,cuit,status,issued_at,expires_at").eq("business_id", businessId),
  ]);

  const pos = (posRows ?? []) as FiscalPointOfSale[];
  const certs = (certRows ?? []) as FiscalCertificate[];

  return {
    config: (config as BusinessFiscalConfig | null) ?? null,
    posHomolog: pos.find((p) => p.environment === "homolog") ?? null,
    posProd: pos.find((p) => p.environment === "prod") ?? null,
    certHomolog: certs.find((c) => c.environment === "homolog") ?? null,
    certProd: certs.find((c) => c.environment === "prod") ?? null,
  };
}

export async function saveFiscalConfig(input: {
  tax_condition: "monotributo" | "ri";
  cuit: string;
  razon_social: string;
  domicilio_fiscal: string;
  iibb?: string;
  environment: FiscalEnvironment;
  billing_mode: "per_sale" | "consolidated";
  is_active: boolean;
  pos_number_homolog?: number;
  pos_number_prod?: number;
}) {
  const { businessId, supabase } = await getBusinessContext();

  const { error: cfgErr } = await supabase.from("business_fiscal_config").upsert(
    {
      business_id: businessId,
      tax_condition: input.tax_condition,
      cuit: input.cuit.replace(/\D/g, ""),
      razon_social: input.razon_social.trim(),
      domicilio_fiscal: input.domicilio_fiscal.trim(),
      iibb: input.iibb?.trim() || null,
      environment: input.environment,
      billing_mode: input.billing_mode,
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" }
  );
  if (cfgErr) throw new Error(cfgErr.message);

  await supabase.from("businesses").update({ cuit: input.cuit.replace(/\D/g, "") }).eq("id", businessId);

  if (input.pos_number_homolog) {
    await supabase.from("fiscal_points_of_sale").upsert(
      {
        business_id: businessId,
        environment: "homolog",
        pos_number: input.pos_number_homolog,
        voucher_types: [11, 13],
        is_default: input.environment === "homolog",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,environment,pos_number" }
    );
  }
  if (input.pos_number_prod) {
    await supabase.from("fiscal_points_of_sale").upsert(
      {
        business_id: businessId,
        environment: "prod",
        pos_number: input.pos_number_prod,
        voucher_types: [11, 13],
        is_default: input.environment === "prod",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,environment,pos_number" }
    );
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/facturacion");
  revalidatePath("/app/pos");
}

export async function generateCertificateRequest(input: {
  environment: FiscalEnvironment;
  cuit: string;
  razonSocial: string;
}) {
  const { businessId, userId } = await getBusinessContext();
  return generateFiscalCsr({
    businessId,
    environment: input.environment,
    cuit: input.cuit,
    razonSocial: input.razonSocial,
    uploadedBy: userId ?? undefined,
  });
}

export async function uploadCertificateFromPem(input: {
  environment: FiscalEnvironment;
  certPem: string;
}) {
  const { businessId, userId } = await getBusinessContext();
  const result = await uploadFiscalCertificate({
    businessId,
    environment: input.environment,
    certPem: input.certPem,
    uploadedBy: userId ?? undefined,
  });
  revalidatePath("/app/settings");
  return result;
}

export async function testFiscalAuth(environment: FiscalEnvironment) {
  const { businessId } = await getBusinessContext();
  return testFiscalConnection({ businessId, environment });
}

export async function syncFiscalLastNumber(environment: FiscalEnvironment) {
  const { businessId, supabase } = await getBusinessContext();
  const result = await syncLastVoucherNumber({ businessId, environment, voucherType: 11 });
  await supabase
    .from("fiscal_points_of_sale")
    .update({
      last_authorized_numbers: { "11": result.lastVoucherNumber },
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("environment", environment)
    .eq("pos_number", result.posNumber);
  revalidatePath("/app/settings");
  return result;
}

export async function downloadCertificateCsr(environment: FiscalEnvironment) {
  const { businessId } = await getBusinessContext();
  const buffer = await downloadFiscalCsr({ businessId, environment });
  return Buffer.from(buffer).toString("utf8");
}

export async function emitCreditNoteForVoucher(voucherId: string) {
  const { businessId } = await getBusinessContext();
  const settings = await getFiscalSettings();
  const environment = settings.config?.environment ?? "homolog";
  const result = await issueFiscalCreditNote({
    businessId,
    environment,
    originalVoucherId: voucherId,
  });
  revalidatePath("/app/facturacion");
  return result;
}

/** Fase 2: agregar venta a cola consolidada */
export async function queueSaleForConsolidated(saleId: string, period: string) {
  const { businessId, supabase } = await getBusinessContext();
  const { error } = await supabase.from("fiscal_pending_consolidation").insert({
    business_id: businessId,
    sale_id: saleId,
    consolidated_period: period,
    status: "pending",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/facturacion");
}

/** Fase 2: cerrar período consolidado (stub — emisión vía fiscal-api /voucher/consolidated) */
export async function closeConsolidatedPeriod(_period: string) {
  throw new Error("Facturación consolidada: disponible en Fase 2. Configurá billing_mode=consolidated y usá el cierre de período en Facturación.");
}
