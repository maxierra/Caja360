export type FiscalEnvironment = "homolog" | "prod";

export type FiscalBillingMode = "per_sale" | "consolidated";

export type TaxCondition = "monotributo" | "ri";

export type FiscalVoucherStatus = "pending" | "approved" | "rejected" | "voided_nc";

export type FiscalCertificateStatus = "pending_upload" | "active" | "expired" | "revoked";

export type BusinessFiscalConfig = {
  id: string;
  business_id: string;
  tax_condition: TaxCondition;
  cuit: string | null;
  razon_social: string | null;
  domicilio_fiscal: string | null;
  iibb: string | null;
  environment: FiscalEnvironment;
  billing_mode: FiscalBillingMode;
  default_voucher_type: number;
  is_active: boolean;
  last_sync_at: string | null;
};

export type FiscalPointOfSale = {
  id: string;
  business_id: string;
  environment: FiscalEnvironment;
  pos_number: number;
  voucher_types: number[];
  is_default: boolean;
  last_authorized_numbers: Record<string, number>;
};

export type FiscalCertificate = {
  id: string;
  business_id: string;
  environment: FiscalEnvironment;
  cuit: string;
  status: FiscalCertificateStatus;
  issued_at: string | null;
  expires_at: string | null;
};

export type FiscalVoucher = {
  id: string;
  business_id: string;
  environment: FiscalEnvironment;
  sale_id: string | null;
  voucher_type: number;
  pos_number: number;
  voucher_number: number;
  issue_date: string;
  buyer_name: string | null;
  buyer_doc_number: string;
  total: number;
  cae: string | null;
  cae_expires_at: string | null;
  status: FiscalVoucherStatus;
  billing_mode: FiscalBillingMode;
  qr_payload: string | null;
  rejection_reason: string | null;
  created_at: string;
  fiscal_voucher_items?: FiscalVoucherItem[];
};

export type FiscalVoucherItem = {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type IssueVoucherResult = {
  voucherId: string;
  voucherType: number;
  voucherTypeLabel: string;
  posNumber: number;
  voucherNumber: number;
  cae: string;
  caeExpiresAt: string;
  qrPayload: string;
  total: number;
};

export const VOUCHER_TYPE_LABELS: Record<number, string> = {
  11: "Factura C",
  13: "Nota de Crédito C",
};

export function voucherTypeLabel(type: number): string {
  return VOUCHER_TYPE_LABELS[type] ?? `Comprobante ${type}`;
}
