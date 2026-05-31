import { Mail, MapPin, MessageCircle } from "lucide-react";

const WHATSAPP_DISPLAY = "11 2314-5742";
const WHATSAPP_E164 = "5491123145742";
const EMAIL = "soporte@tienda360.site";
const ADDRESS_LINE = "Superí 2490, Belgrano, CABA";

/** Búsqueda para el embed de Google Maps (sin API key). */
const MAP_EMBED_QUERY =
  "https://maps.google.com/maps?q=" +
  encodeURIComponent("Superí 2490, Belgrano, Ciudad Autónoma de Buenos Aires") +
  "&z=16&ie=UTF8&iwloc=&output=embed";

export function LandingContact() {
  return (
    <section
      id="contacto"
      className="relative mt-16 scroll-mt-24 rounded-3xl bg-gradient-to-b from-emerald-50/40 via-transparent to-transparent pb-2 pt-4 md:mt-24 md:pb-6 md:pt-8"
      aria-labelledby="contacto-heading"
    >
      <div className="mb-8 text-center md:mb-10">
        <h2
          id="contacto-heading"
          className="font-serif text-2xl font-bold tracking-tight text-slate-900 md:text-4xl"
        >
          Contacto
        </h2>
        <p className="mt-2 text-sm text-slate-600 md:text-base">Escribinos por WhatsApp, mail o pasá por Belgrano.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-stretch">
        <div className="flex flex-col gap-4">
          <a
            href={`https://wa.me/${WHATSAPP_E164}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-4 rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/60 p-5 shadow-sm shadow-emerald-100/40 transition hover:border-emerald-200 hover:shadow-md"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700">
              <MessageCircle className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 text-left">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700/80">WhatsApp</div>
              <div className="mt-1 text-lg font-semibold text-slate-900 group-hover:text-slate-700">
                {WHATSAPP_DISPLAY}
              </div>
              <div className="mt-1 text-sm text-slate-500">Tocá para abrir el chat</div>
            </div>
          </a>

          <a
            href={`mailto:${EMAIL}`}
            className="group flex items-start gap-4 rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50/70 p-5 shadow-sm shadow-sky-100/50 transition hover:border-sky-200 hover:shadow-md"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-sky-700">
              <Mail className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 text-left">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-700/80">Email</div>
              <div className="mt-1 break-all text-base font-semibold text-slate-900 group-hover:text-slate-700 md:text-lg">
                {EMAIL}
              </div>
              <div className="mt-1 text-sm text-slate-500">Consultas y soporte</div>
            </div>
          </a>

          <div className="flex flex-1 items-start gap-4 rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/50 p-5 shadow-sm shadow-violet-100/40">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-violet-700">
              <MapPin className="size-6" aria-hidden />
            </span>
            <div className="text-left">
              <div className="text-xs font-semibold uppercase tracking-wide text-violet-700/80">Ubicación</div>
              <div className="mt-1 text-base font-medium text-slate-900 md:text-lg">{ADDRESS_LINE}</div>
              <div className="mt-1 text-sm text-slate-500">Argentina</div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-lg shadow-sky-100/40 ring-1 ring-violet-50">
          <iframe
            title="Mapa: Superí 2490, Belgrano, CABA"
            src={MAP_EMBED_QUERY}
            className="h-[min(320px,50vw)] w-full min-h-[260px] border-0 lg:h-full lg:min-h-[360px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}
