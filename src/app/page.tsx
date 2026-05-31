import Link from "next/link";

import { LandingAbout } from "@/components/landing/LandingAbout";
import { LandingContact } from "@/components/landing/LandingContact";
import { LandingCombos } from "@/components/landing/LandingCombos";
import { LandingDesktopDownload } from "@/components/landing/LandingDesktopDownload";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingVideoTutorials } from "@/components/landing/LandingVideoTutorials";
import { landingCtaPrimary } from "@/components/landing/landing-cta-classes";
import { getAllPlansConfig } from "@/app/app/subscription/actions";

type Props = {
  searchParams?: Promise<{ missingSupabase?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const plans = await getAllPlansConfig();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-gradient-to-b from-sky-50/90 via-zinc-50 to-emerald-50/70 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-sky-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4">
          <div className="flex flex-col gap-0 md:flex-row md:items-center md:justify-between md:gap-4 md:py-3">
            <div className="flex items-center justify-between gap-3 py-2.5 md:py-0">
              <div className="flex min-w-0 items-center gap-2">
                <div className="size-2 shrink-0 rounded-full bg-sky-600 shadow-[0_0_12px_rgba(2,132,199,0.35)]" />
                <span className="truncate text-sm font-semibold tracking-tight text-slate-900">
                  POS SaaS
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2 md:hidden">
                <Link
                  href="/auth/register"
                  className={`${landingCtaPrimary} inline-flex h-8 items-center justify-center rounded-lg px-3 text-[0.75rem] font-bold`}
                >
                  <span>Probar gratis</span>
                </Link>
                <Link
                  href="/auth/login"
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-sky-200/90 bg-white px-3 text-[0.75rem] font-semibold text-slate-800 transition-colors hover:bg-sky-50/80"
                >
                  Ingresar
                </Link>
              </div>
            </div>

            <nav
              className="-mx-3 flex gap-x-4 gap-y-1 overflow-x-auto border-t border-sky-100/90 px-3 py-2.5 text-[13px] [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-x-5 md:mx-0 md:flex-1 md:flex-wrap md:justify-center md:overflow-visible md:border-t-0 md:px-0 md:py-0 lg:justify-end [&::-webkit-scrollbar]:hidden"
              aria-label="Secciones"
            >
              <a href="#features" className="shrink-0 font-medium text-slate-600 transition hover:text-sky-800">
                Funciones
              </a>
              <a href="#nosotros" className="shrink-0 font-medium text-slate-600 transition hover:text-sky-800">
                Nosotros
              </a>
              <a href="#tutoriales" className="shrink-0 font-medium text-slate-600 transition hover:text-sky-800">
                Tutoriales
              </a>
              <a href="#combos" className="shrink-0 font-medium text-slate-600 transition hover:text-sky-800">
                Combos
              </a>
              <a href="#contacto" className="shrink-0 font-medium text-slate-600 transition hover:text-sky-800">
                Contacto
              </a>
              <a href="#descarga" className="shrink-0 font-medium text-slate-600 transition hover:text-sky-800">
                Descarga
              </a>
              <a href="#planes" className="shrink-0 font-medium text-slate-600 transition hover:text-sky-800">
                Planes
              </a>
            </nav>

            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/auth/register"
                className={`${landingCtaPrimary} inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-bold`}
              >
                <span>Probar 7 días gratis</span>
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-sky-200/90 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-sky-50/80"
              >
                Ingresar
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-6 sm:px-4 sm:py-10">
        {sp.missingSupabase ? (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            Falta configurar Supabase. Podés ver la landing, pero <span className="font-medium">/app</span> y
            autenticación no funcionarán hasta completar <code className="rounded bg-white px-1">.env.local</code>.
          </div>
        ) : null}

        <section className="mb-10 md:mb-14">
          <LandingHero />
        </section>

        <section id="features">
          <LandingFeatures />
        </section>

        <LandingAbout />

        <LandingVideoTutorials />

        <LandingCombos />

        <LandingContact />

        <LandingDesktopDownload />

        <LandingPricing plans={plans} />

        <section className="mt-12 rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-sky-50/60 to-violet-50/50 p-6 text-center shadow-sm shadow-sky-100/80 md:p-8">
          <p className="text-sm text-slate-600 md:text-base">
            ¿Querés ver el sistema con tu propio negocio? Creá tu cuenta en segundos:{" "}
            <strong className="font-semibold text-sky-900">7 días gratis</strong>, sin tarjeta.
          </p>
          <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
            <Link
              href="/auth/register"
              className={`${landingCtaPrimary} inline-flex h-10 items-center justify-center rounded-xl px-6 text-sm font-bold`}
            >
              <span>Crear cuenta gratis</span>
            </Link>
            <Link
              href="/auth/login"
              className="text-sm font-medium text-sky-800/90 underline-offset-4 transition hover:text-sky-950 hover:underline"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
