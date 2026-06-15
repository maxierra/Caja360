import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import posHero from "@/pos.png";
import { landingCtaPrimary } from "@/components/landing/landing-cta-classes";

export function LandingHero() {
  return (
    <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="text-center lg:text-left">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
          Tu punto de venta listo para vender
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">
          Software de gestión para comercios en Argentina.{" "}
          <strong className="font-semibold text-slate-800">Pago único</strong>, licencia de por vida y acceso al
          instante después de pagar.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
          <Link
            href="/comprar/software_lifetime"
            className={`${landingCtaPrimary} inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-bold`}
          >
            Comprar software
            <ArrowRight className="ml-2 size-4" aria-hidden />
          </Link>
          <a
            href="#combos"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-8 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Ver combos con hardware
          </a>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md lg:max-w-none">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <Image
            src={posHero}
            alt="Pantalla del punto de venta"
            className="h-auto w-full rounded-lg"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
            placeholder="blur"
          />
        </div>
      </div>
    </div>
  );
}
