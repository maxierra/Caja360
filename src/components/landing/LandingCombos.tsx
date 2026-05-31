import Image from "next/image";
import Link from "next/link";

import combo1 from "@/assets/combos/combo1.png";
import combo2 from "@/assets/combos/combo2.png";
import combo3 from "@/assets/combos/combo3.png";
import combo4 from "@/assets/combos/combo4.png";

function moneyAr(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function LandingCombos() {
  const combos = [
    {
      title: "Combo esencial",
      image: combo4,
      price: 250_000,
      description: "La opción más accesible para arrancar rápido en tu negocio.",
      cta: "Consultar combo esencial",
    },
    {
      title: "Combo inicial",
      image: combo1,
      price: 599_000,
      description: "Tu combo para empezar. Ideal para un mostrador completo.",
      cta: "Consultar combo inicial",
    },
    {
      title: "Combo comercio",
      image: combo2,
      price: 699_000,
      description: "Combo mini POS completo para operar con más rendimiento.",
      cta: "Consultar combo comercio",
    },
    {
      title: "Combo avanzado",
      image: combo3,
      price: 1_399_000,
      description: "PC táctil completa para operación diaria con mayor volumen.",
      cta: "Consultar combo avanzado",
    },
  ] as const;

  return (
    <section id="combos" className="relative mt-16 scroll-mt-24 md:mt-20" aria-labelledby="combos-heading">
      <div className="mb-10 text-center">
        <h2 id="combos-heading" className="font-serif text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
          Combos de hardware
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 md:text-base">
          Elegí el combo que mejor se adapte a tu negocio.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-4">
        {combos.map((combo) => (
          <article
            key={combo.title}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
          >
            <div className="relative aspect-[4/3] w-full bg-slate-50">
              <Image src={combo.image} alt={combo.title} className="object-contain p-3" fill sizes="(max-width: 1024px) 100vw, 33vw" />
            </div>
            <div className="space-y-2 border-t border-slate-100 p-5">
              <h3 className="text-lg font-semibold text-slate-900">{combo.title}</h3>
              <p className="text-sm text-slate-600">{combo.description}</p>
              <p className="text-base font-bold text-sky-700">{moneyAr(combo.price)}</p>
              <Link
                href="#contacto"
                className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl bg-sky-700 px-4 text-sm font-semibold text-white transition hover:bg-sky-800"
              >
                {combo.cta}
              </Link>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-slate-500">
        Precios expresados en pesos argentinos, referenciales. No incluyen software ni suscripción. Consultá
        formas de pago y entrega por WhatsApp o mail.
      </p>
    </section>
  );
}
