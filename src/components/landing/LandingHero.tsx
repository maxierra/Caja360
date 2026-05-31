"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BarChart3, Layers, ShieldCheck, Sparkles, Zap } from "lucide-react";

import posHero from "@/pos.png";
import { landingCtaPrimary } from "@/components/landing/landing-cta-classes";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.03 },
  },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, damping: 28, stiffness: 320 },
  },
};

const pills: Array<{ icon: LucideIcon; label: string; tone: string; iconTone: string }> = [
  {
    icon: Zap,
    label: "En la nube, desde el navegador",
    tone: "border-sky-200/90 bg-sky-50/80 text-sky-950",
    iconTone: "text-sky-600",
  },
  {
    icon: ShieldCheck,
    label: "Datos respaldados",
    tone: "border-emerald-200/90 bg-emerald-50/80 text-emerald-950",
    iconTone: "text-emerald-700",
  },
  {
    icon: BarChart3,
    label: "Ventas e informes",
    tone: "border-violet-200/90 bg-violet-50/80 text-violet-950",
    iconTone: "text-violet-700",
  },
];

export function LandingHero() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[15%] top-0 h-[min(420px,55vw)] w-[min(420px,55vw)] rounded-full bg-sky-200/35 blur-3xl md:h-[480px] md:w-[480px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[10%] top-24 h-[min(360px,50vw)] w-[min(360px,50vw)] rounded-full bg-violet-200/30 blur-3xl md:top-16"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-[70%] max-w-xl -translate-x-1/2 rounded-full bg-emerald-200/25 blur-3xl"
      />

      <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16">
        <motion.div
          variants={container}
          initial={false}
          animate="show"
          className="text-center lg:text-left"
        >
          <motion.div variants={item} initial={false} className="flex justify-center lg:justify-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-200/90 bg-sky-50/90 px-4 py-1.5 text-[0.8125rem] font-medium leading-snug text-sky-950 shadow-sm sm:text-sm">
              <Sparkles className="size-3.5 text-sky-600" />
              POS para comercios en Argentina
            </span>
          </motion.div>

          <motion.h1
            variants={item}
            initial={false}
            className="mx-auto mt-5 max-w-4xl text-balance font-serif font-bold tracking-tight text-slate-900 lg:mx-0 lg:max-w-none"
          >
            <span className="block text-[1.75rem] leading-[1.12] sm:text-4xl sm:leading-tight md:text-[2.5rem] md:leading-[1.1] lg:text-5xl lg:leading-[1.08] xl:text-6xl xl:leading-[1.05]">
              Cobrá más rápido.
            </span>
            <span className="mt-1.5 block bg-gradient-to-r from-sky-800 via-violet-700 to-teal-700 bg-clip-text text-[1.75rem] leading-[1.12] text-transparent sm:text-4xl sm:leading-tight md:text-[2.5rem] md:leading-[1.1] lg:text-5xl lg:leading-[1.08] xl:text-6xl xl:leading-[1.05]">
              Controlá tu negocio en vivo.
            </span>
          </motion.h1>

          <motion.p
            variants={item}
            initial={false}
            className="mx-auto mt-5 max-w-2xl text-[1.0625rem] leading-relaxed text-slate-600 md:text-lg md:leading-relaxed lg:mx-0 lg:mt-6"
          >
            Stock, caja, tickets e informes en un solo lugar. Registrate y probá{" "}
            <strong className="font-semibold text-sky-800">7 días gratis</strong> — sin tarjeta. Los tutoriales en
            video te muestran cada paso cuando quieras profundizar.
          </motion.p>

          <motion.div
            variants={item}
            initial={false}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 lg:justify-start"
          >
            <Link
              href="/auth/register"
              className={`${landingCtaPrimary} inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-bold`}
            >
              <span className="inline-flex items-center gap-2">
                Empezar gratis 7 días
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              </span>
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-violet-200/90 bg-white/90 px-7 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur-sm transition-colors hover:bg-violet-50/80"
            >
              Ya tengo cuenta
            </Link>
          </motion.div>

          <motion.div
            variants={item}
            initial={false}
            className="mt-10 flex flex-wrap items-center justify-center gap-2 md:gap-3 lg:justify-start"
          >
            {pills.map(({ icon: Icon, label, tone, iconTone }) => (
              <span
                key={label}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium shadow-sm md:text-sm ${tone}`}
              >
                <Icon className={`size-4 shrink-0 ${iconTone}`} />
                {label}
              </span>
            ))}
          </motion.div>

          <motion.div
            variants={item}
            initial={false}
            className="mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-center gap-x-8 gap-y-3 border-y border-sky-100 py-6 text-sm text-slate-600 lg:mx-0 lg:justify-start"
          >
            <span className="inline-flex items-center gap-2">
              <Layers className="size-4 text-sky-600/70" />
              Multi-rubro: kiosco, almacén, retail
            </span>
            <span className="hidden h-4 w-px bg-gradient-to-b from-transparent via-sky-200 to-transparent sm:block" aria-hidden />
            <span>Sin tarjeta para registrarte</span>
          </motion.div>
        </motion.div>

        <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
          <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-white p-2 shadow-xl shadow-sky-200/40 ring-1 ring-violet-100/80">
            <Image
              src={posHero}
              alt="Interfaz del punto de venta: caja, productos e informes"
              className="h-auto w-full rounded-xl"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
              placeholder="blur"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
