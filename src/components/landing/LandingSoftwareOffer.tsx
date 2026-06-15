import Link from "next/link";
import { Check } from "lucide-react";

import { landingCtaPrimary } from "@/components/landing/landing-cta-classes";
import { formatStorePrice } from "@/lib/store-products";

type Props = {
  price: number;
};

const INCLUDES = [
  "Punto de venta y caja",
  "Productos y stock",
  "Informes de ventas",
  "Licencia de por vida — un solo pago",
  "Acceso inmediato al pagar",
];

export function LandingSoftwareOffer({ price }: Props) {
  return (
    <section id="software" className="scroll-mt-24 py-8 md:py-12" aria-labelledby="software-heading">
      <div className="mx-auto max-w-lg rounded-2xl border border-teal-200/80 bg-white p-6 text-center shadow-md md:p-8">
        <h2 id="software-heading" className="text-xl font-bold text-slate-900 md:text-2xl">
          Solo el software
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Si ya tenés PC, lector e impresora. Pagás una vez y usás el sistema sin mensualidades.
        </p>
        <p className="mt-6 text-4xl font-extrabold tabular-nums text-slate-900">{formatStorePrice(price)}</p>
        <ul className="mt-6 space-y-2 text-left text-sm text-slate-700">
          {INCLUDES.map((item) => (
            <li key={item} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
        <Link
          href="/comprar/software_lifetime"
          className={`${landingCtaPrimary} mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold`}
        >
          Comprar con Mercado Pago
        </Link>
      </div>
    </section>
  );
}
