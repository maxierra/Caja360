"use client";

import Link from "next/link";
import { X } from "lucide-react";

import { landingCtaPrimary } from "@/components/landing/landing-cta-classes";
import { formatStorePrice } from "@/lib/store-products";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  lifetimePrice: number;
};

const STEPS = [
  { n: 1, title: "Registrate gratis", text: "Creá tu cuenta con email y contraseña." },
  { n: 2, title: "Confirmá tu email", text: "Revisá tu bandeja y activá la cuenta." },
  { n: 3, title: "Configurá tu negocio", text: "Nombre, rubro y datos básicos del comercio." },
  { n: 4, title: "Usá el POS", text: "Cargá productos, vendé y controlá caja durante 7 días." },
] as const;

export function TrialExplainerModal({ open, onClose, lifetimePrice }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-explainer-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(94vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id="trial-explainer-title" className="text-lg font-semibold text-slate-900">
            Probá TIENDA360 gratis
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <p className="text-sm leading-relaxed text-slate-600">
            <strong className="text-slate-900">7 días de prueba gratis</strong> con acceso completo al punto de venta.
            Sin tarjeta para empezar.
          </p>

          <ol className="mt-5 space-y-3">
            {STEPS.map((step) => (
              <li key={step.n} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sky-700 text-xs font-bold text-white">
                  {step.n}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-5 rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm leading-relaxed text-slate-700">
            Al terminar la prueba, podés seguir usando el sistema con una{" "}
            <strong className="text-sky-900">licencia de por vida</strong> por un pago único de{" "}
            <strong className="text-sky-900">{formatStorePrice(lifetimePrice)}</strong>.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 p-4 sm:flex-row">
          <Link
            href="/auth/register"
            className={cn(landingCtaPrimary, "inline-flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-bold")}
          >
            Crear cuenta gratis
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Ya tengo cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}
