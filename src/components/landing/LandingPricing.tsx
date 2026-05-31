"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { landingCtaPrimary } from "@/components/landing/landing-cta-classes";
import { cn } from "@/lib/utils";

type PlanConfig = {
  amount: number;
  currency: string;
  title: string;
  days: number;
};

type Props = {
  plans: {
    monthly: PlanConfig;
    semester: PlanConfig;
    annual: PlanConfig;
  };
};

const FEATURES = [
  "Punto de venta y caja",
  "Productos y stock ilimitados",
  "Informes de ventas y caja",
  "Actualizaciones constantes",
  "Soporte prioritario",
];

type PlanKey = "monthly" | "semester" | "annual";

type Theme = {
  border: string;
  bullet: string;
  cardBg: string;
  ringOffset: string;
  ring?: string;
};

const THEMES: Record<PlanKey, Theme> = {
  monthly: {
    border: "border-sky-100",
    bullet: "text-sky-600",
    cardBg: "bg-gradient-to-b from-white to-sky-50/80",
    ringOffset: "ring-offset-sky-50/90",
  },
  semester: {
    border: "border-violet-100",
    bullet: "text-violet-600",
    cardBg: "bg-gradient-to-b from-white to-violet-50/70",
    ringOffset: "ring-offset-violet-50/90",
  },
  annual: {
    border: "border-teal-100",
    bullet: "text-teal-600",
    cardBg: "bg-gradient-to-b from-white to-teal-50/75",
    ringOffset: "ring-offset-teal-50/90",
    ring: "ring-2 ring-teal-600/35 ring-offset-2",
  },
};

function formatMoney(n: number) {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

export function LandingPricing({ plans }: Props) {
  const currency = plans.monthly.currency;

  const rows: Array<{
    key: PlanKey;
    serifTitle: string;
    months: number;
    plan: PlanConfig;
    blurb: string;
    cycleLabel: string;
    featured: boolean;
  }> = [
    {
      key: "monthly",
      serifTitle: "Plan mensual",
      months: 1,
      plan: plans.monthly,
      blurb: "Máxima flexibilidad, renovás mes a mes.",
      cycleLabel: "Facturación mensual",
      featured: false,
    },
    {
      key: "semester",
      serifTitle: "6 meses",
      months: 6,
      plan: plans.semester,
      blurb: "Un solo pago por medio año.",
      cycleLabel: "Pagás el equivalente a 5 meses al valor mensual",
      featured: false,
    },
    {
      key: "annual",
      serifTitle: "12 meses",
      months: 12,
      plan: plans.annual,
      blurb: "El mejor valor para usar el sistema todo el año.",
      cycleLabel: "Pagás el equivalente a 10 meses al valor mensual",
      featured: true,
    },
  ];

  return (
    <section
      id="planes"
      className="scroll-mt-24 rounded-3xl bg-gradient-to-b from-sky-50/60 via-white to-violet-50/40 py-12 text-slate-900 md:py-20"
    >
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-10 text-center md:mb-14">
          <h2 className="font-serif text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Planes en la nube
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-slate-600 md:text-base">
            Montos en {currency}. Referencia: <strong className="font-semibold text-slate-900">$ {formatMoney(plans.monthly.amount)}</strong>{" "}
            mensual · <strong className="font-semibold text-slate-900">$ {formatMoney(plans.semester.amount)}</strong> por 6 meses ·{" "}
            <strong className="font-semibold text-slate-900">$ {formatMoney(plans.annual.amount)}</strong> por 12 meses. Registrate y probá{" "}
            <strong className="font-semibold text-sky-800">7 días gratis</strong>; el cobro aplica cuando activás un plan desde tu cuenta.
          </p>
        </header>

        <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-3 lg:gap-5">
          {rows.map(({ key, serifTitle, months, plan, blurb, cycleLabel, featured }) => {
            const theme = THEMES[key];
            const monthlyUnit = plans.monthly.amount;
            const fullPrice = monthlyUnit * months;
            const discount =
              months > 1 && fullPrice > plan.amount
                ? Math.round(((fullPrice - plan.amount) / fullPrice) * 100)
                : 0;
            const perMonth = plan.amount / months;
            const paidMonthsEquiv = months > 1 ? Math.round(plan.amount / monthlyUnit) : null;

            return (
              <article
                key={key}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-2xl border border-solid p-6 shadow-md shadow-slate-200/60 md:p-8",
                  theme.border,
                  theme.cardBg,
                  featured && theme.ring,
                  featured && theme.ringOffset
                )}
              >
                {featured ? (
                  <div className="absolute right-3 top-3 rounded-full bg-teal-700 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-md shadow-teal-200/60">
                    Mejor valor
                  </div>
                ) : null}

                <div className="text-center">
                  <h3 className="font-serif text-xl font-bold text-slate-900 md:text-2xl">{serifTitle}</h3>

                  <div className="mt-6 flex flex-wrap items-baseline justify-center gap-2">
                    <span className="text-4xl font-extrabold tracking-tight text-slate-900 tabular-nums md:text-[2.75rem]">
                      $ {formatMoney(plan.amount)}
                    </span>
                    <span className="rounded-full border border-white/80 bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700 backdrop-blur-sm">
                      {plan.currency}
                      {months > 1 ? ` · ${months} meses` : " · mes"}
                    </span>
                  </div>

                  <p className="mt-3 text-xs font-medium text-slate-600 md:text-sm">{cycleLabel}</p>
                  {paidMonthsEquiv != null && months > 1 ? (
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      Pagás {paidMonthsEquiv} {paidMonthsEquiv === 1 ? "mes" : "meses"} × valor mensual (${formatMoney(monthlyUnit)})
                    </p>
                  ) : null}

                  <p className="mx-auto mt-4 max-w-[280px] text-pretty text-sm leading-relaxed text-slate-600">{blurb}</p>

                  {months > 1 ? (
                    <div className="mt-4 space-y-1 text-sm text-slate-700">
                      <p>
                        <span className="text-slate-400 line-through">
                          $ {formatMoney(fullPrice)} ({months} × ${formatMoney(monthlyUnit)})
                        </span>
                        {discount > 0 ? (
                          <span className="ml-2 font-semibold text-slate-900">Ahorrás ~{discount}%</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-500">
                        Equivale a ~$ {formatMoney(perMonth)} / mes en este período
                      </p>
                    </div>
                  ) : null}
                </div>

                <hr className="my-8 border-white/60" />

                <ul className="flex-1 space-y-3 text-left text-sm text-slate-700">
                  {FEATURES.map((f) => (
                    <li key={f} className="flex gap-3">
                      <Check className={cn("mt-0.5 size-4 shrink-0 stroke-[2.5]", theme.bullet)} aria-hidden />
                      <span className="leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-6 text-center text-xs text-slate-500">
                  Suscripción: {plan.days} días de acceso por período pagado.
                </p>

                <Link
                  href="/auth/register"
                  className={cn(
                    landingCtaPrimary,
                    "mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-bold"
                  )}
                >
                  <span>Empezar prueba gratis</span>
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
