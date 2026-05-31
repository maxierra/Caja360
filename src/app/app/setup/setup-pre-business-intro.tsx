"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Circle, Package, ShoppingCart, Sparkles, Store, Wallet } from "lucide-react";

import { ONBOARDING_GUIDE_TIMELINE } from "@/app/app/(main)/onboarding/onboarding-guide-constants";
import { landingCtaPrimary } from "@/components/landing/landing-cta-classes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  onContinue: () => void;
};

export function SetupPreBusinessIntro({ onContinue }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-pre-onb-title"
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
            <h1 id="setup-pre-onb-title" className="mt-2 font-serif text-2xl font-bold tracking-tight sm:text-3xl">
              Tu camino hasta la primera venta
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Antes de usar el punto de venta, registramos tu comercio en el sistema. Después te guiamos en las pantallas
              reales: producto → caja → venta.
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
              const current = s.id === "business";
              return (
                <React.Fragment key={s.id}>
                  {i > 0 ? <div className="hidden h-px w-5 bg-border sm:block" aria-hidden /> : null}
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium sm:text-sm",
                      current
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-900 ring-2 ring-emerald-500/30 dark:text-emerald-100"
                        : "border-border bg-muted/40 text-muted-foreground"
                    )}
                  >
                    <Circle className={cn("size-3.5 shrink-0", current ? "text-emerald-600 opacity-90" : "opacity-50")} aria-hidden />
                    <Icon className={cn("size-3.5 shrink-0", current ? "opacity-95" : "opacity-70")} aria-hidden />
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
                <p className="font-medium leading-snug">¿Qué vas a hacer?</p>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">Ahora:</span> crear tu comercio (nombre y datos base).
                  </li>
                  <li>Cargar tu primer producto en Productos.</li>
                  <li>Abrir la caja en Caja diaria.</li>
                  <li>Vender en Punto de venta y cerrar el recorrido guiado.</li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  En cada paso posterior vas a ver indicaciones y el resto de la pantalla atenuado para que no te pierdas.
                </p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            className={cn("h-12 w-full rounded-xl text-base font-semibold", landingCtaPrimary)}
            onClick={onContinue}
          >
            <span className="inline-flex items-center gap-2">
              Siguiente: crear mi comercio
              <ArrowRight className="size-4" />
            </span>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
