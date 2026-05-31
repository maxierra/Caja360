import {
  Boxes,
  CreditCard,
  LineChart,
  Mail,
  PackageSearch,
  ScanBarcode,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const features: Array<{
  icon: LucideIcon;
  title: string;
  desc: string;
  card: string;
  iconWrap: string;
}> = [
  {
    icon: Boxes,
    title: "Más de 280.000 productos precargados",
    desc: "Catálogo listo para arrancar: te ahorrás el trabajo pesado de cargar todo a mano y empezás antes.",
    card: "border-sky-100 bg-gradient-to-br from-white to-sky-50/70 hover:border-sky-200/90",
    iconWrap: "border-sky-100 bg-sky-50 text-sky-700",
  },
  {
    icon: Mail,
    title: "Reportes y alertas por mail",
    desc: "Envío automático de informes y avisos a tu correo para seguir el negocio sin estar pegado al sistema.",
    card: "border-violet-100 bg-gradient-to-br from-white to-violet-50/60 hover:border-violet-200/90",
    iconWrap: "border-violet-100 bg-violet-50 text-violet-700",
  },
  {
    icon: ScanBarcode,
    title: "Código de barras y búsqueda",
    desc: "Agregá productos al vuelo y vendé sin fricción en el mostrador.",
    card: "border-teal-100 bg-gradient-to-br from-white to-teal-50/60 hover:border-teal-200/90",
    iconWrap: "border-teal-100 bg-teal-50 text-teal-700",
  },
  {
    icon: PackageSearch,
    title: "Stock que se entiende",
    desc: "Precios, mínimos y estado en una grilla clara para tu equipo.",
    card: "border-amber-100 bg-gradient-to-br from-white to-amber-50/50 hover:border-amber-200/90",
    iconWrap: "border-amber-100 bg-amber-50 text-amber-800",
  },
  {
    icon: CreditCard,
    title: "Caja y medios de pago",
    desc: "Efectivo, tarjeta o transferencia con ticket listo para imprimir.",
    card: "border-emerald-100 bg-gradient-to-br from-white to-emerald-50/60 hover:border-emerald-200/90",
    iconWrap: "border-emerald-100 bg-emerald-50 text-emerald-700",
  },
  {
    icon: LineChart,
    title: "Ventas e informes",
    desc: "Seguí el día a día y tomá decisiones con números reales.",
    card: "border-sky-100 bg-gradient-to-br from-white to-sky-50/50 hover:border-sky-200/90",
    iconWrap: "border-sky-100 bg-sky-50 text-sky-700",
  },
];

export function LandingFeatures() {
  return (
    <section className="relative mt-16 md:mt-20">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          Todo lo que necesitás para{" "}
          <span className="bg-gradient-to-r from-sky-700 to-teal-700 bg-clip-text text-transparent">
            vender con tranquilidad
          </span>
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 md:text-base">
          Herramientas pensadas para comercios que quieren velocidad en la caja y orden en el back office.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, desc, card, iconWrap }) => (
          <div
            key={title}
            className={cn(
              "group rounded-2xl border p-5 shadow-sm transition-[box-shadow,border-color] duration-300 hover:shadow-md",
              card
            )}
          >
            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-xl border transition group-hover:scale-[1.02]",
                iconWrap
              )}
            >
              <Icon className="size-5" strokeWidth={2} />
            </div>
            <h3 className="mt-4 text-base font-semibold tracking-tight text-slate-900">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
