import Afip from "@afipsdk/afip.js";
import { supabaseAdmin } from "./supabase.js";
import { loadCertAndKey } from "./cert-service.js";
import { config, type FiscalEnvironment } from "./config.js";

export type VoucherItem = {
  name: string;
  quantity: number;
  unitPrice: number;
};

const VOUCHER_TYPE_FACTURA_C = 11;
const VOUCHER_TYPE_NC_C = 13;

function formatAfipDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function formatAfipDateDisplay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function getAfipClient(businessId: string, environment: FiscalEnvironment) {
  const { cert, key, cuit } = await loadCertAndKey(businessId, environment);
  return {
    afip: new Afip({
      CUIT: Number(cuit),
      cert,
      key,
      production: environment === "prod",
      access_token: config.afipSdkAccessToken,
    }),
    cuit,
  };
}

async function getFiscalConfig(businessId: string) {
  const { data, error } = await supabaseAdmin
    .from("business_fiscal_config")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error || !data) throw new Error("Configuración fiscal no encontrada");
  if (!data.is_active) throw new Error("Facturación electrónica no está activa");
  return data;
}

async function getDefaultPos(businessId: string, environment: FiscalEnvironment) {
  const { data, error } = await supabaseAdmin
    .from("fiscal_points_of_sale")
    .select("*")
    .eq("business_id", businessId)
    .eq("environment", environment)
    .eq("is_default", true)
    .maybeSingle();
  if (error || !data) throw new Error("Punto de venta no configurado");
  return data;
}

export async function testConnection(businessId: string, environment: FiscalEnvironment) {
  const { afip } = await getAfipClient(businessId, environment);
  const pos = await getDefaultPos(businessId, environment);
  const last = await afip.ElectronicBilling.getLastVoucher(pos.pos_number, VOUCHER_TYPE_FACTURA_C);
  return { ok: true, lastVoucherNumber: last, posNumber: pos.pos_number };
}

export async function getLastVoucherNumber(
  businessId: string,
  environment: FiscalEnvironment,
  voucherType: number = VOUCHER_TYPE_FACTURA_C
) {
  const { afip } = await getAfipClient(businessId, environment);
  const pos = await getDefaultPos(businessId, environment);
  const last = await afip.ElectronicBilling.getLastVoucher(pos.pos_number, voucherType);
  return { lastVoucherNumber: last, posNumber: pos.pos_number, voucherType };
}

function buildQrPayload(params: {
  cuit: string;
  voucherType: number;
  posNumber: number;
  voucherNumber: number;
  issueDate: string;
  total: number;
  cae: string;
  buyerDocType: number;
  buyerDocNumber: string;
  environment: FiscalEnvironment;
}) {
  const ver = 1;
  const fecha = params.issueDate.replace(/-/g, "");
  const cuitNum = Number(params.cuit.replace(/\D/g, ""));
  const data = {
    ver,
    fecha,
    cuit: cuitNum,
    ptoVta: params.posNumber,
    tipoCmp: params.voucherType,
    nroCmp: params.voucherNumber,
    importe: params.total,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: params.buyerDocType,
    nroDocRec: Number(params.buyerDocNumber.replace(/\D/g, "") || 0),
    tipoCodAut: "E",
    codAut: Number(params.cae),
  };
  const json = JSON.stringify(data);
  const base64 = Buffer.from(json, "utf8").toString("base64");
  const url = params.environment === "prod"
    ? "https://www.afip.gob.ar/fe/qr/"
    : "https://www.afip.gob.ar/fe/qr/";
  return `${url}?p=${base64}`;
}

