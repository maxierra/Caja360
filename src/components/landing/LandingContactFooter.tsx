import { Mail, MessageCircle } from "lucide-react";

const WHATSAPP_E164 = "5491123145742";
const WHATSAPP_DISPLAY = "11 2314-5742";
const EMAIL = "soporte@tienda360.site";

export function LandingContactFooter() {
  return (
    <footer
      id="contacto"
      className="scroll-mt-24 border-t border-slate-200/80 py-10 text-center"
      aria-labelledby="contacto-heading"
    >
      <h2 id="contacto-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        ¿Dudas antes de comprar?
      </h2>
      <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
        <a
          href={`https://wa.me/${WHATSAPP_E164}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800 hover:underline"
        >
          <MessageCircle className="size-4" aria-hidden />
          WhatsApp {WHATSAPP_DISPLAY}
        </a>
        <a
          href={`mailto:${EMAIL}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-sky-800 hover:underline"
        >
          <Mail className="size-4" aria-hidden />
          {EMAIL}
        </a>
      </div>
      <p className="mt-6 text-xs text-slate-500">POS SaaS · Argentina</p>
    </footer>
  );
}
