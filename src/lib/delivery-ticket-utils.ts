import type { PosBusinessInfo } from "@/lib/ticket-utils";

const PLAIN_SEP = "----------------";

export type DeliveryTicketItem = {
  name: string;
  quantity: number;
  unit_price: number;
};

export type DeliveryTicketOrder = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  notes: string | null;
  service_order_items: DeliveryTicketItem[] | null;
  created_at?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatOrderTime(order: DeliveryTicketOrder): string {
  const raw = order.created_at;
  if (raw) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
    }
  }
  return new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function businessHeaderLines(business: PosBusinessInfo): string[] {
  const lines: string[] = [(business?.name ?? "Mi Negocio").toUpperCase()];
  if (business?.address) lines.push(business.address);
  if (business?.phone) lines.push(`Tel: ${business.phone}`);
  return lines;
}

export function formatKitchenTicketPlainText(params: {
  business: PosBusinessInfo;
  order: DeliveryTicketOrder;
}): string {
  const { business, order } = params;
  const items = order.service_order_items ?? [];
  const lines: string[] = ["***", ...businessHeaderLines(business), PLAIN_SEP, "TICKET COCINA", "DELIVERY"];

  lines.push(`Pedido: #${order.id.slice(0, 8)}`);
  lines.push(`Hora: ${formatOrderTime(order)}`);
  if (order.customer_name?.trim()) {
    lines.push(`Cliente: ${order.customer_name.trim()}`);
  }
  lines.push(PLAIN_SEP);

  if (items.length === 0) {
    lines.push("(Sin ítems)");
  } else {
    for (const item of items) {
      lines.push(`${item.quantity} x ${item.name}`);
    }
  }

  if (order.notes?.trim()) {
    lines.push(PLAIN_SEP);
    lines.push("NOTAS:");
    lines.push(order.notes.trim());
  }

  lines.push(PLAIN_SEP);
  lines.push("***");
  return lines.join("\n");
}

export function formatDeliveryTicketPlainText(params: {
  business: PosBusinessInfo;
  order: DeliveryTicketOrder;
  paymentStatus?: string;
}): string {
  const { business, order, paymentStatus = "Pendiente de cobro" } = params;
  const items = order.service_order_items ?? [];
  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const lines: string[] = ["***", ...businessHeaderLines(business), PLAIN_SEP, "TICKET ENVÍO", "DELIVERY"];

  lines.push(`Pedido: #${order.id.slice(0, 8)}`);
  lines.push(`Hora: ${formatOrderTime(order)}`);
  lines.push(PLAIN_SEP);
  lines.push(`Cliente: ${order.customer_name?.trim() || "Sin nombre"}`);
  lines.push(`Tel: ${order.customer_phone?.trim() || "—"}`);
  lines.push(`Dir: ${order.delivery_address?.trim() || "—"}`);
  lines.push(PLAIN_SEP);

  if (items.length === 0) {
    lines.push("(Sin ítems)");
  } else {
    for (const item of items) {
      const subtotal = Math.round((item.quantity * item.unit_price + Number.EPSILON) * 100) / 100;
      lines.push(`${item.name} x${item.quantity}  ${formatMoney(subtotal)}`);
    }
  }

  lines.push(PLAIN_SEP);
  lines.push(`TOTAL: ${formatMoney(total)}`);
  lines.push(`Pago: ${paymentStatus}`);

  if (order.notes?.trim()) {
    lines.push(PLAIN_SEP);
    lines.push("NOTAS:");
    lines.push(order.notes.trim());
  }

  lines.push(PLAIN_SEP);
  lines.push("***");
  return lines.join("\n");
}

function generatePlainTextTicketHtml(plainText: string): string {
  const body = escapeHtml(plainText).replaceAll("\n", "<br/>");
  return `<!doctype html><html><head><meta charset="utf-8" /><title>Ticket</title>
  <style>
    @page { margin: 0; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: monospace;
      width: 72mm;
      max-width: 72mm;
      padding: 8px 10px;
      color: #000;
      background: #fff;
      font-size: 12px;
      line-height: 1.35;
    }
  </style>
  </head><body>${body}</body></html>`;
}

export function printPlainTextTicketInBrowser(plainText: string): boolean {
  if (typeof window === "undefined") return false;
  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup || popup.closed) {
    alert("Por favor permite los popups para imprimir el ticket.");
    return false;
  }
  popup.document.write(generatePlainTextTicketHtml(plainText));
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
