"use client";

export type PosBusinessInfo = {
  name: string;
  address: string | null;
  phone: string | null;
  cuit: string | null;
  ticket_header: string | null;
  ticket_footer: string | null;
} | null;

export type TicketItem = {
  name: string;
  quantity: number;
  unit_price: number;
};

export type TicketData = {
  business: PosBusinessInfo;
  saleId?: string;
  movementId?: string;
  items?: TicketItem[];
  total: number;
  paymentMethod?: string;
  /** Etiquetas personalizadas por código (desde configuración del negocio). */
  paymentMethodLabels?: Record<string, string>;
  cashReceived?: number;
  reason?: string;
  notes?: string;
  kind: "sale" | "manual" | "opening" | "void" | "closure";
  created_at?: string;
  /** Datos fiscales ARCA/AFIP cuando la venta tiene comprobante electrónico. */
  fiscal?: {
    voucherTypeLabel: string;
    posNumber: number;
    voucherNumber: number;
    cae: string;
    caeExpiresAt: string;
    qrPayload: string;
  };
  closureData?: {
    openedAt: string;
    closedAt: string;
    methods: {
      key: string;
      label: string;
      expected: number;
      counted: number;
      difference: number;
    }[];
  };
  promotion?: {
    name: string;
    percent: number;
    amount: number;
    total_before: number;
    total_after: number;
  } | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getPaymentMethodLabel(method: string, custom?: Record<string, string>) {
  if (method === "mixed") return "Mixto";
  if (custom?.[method]) return custom[method]!;
  if (method === "cash") return "Efectivo";
  if (method === "card") return "Tarjeta";
  if (method === "transfer") return "Transferencia";
  if (method === "mercadopago") return "Mercado Pago";
  if (method === "cuenta_corriente") return "Cuenta corriente";
  return method;
}

const PLAIN_SEP = "----------------";

/**
 * Ticket en texto plano con saltos `\n` (RawBT, TSV, etc.).
 * Incluye ventas con ítems; otros `kind` generan un resumen mínimo.
 */
export function formatSaleTicketPlainText(data: TicketData): string {
  const {
    business,
    items,
    total,
    saleId,
    movementId,
    paymentMethod,
    paymentMethodLabels,
    cashReceived,
    reason,
    notes,
    kind,
    created_at,
    promotion,
  } = data;
  const printedAt = created_at ? new Date(created_at).toLocaleString("es-AR") : new Date().toLocaleString("es-AR");
  const idLabel = kind === "sale" ? "Ticket" : "Movimiento";
  const idValue = (saleId || movementId || "").slice(0, 8);
  const lines: string[] = ["***"];

  lines.push((business?.name ?? "Mi Negocio").toUpperCase());
  if (business?.address) lines.push(business.address);
  if (business?.phone) lines.push(`Tel: ${business.phone}`);
  if (business?.cuit) lines.push(`CUIT: ${business.cuit}`);
  if (business?.ticket_header) lines.push(business.ticket_header);
  lines.push(PLAIN_SEP);
  lines.push(`${idLabel}: #${idValue}`);
  lines.push(`Fecha: ${printedAt}`);

  if (kind === "manual" || kind === "opening" || kind === "void") {
    lines.push(PLAIN_SEP);
    lines.push(`MOTIVO: ${reason || "Movimiento manual"}`);
    if (notes) lines.push(`Nota: ${notes}`);
    lines.push(PLAIN_SEP);
    lines.push(`TOTAL: $${total.toFixed(2)}`);
    lines.push("***");
    return lines.join("\n");
  }

  if (kind === "closure" && data.closureData) {
    lines.push(PLAIN_SEP);
    lines.push("CIERRE DE CAJA");
    lines.push(PLAIN_SEP);
    lines.push(`TOTAL: $${total.toFixed(2)}`);
    if (notes) lines.push(`Notas: ${notes}`);
    lines.push("***");
    return lines.join("\n");
  }

  if (items && items.length > 0) {
    lines.push(PLAIN_SEP);
    for (const it of items) {
      const subtotal = Math.round((it.quantity * it.unit_price + Number.EPSILON) * 100) / 100;
      lines.push(`${it.name} x${it.quantity}  $${subtotal.toFixed(2)}`);
    }
  }

  const promo = promotion && promotion.amount > 0 ? promotion : null;
  const baseTotal = promo ? promo.total_before : total;
  const finalTotal = promo ? promo.total_after : total;
  const change = cashReceived ? Math.max(0, cashReceived - finalTotal) : 0;

  lines.push(PLAIN_SEP);
  if (promo) {
    lines.push(`Subtotal: $${baseTotal.toFixed(2)}`);
    lines.push(`Promo ${promo.name} (${promo.percent.toFixed(1)}%): -$${promo.amount.toFixed(2)}`);
  }
  lines.push(`TOTAL: $${finalTotal.toFixed(2)}`);
  if (paymentMethod) {
    lines.push(`Pago: ${getPaymentMethodLabel(paymentMethod, paymentMethodLabels)}`);
  }
  if (cashReceived != null) {
    lines.push(`Recibido: $${cashReceived.toFixed(2)}`);
    lines.push(`Vuelto: $${change.toFixed(2)}`);
  }
  if (data.fiscal) {
    lines.push(PLAIN_SEP);
    lines.push(data.fiscal.voucherTypeLabel);
    lines.push(`PtoVta: ${data.fiscal.posNumber}  Comp: ${data.fiscal.voucherNumber}`);
    lines.push(`CAE: ${data.fiscal.cae}`);
    lines.push(`Vto CAE: ${data.fiscal.caeExpiresAt}`);
    if (data.fiscal.qrPayload) lines.push(`Verificar: ${data.fiscal.qrPayload}`);
  }
  if (business?.ticket_footer) lines.push(business.ticket_footer);
  lines.push(kind === "closure" ? "Fin de turno" : "Gracias por su compra");
  lines.push("***");

  return lines.join("\n");
}

export function generateTicketHtml(data: TicketData) {
  const {
    business,
    items,
    total,
    saleId,
    movementId,
    paymentMethod,
    paymentMethodLabels,
    cashReceived,
    reason,
    notes,
    kind,
    created_at,
    closureData,
    promotion,
    fiscal,
  } = data;
  const printedAt = created_at ? new Date(created_at).toLocaleString("es-AR") : new Date().toLocaleString("es-AR");
  
  let rows = "";
  if (items && items.length > 0) {
    rows = items
      .map((it) => {
        const subtotal = Math.round((it.quantity * it.unit_price + Number.EPSILON) * 100) / 100;
        return `<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;margin-bottom:2px;">
          <span>${escapeHtml(it.name)} x${it.quantity}</span>
          <span>$${subtotal.toFixed(2)}</span>
        </div>`;
      })
      .join("");
  }

  const promo = promotion && promotion.amount > 0 ? promotion : null;
  const baseTotal = promo ? promo.total_before : total;
  const finalTotal = promo ? promo.total_after : total;
  const change = cashReceived ? Math.max(0, cashReceived - finalTotal) : 0;
  const idLabel = kind === "sale" ? "Ticket" : "Movimiento";
  const idValue = (saleId || movementId || "").slice(0, 8);

  return `<!doctype html><html><head><meta charset="utf-8" /><title>Ticket</title>
  <style>
    @page {
      margin: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
    }
    body {
      font-family: monospace;
      /* 58–80mm ancho típico de ticket */
      width: 72mm;
      max-width: 72mm;
      padding: 8px 10px;
      color: #000;
      background: #fff;
    }
  </style>
  </head>
  <body>
    <div style="text-align:center;margin-bottom:10px;">
      <div style="font-weight:bold;font-size:16px">${escapeHtml(business?.name ?? "Mi Negocio")}</div>
      ${business?.address ? `<div style="font-size:11px">${escapeHtml(business.address)}</div>` : ""}
      ${business?.phone ? `<div style="font-size:11px">Tel: ${escapeHtml(business.phone)}</div>` : ""}
      ${business?.cuit ? `<div style="font-size:11px">CUIT: ${escapeHtml(business.cuit)}</div>` : ""}
      ${business?.ticket_header ? `<div style="margin-top:6px;font-size:11px">${escapeHtml(business.ticket_header)}</div>` : ""}
    </div>
    <div style="border-top:1px dashed #000;margin:6px 0;"></div>
    <div style="font-size:11px;display:flex;justify-content:space-between"><span>${idLabel}:</span><span>#${escapeHtml(idValue)}</span></div>
    <div style="font-size:11px;display:flex;justify-content:space-between"><span>Fecha:</span><span>${escapeHtml(printedAt)}</span></div>
    
    ${kind === "closure" && closureData ? `
      <div style="font-size:11px;display:flex;justify-content:space-between"><span>Apertura:</span><span>${escapeHtml(new Date(closureData.openedAt).toLocaleString("es-AR"))}</span></div>
      <div style="font-size:11px;display:flex;justify-content:space-between"><span>Cierre:</span><span>${escapeHtml(new Date(closureData.closedAt).toLocaleString("es-AR"))}</span></div>
    ` : ""}
    <div style="border-top:1px dashed #000;margin:6px 0;"></div>
    
    ${kind === "manual" || kind === "opening" || kind === "void" ? `
      <div style="font-size:12px;margin-bottom:10px;">
        <div style="font-weight:bold;margin-bottom:4px;">MOTIVO:</div>
        <div>${escapeHtml(reason || "Movimiento manual")}</div>
        ${notes ? `<div style="margin-top:6px;font-style:italic;">Nota: ${escapeHtml(notes)}</div>` : ""}
      </div>
    ` : ""}

    ${rows}
    
    ${kind === "closure" && closureData ? `
      <div style="font-weight:bold;font-size:12px;margin:10px 0 5px 0;text-align:center;">RESUMEN DE CAJA</div>
      <table style="width:100%;font-size:11px;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid #000;">
            <th style="text-align:left;padding:2px 0;">Medio</th>
            <th style="text-align:right;">Esp.</th>
            <th style="text-align:right;">Cont.</th>
            <th style="text-align:right;">Dif.</th>
          </tr>
        </thead>
        <tbody>
          ${closureData.methods.map(m => `
            <tr>
              <td style="padding:2px 0;">${escapeHtml(m.label)}</td>
              <td style="text-align:right;">$${m.expected.toFixed(0)}</td>
              <td style="text-align:right;">$${m.counted.toFixed(0)}</td>
              <td style="text-align:right;${Math.abs(m.difference) > 0.1 ? 'color:red;' : ''}">$${m.difference.toFixed(0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="border-top:1px dashed #000;margin:6px 0;"></div>
      <div style="font-size:11px;margin-top:5px;">
        <div style="font-weight:bold;">NOTAS:</div>
        <div>${escapeHtml(notes || "Sin observaciones")}</div>
      </div>
    ` : `
      <div style="border-top:1px dashed #000;margin:6px 0;"></div>
      ${
        promo
          ? `
        <div style="display:flex;justify-content:space-between;font-size:12px;">
          <span>Subtotal</span><span>$${baseTotal.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#16a34a;">
          <span>Promo: ${escapeHtml(promo.name)} (${promo.percent.toFixed(1)}%)</span>
          <span>−$${promo.amount.toFixed(2)}</span>
        </div>
        <div style="border-top:1px dashed #000;margin:6px 0;"></div>
      `
          : ""
      }
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;"><span>TOTAL</span><span>$${finalTotal.toFixed(2)}</span></div>
      ${paymentMethod ? `<div style="font-size:12px;display:flex;justify-content:space-between;margin-top:4px;"><span>Pago</span><span>${escapeHtml(getPaymentMethodLabel(paymentMethod, paymentMethodLabels))}</span></div>` : ""}
      ${cashReceived ? `<div style="font-size:12px;display:flex;justify-content:space-between"><span>Recibido</span><span>$${cashReceived.toFixed(2)}</span></div>` : ""}
      ${cashReceived ? `<div style="font-size:12px;display:flex;justify-content:space-between"><span>Vuelto</span><span>$${change.toFixed(2)}</span></div>` : ""}
      ${
        fiscal
          ? `
      <div style="border-top:1px dashed #000;margin:8px 0;"></div>
      <div style="text-align:center;font-size:11px;line-height:1.4;">
        <div style="font-weight:bold;">${escapeHtml(fiscal.voucherTypeLabel)}</div>
        <div>PtoVta: ${fiscal.posNumber} · Comp: ${String(fiscal.voucherNumber).padStart(8, "0")}</div>
        <div>CAE: ${escapeHtml(fiscal.cae)}</div>
        <div>Vto CAE: ${escapeHtml(fiscal.caeExpiresAt)}</div>
        ${
          fiscal.qrPayload
            ? `<div style="margin-top:6px;font-size:9px;word-break:break-all;">Verificar: ${escapeHtml(fiscal.qrPayload)}</div>`
            : ""
        }
      </div>
      `
          : ""
      }
    `}
    
    ${business?.ticket_footer ? `<div style="margin-top:15px;text-align:center;font-size:11px;">${escapeHtml(business.ticket_footer)}</div>` : ""}
    <div style="margin-top:20px;text-align:center;font-size:10px;opacity:0.7;">${kind === "closure" ? "Fin de turno" : "Gracias por su compra"}</div>
  </body></html>`;
}

export type PrintTicketOptions = {
  /**
   * Ventana abierta en el mismo instante del click (antes de cualquier `await`).
   * En Chrome móvil, si no hacés esto, el popup se bloquea y no aparece el diálogo de impresión.
   */
  preOpenedWindow?: Window | null;
};

/**
 * Escribe el HTML del ticket en una ventana y dispara el diálogo de impresión del sistema.
 * Devuelve false si no se pudo abrir ventana (popup bloqueado).
 */
export function printTicket(data: TicketData, options?: PrintTicketOptions): boolean {
  if (typeof window === "undefined") return false;
  const html = generateTicketHtml(data);
  const pre = options?.preOpenedWindow;
  let popup: Window | null = null;
  if (pre !== undefined) {
    if (pre && !pre.closed) popup = pre;
    else {
      alert("Por favor permite los popups para imprimir el ticket.");
      return false;
    }
  } else {
    popup = window.open("", "_blank", "width=420,height=720");
  }
  if (!popup || popup.closed) {
    alert("Por favor permite los popups para imprimir el ticket.");
    return false;
  }

  popup.document.write(html);
  popup.document.close();
  popup.focus();

  setTimeout(() => {
    try {
      popup.print();
      popup.close();
    } catch {
      /* noop */
    }
  }, 250);
  return true;
}