export async function issueFacturaC(params: {
  businessId: string;
  environment: FiscalEnvironment;
  saleId?: string | null;
  items: VoucherItem[];
  buyerDocType?: number;
  buyerDocNumber?: string;
  buyerName?: string;
  concept?: number;
}) {
  const config = await getFiscalConfig(params.businessId);
  const { afip, cuit } = await getAfipClient(params.businessId, params.environment);
  const pos = await getDefaultPos(params.businessId, params.environment);

  const total = params.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const roundedTotal = Math.round(total * 100) / 100;
  const now = new Date();
  const issueDate = formatAfipDateDisplay(now);
  const buyerDocType = params.buyerDocType ?? 99;
  const buyerDocNumber = params.buyerDocNumber ?? "0";

  const voucherData = {
    CantReg: 1,
    PtoVta: pos.pos_number,
    CbteTipo: VOUCHER_TYPE_FACTURA_C,
    Concepto: params.concept ?? 1,
    DocTipo: buyerDocType,
    DocNro: Number(buyerDocNumber.replace(/\D/g, "") || 0),
    CbteDesde: 0,
    CbteHasta: 0,
    CbteFch: formatAfipDate(now),
    ImpTotal: roundedTotal,
    ImpTotConc: 0,
    ImpNeto: roundedTotal,
    ImpOpEx: 0,
    ImpIVA: 0,
    ImpTrib: 0,
    MonId: "PES",
    MonCotiz: 1,
    CondicionIVAReceptorId: 5,
  };

  const result = await afip.ElectronicBilling.createNextVoucher(voucherData);
  const voucherNumber = result.voucher_number;
  const cae = result.CAE;
  const caeExpires = result.CAEFchVto;
  const caeExpiresAt = `${caeExpires.slice(0, 4)}-${caeExpires.slice(4, 6)}-${caeExpires.slice(6, 8)}`;

  const qrPayload = buildQrPayload({
    cuit,
    voucherType: VOUCHER_TYPE_FACTURA_C,
    posNumber: pos.pos_number,
    voucherNumber,
    issueDate,
    total: roundedTotal,
    cae,
    buyerDocType,
    buyerDocNumber,
    environment: params.environment,
  });

  const { data: voucher, error: vErr } = await supabaseAdmin
    .from("fiscal_vouchers")
    .insert({
      business_id: params.businessId,
      environment: params.environment,
      sale_id: params.saleId ?? null,
      voucher_type: VOUCHER_TYPE_FACTURA_C,
      pos_number: pos.pos_number,
      voucher_number: voucherNumber,
      concept: params.concept ?? 1,
      issue_date: issueDate,
      buyer_doc_type: buyerDocType,
      buyer_doc_number: buyerDocNumber,
      buyer_name: params.buyerName ?? "Consumidor Final",
      total: roundedTotal,
      cae,
      cae_expires_at: caeExpiresAt,
      afip_result: result,
      status: "approved",
      billing_mode: config.billing_mode,
      qr_payload: qrPayload,
    })
    .select("id")
    .single();
  if (vErr) throw new Error(`Error guardando comprobante: ${vErr.message}`);

  const itemRows = params.items.map((item) => ({
    voucher_id: voucher.id,
    business_id: params.businessId,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    subtotal: Math.round(item.quantity * item.unitPrice * 100) / 100,
  }));
  await supabaseAdmin.from("fiscal_voucher_items").insert(itemRows);

  await supabaseAdmin
    .from("fiscal_points_of_sale")
    .update({
      last_authorized_numbers: {
        ...(pos.last_authorized_numbers as Record<string, number>),
        [String(VOUCHER_TYPE_FACTURA_C)]: voucherNumber,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", pos.id);

  return {
    voucherId: voucher.id,
    voucherType: VOUCHER_TYPE_FACTURA_C,
    voucherTypeLabel: "Factura C",
    posNumber: pos.pos_number,
    voucherNumber,
    cae,
    caeExpiresAt,
    qrPayload,
    total: roundedTotal,
  };
}

export async function issueCreditNoteC(params: {
  businessId: string;
  environment: FiscalEnvironment;
  originalVoucherId: string;
}) {
  const { data: original, error: oErr } = await supabaseAdmin
    .from("fiscal_vouchers")
    .select("*, fiscal_voucher_items(*)")
    .eq("id", params.originalVoucherId)
    .eq("business_id", params.businessId)
    .maybeSingle();
  if (oErr || !original) throw new Error("Comprobante original no encontrado");
  if (original.status !== "approved") throw new Error("Solo se puede emitir NC sobre comprobantes aprobados");
  if (original.voucher_type !== VOUCHER_TYPE_FACTURA_C) throw new Error("Solo NC C sobre Factura C en Fase 1");

  const { afip, cuit } = await getAfipClient(params.businessId, params.environment);
  const pos = await getDefaultPos(params.businessId, params.environment);
  const total = Number(original.total);
  const now = new Date();
  const issueDate = formatAfipDateDisplay(now);

  const voucherData = {
    CantReg: 1,
    PtoVta: pos.pos_number,
    CbteTipo: VOUCHER_TYPE_NC_C,
    Concepto: original.concept,
    DocTipo: original.buyer_doc_type,
    DocNro: Number(String(original.buyer_doc_number).replace(/\D/g, "") || 0),
    CbteDesde: 0,
    CbteHasta: 0,
    CbteFch: formatAfipDate(now),
    ImpTotal: total,
    ImpTotConc: 0,
    ImpNeto: total,
    ImpOpEx: 0,
    ImpIVA: 0,
    ImpTrib: 0,
    MonId: "PES",
    MonCotiz: 1,
    CondicionIVAReceptorId: 5,
    CbtesAsoc: [
      {
        Tipo: original.voucher_type,
        PtoVta: original.pos_number,
        Nro: original.voucher_number,
        Cuit: Number(cuit.replace(/\D/g, "")),
      },
    ],
  };

  const result = await afip.ElectronicBilling.createNextVoucher(voucherData);
  const voucherNumber = result.voucher_number;
  const cae = result.CAE;
  const caeExpires = result.CAEFchVto;
  const caeExpiresAt = `${caeExpires.slice(0, 4)}-${caeExpires.slice(4, 6)}-${caeExpires.slice(6, 8)}`;

  const qrPayload = buildQrPayload({
    cuit,
    voucherType: VOUCHER_TYPE_NC_C,
    posNumber: pos.pos_number,
    voucherNumber,
    issueDate,
    total,
    cae,
    buyerDocType: original.buyer_doc_type,
    buyerDocNumber: String(original.buyer_doc_number),
    environment: params.environment,
  });

  const { data: nc, error: ncErr } = await supabaseAdmin
    .from("fiscal_vouchers")
    .insert({
      business_id: params.businessId,
      environment: params.environment,
      sale_id: original.sale_id,
      voucher_type: VOUCHER_TYPE_NC_C,
      pos_number: pos.pos_number,
      voucher_number: voucherNumber,
      concept: original.concept,
      issue_date: issueDate,
      buyer_doc_type: original.buyer_doc_type,
      buyer_doc_number: original.buyer_doc_number,
      buyer_name: original.buyer_name,
      total,
      cae,
      cae_expires_at: caeExpiresAt,
      afip_result: result,
      status: "approved",
      billing_mode: original.billing_mode,
      qr_payload: qrPayload,
    })
    .select("id")
    .single();
  if (ncErr) throw new Error(`Error guardando NC: ${ncErr.message}`);

  const items = (original.fiscal_voucher_items ?? []) as Array<{
    name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
  if (items.length) {
    await supabaseAdmin.from("fiscal_voucher_items").insert(
      items.map((item) => ({
        voucher_id: nc.id,
        business_id: params.businessId,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }))
    );
  }

  await supabaseAdmin.from("fiscal_voucher_links").insert({
    credit_note_id: nc.id,
    original_voucher_id: original.id,
    associated_voucher_type: original.voucher_type,
    associated_pos_number: original.pos_number,
    associated_voucher_number: original.voucher_number,
  });

  await supabaseAdmin
    .from("fiscal_vouchers")
    .update({ status: "voided_nc", updated_at: new Date().toISOString() })
    .eq("id", original.id);

  return {
    voucherId: nc.id,
    voucherType: VOUCHER_TYPE_NC_C,
    voucherTypeLabel: "Nota de Crédito C",
    posNumber: pos.pos_number,
    voucherNumber,
    cae,
    caeExpiresAt,
    qrPayload,
    total,
  };
}

export { VOUCHER_TYPE_FACTURA_C, VOUCHER_TYPE_NC_C };
