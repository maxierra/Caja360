"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  Clock,
  Copy,
  Loader2,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  startMercadoPagoCheckout,
  type PlanKey,
} from "@/app/app/subscription/actions";
import { Button } from "@/components/ui/button";
import { TrialCountdown } from "@/components/trial-countdown";
import { parseDbTimestamptzToDate } from "@/lib/parse-db-timestamp";
import { businessHasAppAccess, type SubscriptionRow } from "@/lib/subscription";
import { cn } from "@/lib/utils";

export type ManualContactProps = {
  mpAlias: string;
  phoneDisplay: string;
  /** Solo dígitos, ej. 5491123145742 para wa.me */
  whatsappDigits: string;
  /** CBU/CVU u otro dato bancario (opcional) */
  cbu: string;
  transferHolder: string;
  transferNote: string;
};

type PlanConfig = {
  amount: number;
  currency: string;
  title: string;
  days: number;
  planKey: PlanKey;
};

type Props = {
  businessId: string;
  subscription: SubscriptionRow | null;
  plans: { monthly: PlanConfig; semester: PlanConfig; annual: PlanConfig };
  loadError?: string | null;
  mercadoPagoConfigured: boolean;
  manualContact: ManualContactProps;
};

const PLAN_FEATURES = ["Punto de venta y caja", "Productos y stock", "Ventas e informes", "Actualizaciones incluidas"];

