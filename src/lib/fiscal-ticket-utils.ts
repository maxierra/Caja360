"use client";

import type { FiscalVoucher } from "@/features/billing/types";
import { voucherTypeLabel } from "@/features/billing/types";

export function printFiscalVoucherTicket(voucher: FiscalVoucher) {
  const lines = [
    "*** COMPROBANTE FISCAL ***",
    voucherTypeLabel(voucher.voucher_type),
    `PtoVta: ${voucher.pos_number}  Nº: ${voucher.voucher_number}`,
    `Fecha: ${voucher.issue_date}`,
    `Cliente: ${voucher.buyer_name ?? "Consumidor Final"}`,
    "---",
    ...(voucher.fiscal_voucher_items ?? []).map(
      (i) => `${i.name} x${i.quantity}  $${Number(i.subtotal).toFixed(2)}`
    ),
    "---",
    `TOTAL: $${Number(voucher.total).toFixed(2)}`,
    `CAE: ${voucher.cae ?? ""}`,
    `Vto CAE: ${voucher.cae_expires_at ?? ""}`,
    voucher.qr_payload ? `QR: ${voucher.qr_payload}` : "",
    "***",
  ].filter(Boolean);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comprobante</title>
<style>body{font-family:monospace;font-size:12px;width:80mm;margin:0;padding:8px}pre{white-space:pre-wrap;margin:0}</style></head>
<body><pre>${lines.join("\n")}</pre><script>window.onload=function(){window.print();}</script></body></html>`;

  const w = window.open("", "_blank", "width=400,height=600");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

export type FiscalTicketData = {
  voucherTypeLabel: string;
  posNumber: number;
  voucherNumber: number;
  cae: string;
  caeExpiresAt: string;
  qrPayload: string;
};

export function appendFiscalLinesToTicket(lines: string[], fiscal: FiscalTicketData): string[] {
  lines.push("----------------");
  lines.push(fiscal.voucherTypeLabel);
  lines.push(`PtoVta: ${fiscal.posNumber}  Comp: ${fiscal.voucherNumber}`);
  lines.push(`CAE: ${fiscal.cae}`);
  lines.push(`Vto CAE: ${fiscal.caeExpiresAt}`);
  if (fiscal.qrPayload) lines.push(`Verificar: ${fiscal.qrPayload}`);
  return lines;
}
