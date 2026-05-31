"use client";

import { Mail, MessageCircle } from "lucide-react";

const SUPPORT_PHONE_E164 = "5491123145742";
const SUPPORT_MAIL = "soporte@tienda360.site";

export function SupportFloatingButton() {
  const message = encodeURIComponent("Hola, necesito ayuda con Tienda360.");
  const whatsappHref = `https://wa.me/${SUPPORT_PHONE_E164}?text=${message}`;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      <a
        href={`mailto:${SUPPORT_MAIL}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur hover:bg-sky-50"
        aria-label="Enviar mail a soporte"
      >
        <Mail className="size-3.5" />
        {SUPPORT_MAIL}
      </a>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-14 items-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-semibold text-white shadow-[0_12px_28px_-10px_rgba(37,211,102,0.8)] transition hover:bg-[#20bd5a]"
        aria-label="Soporte por WhatsApp"
      >
        <MessageCircle className="size-5" />
        Soporte
      </a>
    </div>
  );
}
