import Link from "next/link";
import { ChevronRight, Truck } from "lucide-react";

export function LandingShippingTrackingBar() {
  return (
    <Link
      href="/pedido"
      className="group flex w-full items-center justify-center gap-3 border-b border-amber-300/80 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 px-4 py-3 text-amber-950 shadow-sm transition hover:from-amber-500 hover:via-orange-500 hover:to-amber-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800"
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/90 shadow-md ring-2 ring-amber-200/80 transition group-hover:scale-105"
        aria-hidden
      >
        <Truck className="size-5 text-orange-600" strokeWidth={2.25} />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-sm font-extrabold uppercase tracking-wide sm:text-base">
          Seguimiento de envíos
        </span>
        <span className="block text-xs font-medium text-amber-950/85 sm:text-sm">
          ¿Compraste un combo? Consultá el estado con tu email
        </span>
      </span>
      <ChevronRight
        className="size-5 shrink-0 opacity-80 transition group-hover:translate-x-0.5 group-hover:opacity-100"
        aria-hidden
      />
    </Link>
  );
}
