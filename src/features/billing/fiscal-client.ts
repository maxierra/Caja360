import type { IssueVoucherResult } from "./types";

const FISCAL_API_URL = process.env.FISCAL_API_URL ?? "http://localhost:3099";
const FISCAL_API_KEY = process.env.FISCAL_API_KEY ?? "";

type FiscalEnvironment = "homolog" | "prod";

async function fiscalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!FISCAL_API_KEY) {
    throw new Error("FISCAL_API_KEY no configurada en el servidor");
  }
  const res = await fetch(`${FISCAL_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FISCAL_API_KEY}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Error fiscal API (${res.status})`);
  }
  return data as T;
}

export async function generateFiscalCsr(params: {
  businessId: string;
  environment: FiscalEnvironment;
  cuit: string;
  razonSocial: string;
  uploadedBy?: string;
}) {
  return fiscalFetch<{ ok: boolean; csrPem: string }>("/cert/generate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function uploadFiscalCertificate(params: {
  businessId: string;
  environment: FiscalEnvironment;
  certPem: string;
  uploadedBy?: string;
}) {
  return fiscalFetch<{ ok: boolean; cuit: string; expiresAt: string }>("/cert/upload", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function testFiscalConnection(params: {
  businessId: string;
  environment: FiscalEnvironment;
}) {
  return fiscalFetch<{ ok: boolean; lastVoucherNumber: number; posNumber: number }>("/auth/test", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function syncLastVoucherNumber(params: {
  businessId: string;
  environment: FiscalEnvironment;
  voucherType?: number;
}) {
  const q = new URLSearchParams({
    businessId: params.businessId,
    environment: params.environment,
    voucherType: String(params.voucherType ?? 11),
  });
  return fiscalFetch<{ lastVoucherNumber: number; posNumber: number; voucherType: number }>(
    `/voucher/last-number?${q}`
  );
}

export async function issueFiscalVoucher(params: {
  businessId: string;
  environment: FiscalEnvironment;
  saleId?: string | null;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  buyerDocType?: number;
  buyerDocNumber?: string;
  buyerName?: string;
  concept?: number;
}): Promise<IssueVoucherResult> {
  return fiscalFetch<IssueVoucherResult>("/voucher/issue", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function issueFiscalCreditNote(params: {
  businessId: string;
  environment: FiscalEnvironment;
  originalVoucherId: string;
}): Promise<IssueVoucherResult> {
  return fiscalFetch<IssueVoucherResult>("/voucher/credit-note", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function downloadFiscalCsr(params: {
  businessId: string;
  environment: FiscalEnvironment;
}): Promise<ArrayBuffer> {
  if (!FISCAL_API_KEY) throw new Error("FISCAL_API_KEY no configurada");
  const q = new URLSearchParams(params);
  const res = await fetch(`${FISCAL_API_URL}/cert/download-csr?${q}`, {
    headers: { Authorization: `Bearer ${FISCAL_API_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Error descargando CSR");
  }
  return res.arrayBuffer();
}