export function SubscriptionClient({
  businessId,
  subscription,
  plans,
  loadError,
  mercadoPagoConfigured,
  manualContact,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingPlanKey, setLoadingPlanKey] = React.useState<PlanKey | null>(null);

  const { mpAlias, phoneDisplay, whatsappDigits, cbu, transferHolder, transferNote } = manualContact;
  const hasManualDetails = Boolean(
    mpAlias || phoneDisplay || whatsappDigits || cbu || transferHolder || transferNote
  );
  const hasAccess = businessHasAppAccess(subscription);
  /** Sin checkout MP o cuenta bloqueada: mostramos ID del negocio y datos de contacto manual */
  const showAssistedBlock = !mercadoPagoConfigured || !hasAccess;

  const whatsappHref = React.useMemo(() => {
    if (!whatsappDigits) return null;
    const text = encodeURIComponent(
      `Hola, quiero activar mi suscripción.\n\nID de mi negocio: ${businessId}\n\nAdjunto comprobante de transferencia (si aplica).`
    );
    return `https://wa.me/${whatsappDigits}?text=${text}`;
  }, [businessId, whatsappDigits]);

  const telHref = React.useMemo(() => {
    if (whatsappDigits) return `tel:+${whatsappDigits}`;
    const d = phoneDisplay.replace(/\D/g, "");
    if (!d) return null;
    if (d.startsWith("54")) return `tel:+${d}`;
    if (d.startsWith("9") && d.length >= 10) return `tel:+${d}`;
    return `tel:+54${d}`;
  }, [phoneDisplay, whatsappDigits]);

  const copyBusinessId = React.useCallback(() => {
    void navigator.clipboard.writeText(businessId);
    toast.success("ID de negocio copiado", {
      description: "Pegalo en WhatsApp o mensaje para el administrador.",
    });
  }, [businessId]);

  const copyMpAlias = React.useCallback(() => {
    if (!mpAlias) return;
    void navigator.clipboard.writeText(mpAlias);
    toast.success("Alias copiado");
  }, [mpAlias]);

  React.useEffect(() => {
    const mp = searchParams?.get("mp");
    if (mp === "success") {
      toast.success("Pago recibido", {
        description: "Si no se actualiza solo, esperá unos segundos o actualizá la página.",
      });
      router.replace("/app/subscription");
    } else if (mp === "pending") {
      toast.message("Pago pendiente", { description: "Te avisaremos cuando se acredite." });
      router.replace("/app/subscription");
    } else if (mp === "failure") {
      toast.error("No se completó el pago");
      router.replace("/app/subscription");
    }
  }, [router, searchParams]);

  const isTrial = subscription?.status === "trialing";
  const isActive = subscription?.status === "active";
  const trialEnds = parseDbTimestamptzToDate(subscription?.current_period_end ?? null);
  const periodEnds =
    isActive && subscription?.current_period_end
      ? parseDbTimestamptzToDate(subscription.current_period_end)
      : null;

  const onPayPlan = async (key: PlanKey) => {
    setLoadingPlanKey(key);
    try {
      const res = await startMercadoPagoCheckout(key);
      if ("error" in res) {
        toast.error("No se pudo iniciar el pago", { description: res.error });
        return;
      }
      window.location.href = res.checkoutUrl;
    } finally {
      setLoadingPlanKey(null);
    }
  };

  const planItems = [
    {
      key: "monthly" as PlanKey,
      title: "Plan mensual",
      months: 1,
      plan: plans.monthly,
      tagline: "Cada mes",
      description: "Probá el sistema con flexibilidad total.",
      featured: false,
        theme: {
        card: "border-teal-200/80 bg-gradient-to-b from-teal-50/90 to-white dark:from-teal-950/40 dark:to-zinc-900/90 dark:border-teal-800/60",
        badge: "bg-teal-600 text-white dark:bg-teal-500",
        title: "text-teal-900 dark:text-teal-100",
        dollar: "text-teal-600 dark:text-teal-400",
        price: "text-teal-950 dark:text-teal-50",
        arsBadge: "bg-teal-100 text-teal-800 dark:bg-teal-900/70 dark:text-teal-100",
        muted: "text-teal-700/80 dark:text-teal-300/80",
        button: "bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400",
        featuresBorder: "border-teal-100 dark:border-teal-900/50",
        featureText: "text-teal-800/85 dark:text-teal-200/75",
      },
    },
    {
      key: "semester" as PlanKey,
      title: "Plan semestral",
      months: 6,
      plan: plans.semester,
      tagline: "Pago único por 6 meses",
      description: "Ideal para estabilizar costos con mejor precio total.",
      featured: true,
      theme: {
        card: "border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-white dark:from-emerald-950/35 dark:to-zinc-900/90 dark:border-emerald-800/60",
        badge: "bg-emerald-600 text-white dark:bg-emerald-500",
        title: "text-emerald-900 dark:text-emerald-100",
        dollar: "text-emerald-600 dark:text-emerald-400",
        price: "text-emerald-950 dark:text-emerald-50",
        arsBadge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-100",
        muted: "text-emerald-700/80 dark:text-emerald-300/80",
        button: "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400",
        featuresBorder: "border-emerald-100 dark:border-emerald-900/50",
        featureText: "text-emerald-800/85 dark:text-emerald-200/75",
      },
    },
    {
      key: "annual" as PlanKey,
      title: "Plan anual",
      months: 12,
      plan: plans.annual,
      tagline: "Pago único por 12 meses",
      description: "La opción con mayor ahorro para todo el año.",
      featured: false,
      theme: {
        card: "border-violet-200/80 bg-gradient-to-b from-violet-50/90 to-white dark:from-violet-950/35 dark:to-zinc-900/90 dark:border-violet-800/60",
        badge: "bg-violet-600 text-white dark:bg-violet-500",
        title: "text-violet-900 dark:text-violet-100",
        dollar: "text-violet-600 dark:text-violet-400",
        price: "text-violet-950 dark:text-violet-50",
        arsBadge: "bg-violet-100 text-violet-800 dark:bg-violet-900/70 dark:text-violet-100",
        muted: "text-violet-700/80 dark:text-violet-300/80",
        button: "bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400",
        featuresBorder: "border-violet-100 dark:border-violet-900/50",
        featureText: "text-violet-800/85 dark:text-violet-200/75",
      },
    },
  ] as const;

  return (
    <div className="flex flex-col gap-8">
      {/* Estado / trial */}
      <section
        className={cn(
          "rounded-3xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-6 shadow-sm",
          "bg-gradient-to-br from-[var(--pos-surface)] via-[color-mix(in_oklab,var(--pos-accent)_4%,var(--pos-surface))] to-[color-mix(in_oklab,var(--sub-sky)_8%,var(--pos-surface))]"
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--pos-accent)_18%,transparent)] text-[var(--pos-accent)] shadow-[0_0_24px_var(--pos-glow)]">
            <Clock className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Estado de tu cuenta</h2>
            <p className="text-xs text-muted-foreground">Prueba gratuita y acceso al sistema</p>
          </div>
          {subscription && hasAccess && isTrial ? (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Sparkles className="size-3.5" />
              Prueba activa
            </span>
          ) : null}
          {subscription && isActive && hasAccess ? (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-sky-500/35 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-800 dark:text-sky-200">
              <ShieldCheck className="size-3.5" />
              Plan activo
            </span>
          ) : null}
        </div>

        <div className="mt-6 space-y-5 text-sm">
          {loadError ? (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.12] px-4 py-3 text-xs text-amber-900 dark:text-amber-100">
              <strong className="font-semibold">No se pudo cargar la suscripción.</strong> {loadError}
            </div>
          ) : null}

          {!subscription ? (
            <p className="leading-relaxed text-muted-foreground">
              Este negocio no tiene registro de plan en la base (creado antes de activar esta función). Tenés acceso
              completo; al pagar se creará tu suscripción y el período activo.
            </p>
          ) : hasAccess ? (
            <>
              {isTrial && trialEnds ? (
                <div className="space-y-5">
                  <p className="leading-relaxed text-foreground">
                    Disfrutá la <strong className="text-[var(--pos-accent)]">prueba gratis</strong> hasta{" "}
                    <strong>
                      {trialEnds.toLocaleString("es-AR", {
                        timeZone: "America/Argentina/Buenos_Aires",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </strong>{" "}
                    <span className="text-muted-foreground">(hora Argentina).</span>
                  </p>
                  <div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                      Tiempo restante
                    </p>
                    <TrialCountdown endsAt={subscription.current_period_end!} variant="large" />
                  </div>
                </div>
              ) : null}
              {isTrial && !trialEnds ? (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-amber-900 dark:text-amber-100">
                  Estado de prueba sin fecha de fin en la base. Completá{" "}
                  <code className="rounded bg-muted px-1 text-foreground">current_period_end</code> en Supabase.
                </p>
              ) : null}
              {isActive && periodEnds ? (
                <p className="leading-relaxed">
                  Tu plan está <strong className="text-sky-600 dark:text-sky-300">activo</strong> hasta{" "}
                  <strong>
                    {periodEnds.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
                  </strong>
                  .
                </p>
              ) : null}
              {isActive && !periodEnds ? (
                <p className="text-muted-foreground">Plan activo. Gracias por confiar en nosotros.</p>
              ) : null}
            </>
          ) : (
            <div className="space-y-4">
              {isTrial && subscription?.current_period_end ? (
                <TrialCountdown endsAt={subscription.current_period_end} variant="large" />
              ) : null}
              <div className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-4">
                <p className="font-medium text-destructive">Acceso suspendido</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  La prueba terminó o el plan no está activo. Pagá abajo para volver al punto de venta, productos e
                  informes.
                </p>
              </div>
              <div className="flex gap-3 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.08] to-teal-500/[0.04] px-4 py-4 dark:from-emerald-400/10 dark:to-teal-500/5">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <BadgeCheck className="size-5" />
                </span>
                <div className="min-w-0 space-y-1.5 text-sm leading-relaxed text-foreground/90">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-200">Reactivación automática</p>
                  <p className="text-muted-foreground">
                    Cuando el pago con Mercado Pago se acredita, <strong className="text-foreground">tu acceso se
                    activa solo</strong>: podés seguir usando el punto de venta, productos, ventas y todo como antes.
                    Suele tardar unos segundos; si no ves el cambio al volver,{" "}
                    <strong className="text-foreground">actualizá la página</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Planes estilo pricing cards (referencia) */}
      <section className="space-y-4">
        <div className="text-center sm:text-left">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Elegí tu plan</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Elegí mensual, semestral o anual. El pago se procesa de forma segura con Mercado Pago.
          </p>
        </div>

        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {planItems.map(({ key, title, months, plan, tagline, description, featured, theme }) => {
            const isLoading = loadingPlanKey === key;
            const payAmount = plan.amount;
            const fullPrice = plans.monthly.amount * months;
            const bundleDiscountPct =
              months > 1 && fullPrice > plan.amount ? Math.round(((fullPrice - plan.amount) / fullPrice) * 100) : 0;
            const perMonth = payAmount / months;
            const priceMain =
              months === 1
                ? payAmount.toLocaleString("es-AR", { maximumFractionDigits: 0 })
                : perMonth.toLocaleString("es-AR", { maximumFractionDigits: 0 });

            return (
              <div
                key={key}
                className={cn(
                  "relative flex flex-col rounded-2xl border px-4 pb-4 pt-6 text-center shadow-sm transition-shadow",
                  theme.card,
                  featured && "ring-2 ring-amber-400/40 dark:ring-amber-500/25"
                )}
              >
                {featured ? (
                  <div
                    className={cn(
                      "absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                      theme.badge
                    )}
                  >
                    Más elegido
                  </div>
                ) : null}

                <h4 className={cn("text-sm font-bold", theme.title)}>{title}</h4>

                {/* Precio: $ + monto + ARS en una sola lectura */}
                <div className="mt-3 flex flex-col items-center gap-1">
                  <div
                    className="flex flex-wrap items-baseline justify-center gap-x-1"
                    aria-label={`${priceMain} pesos argentinos`}
                  >
                    <span className={cn("text-2xl font-bold tabular-nums leading-none", theme.dollar)}>$</span>
                    <span className={cn("text-4xl font-black tabular-nums tracking-tight", theme.price)}>{priceMain}</span>
                    <span
                      className={cn(
                        "ml-0.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none tracking-wider",
                        theme.arsBadge
                      )}
                      title="Pesos argentinos"
                    >
                      {plan.currency}
                    </span>
                  </div>
                  <p className="text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-400">
                    Pesos argentinos
                  </p>
                  <p className={cn("text-[11px] leading-snug", theme.muted)}>
                    {months === 1 ? tagline : "Equivalente por mes (promedio)"}
                  </p>
                </div>
                {months > 1 ? (
                  <p className={cn("mt-1 text-[10px] font-semibold", theme.muted)}>
                    Total del plan:{" "}
                    <span className="tabular-nums">
                      ${payAmount.toLocaleString("es-AR")} {plan.currency}
                    </span>
                  </p>
                ) : null}

                <p className={cn("mt-3 min-h-[2.25rem] text-xs leading-snug", theme.muted)}>{description}</p>

                <p className={cn("mt-1.5 text-[10px]", theme.muted)}>
                  Válido por {plan.days} días
                  {bundleDiscountPct > 0 ? (
                    <span className="ml-1 font-semibold text-emerald-700 dark:text-emerald-400">
                      {" "}
                      · −{bundleDiscountPct}%
                    </span>
                  ) : null}
                </p>

                {bundleDiscountPct > 0 ? (
                  <p className="mt-0.5 text-[10px] line-through opacity-70">{fullPrice.toLocaleString("es-AR")} sin dto.</p>
                ) : null}

                <Button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    if (!mercadoPagoConfigured) {
                      document.getElementById("subscription-manual")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      return;
                    }
                    void onPayPlan(key);
                  }}
                  className={cn(
                    "mt-4 h-9 w-full rounded-lg text-xs font-semibold shadow-sm transition-transform active:scale-[0.98]",
                    theme.button
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 size-3.5 animate-spin" />
                      Procesando…
                    </>
                  ) : mercadoPagoConfigured ? (
                    "Suscribirme"
                  ) : (
                    "Ver opciones de pago"
                  )}
                </Button>

                <ul className={cn("mt-4 space-y-1.5 border-t pt-3 text-left", theme.featuresBorder)}>
                  {PLAN_FEATURES.map((f) => (
                    <li key={f} className={cn("text-[11px] leading-snug", theme.featureText)}>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {mercadoPagoConfigured ? (
          <p className="text-center text-xs text-muted-foreground">
            Al tocar <strong className="font-medium text-foreground">Suscribirme</strong> abrís el checkout seguro de Mercado Pago
            (tarjeta, efectivo y más).
          </p>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            El cobro con tarjeta no está activo en este entorno. Usá las opciones de pago manual más abajo.
          </p>
        )}
      </section>

      {showAssistedBlock ? (
        <section id="subscription-manual" className="scroll-mt-8 w-full">
          <div className="rounded-3xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-6 shadow-sm">
            <div className="flex flex-wrap items-start gap-3">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
                <MessageCircle className="size-5" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-lg font-semibold tracking-tight">Pago o activación manual</h3>
                <p className="text-sm text-muted-foreground">
                  Si no tenés tarjeta, preferís transferir o pagar por Mercado Pago con alias, contactanos con el{" "}
                  <strong className="text-foreground">ID de tu negocio</strong>. Así podemos activarte el plan a mano
                  cuando verifiquemos el pago.
                </p>
              </div>
            </div>

            {!mercadoPagoConfigured ? (
              <div className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
                El cobro con tarjeta (checkout) no está activo en este servidor. Usá alias, WhatsApp o teléfono.
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ID de tu negocio</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 break-all rounded-xl border border-[var(--pos-border)] bg-[var(--pos-surface-2)] px-3 py-2.5 text-xs">
                  {businessId}
                </code>
                <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 gap-2 rounded-xl" onClick={copyBusinessId}>
                  <Copy className="size-4" />
                  Copiar ID
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Es el identificador del negocio en el sistema (no es tu mail). Enviáselo tal cual al administrador.
              </p>
            </div>

            {hasManualDetails ? (
              <div className="mt-6 space-y-4 border-t border-[var(--pos-border)] pt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {mpAlias ? (
                    <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface-2)]/80 p-4">
                      <p className="text-xs font-semibold text-muted-foreground">Mercado Pago / transferencia (alias)</p>
                      <p className="mt-1 font-mono text-sm font-medium">{mpAlias}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-8 gap-1.5 px-2 text-xs"
                        onClick={copyMpAlias}
                      >
                        <Copy className="size-3.5" />
                        Copiar alias
                      </Button>
                    </div>
                  ) : null}
                  {(phoneDisplay || telHref) ? (
                    <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface-2)]/80 p-4">
                      <p className="text-xs font-semibold text-muted-foreground">Teléfono</p>
                      {phoneDisplay ? <p className="mt-1 text-sm font-medium">{phoneDisplay}</p> : null}
                      {telHref ? (
                        <a
                          href={telHref}
                          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--pos-accent)] underline-offset-4 hover:underline"
                        >
                          <Phone className="size-4" />
                          Llamar
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {(cbu || transferHolder || transferNote) ? (
                  <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface-2)]/80 p-4">
                    <p className="text-xs font-semibold text-muted-foreground">Datos bancarios (transferencia)</p>
                    {transferHolder ? (
                      <p className="mt-2 text-sm">
                        <span className="text-muted-foreground">Titular: </span>
                        <span className="font-medium">{transferHolder}</span>
                      </p>
                    ) : null}
                    {cbu ? (
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <p className="min-w-0 flex-1 break-all font-mono text-sm">{cbu}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 gap-1.5"
                          onClick={() => {
                            void navigator.clipboard.writeText(cbu);
                            toast.success("CBU/CVU copiado");
                          }}
                        >
                          <Copy className="size-3.5" />
                          Copiar
                        </Button>
                      </div>
                    ) : null}
                    {transferNote ? (
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{transferNote}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-6 border-t border-[var(--pos-border)] pt-6 text-sm text-muted-foreground">
                Pedile al administrador los datos de pago; solo necesitás enviarle el ID de arriba.
              </p>
            )}

            {whatsappHref ? (
              <div className="mt-6">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#20bd5a] sm:w-auto"
                >
                  <MessageCircle className="size-5" />
                  Escribir por WhatsApp (mensaje con tu ID)
                </a>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
