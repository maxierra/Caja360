import { CreditCard, Package, Receipt, ShoppingCart } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ITEMS: Array<{ icon: LucideIcon; title: string; desc: string }> = [
  {
    icon: ShoppingCart,
    title: "Punto de venta",
    desc: "Cobrá rápido con ticket. Efectivo, tarjeta o transferencia.",
  },
  {
    icon: Package,
    title: "Productos y stock",
    desc: "Cargá tu catálogo, precios y controlá lo que tenés en góndola.",
  },
  {
    icon: CreditCard,
    title: "Caja diaria",
    desc: "Apertura, cierre y resumen por medio de pago.",
  },
  {
    icon: Receipt,
    title: "Ventas e informes",
    desc: "Historial del día y números claros para decidir.",
  },
];

export function LandingBasics() {
  return (
    <section id="que-es" className="scroll-mt-24 py-8 md:py-12" aria-labelledby="basics-heading">
      <div className="mx-auto max-w-3xl text-center">
        <h2 id="basics-heading" className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          ¿Qué es?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 md:text-base">
          Un sistema de gestión en la nube para tu comercio. Lo usás desde el navegador, sin instalar nada raro.
        </p>
      </div>

      <ul className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2">
        {ITEMS.map(({ icon: Icon, title, desc }) => (
          <li
            key={title}
            className="flex gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
