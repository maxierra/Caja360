"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Circle, Package, ShoppingCart, Sparkles, Store, Wallet } from "lucide-react";

import { landingCtaPrimary } from "@/components/landing/landing-cta-classes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  ONBOARDING_GUIDE_QUERY,
  ONBOARDING_GUIDE_TIMELINE,
} from "@/app/app/(main)/onboarding/onboarding-guide-constants";

type Props = {
  businessName: string;
};

export function OnboardingIntroModal({ businessName }: Props) {
  const router = useRouter();

  const start = React.useCallback(() => {
    router.push(`/app/products?${ONBOARDING_GUIDE_QUERY}=product`);
  }, [router]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onb-intro-title"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(52,211,153,0.12),transparent_45%),radial-gradient(circle_at_90%_80%,rgba(56,189,248,0.1),transparent_40%)]"
        />

        <div className="relative space-y-6 p-6 sm:p-8">
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Configuración inicial
            </p>
            <h1 id="onb-intro-title" className="mt-2 font-serif text-2xl font-bold tracking-tight sm:text-3xl">
              Tu camino hasta la primera venta
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Estás en <span className="font-medium text-foreground">{businessName}</span>: el comercio ya está dado de alta en el
              sistema. Te guiamos en las mismas pantallas del día a día: producto → caja → venta.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {ONBOARDING_GUIDE_TIMELINE.map((s, i) => {
              const Icon =
                s.id === "business"
                  ? Store
                  : s.id === "product"
                    ? Package
                    : s.id === "cash"
                      ? Wallet
                      : ShoppingCart;
              const done = s.id === "business";
              return (
                <React.Fragment key={s.id}>
                  {i > 0 ? <div className="hidden h-px w-5 bg-border sm:block" aria-hidden /> : null}
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium sm:text-sm",
                      done
                        ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                        : "border-border bg-muted/40 text-muted-foreground"
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
                    ) : (
                      <Circle className="size-3.5 shrink-0 opacity-50" aria-hidden />
                    )}
                    <Icon className={cn("size-3.5 shrink-0", done ? "opacity-90" : "opacity-70")} aria-hidden />
                    {s.label}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-b from-sky-500/5 to-transparent p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600">
                <Sparkles className="size-5" />
              </div>
              <div className="min-w-0 space-y-2">
                <p className="font-medium leading-snug">¿Qué sigue?</p>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">Comercio:</span> ya configurado en el sistema.
                  </li>
                  <li>Crear tu primer producto en Productos.</li>
                  <li>Abrir la caja en Caja diaria.</li>
                  <li>Vender en Punto de venta y cerrar el recorrido.</li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  En cada paso vas a ver indicaciones y el resto de la pantalla atenuado para que no te pierdas.
                </p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            className={cn("h-12 w-full rounded-xl text-base font-semibold", landingCtaPrimary)}
            onClick={start}
          >
            <span className="inline-flex items-center gap-2">
              Ir al primer paso: productos
              <ArrowRight className="size-4" />
            </span>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
