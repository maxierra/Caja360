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
  startLifetimeUpgradeCheckout,
} from "@/app/app/subscription/actions";
import { Button } from "@/components/ui/button";
import { TrialCountdown } from "@/components/trial-countdown";
import { parseDbTimestamptzToDate } from "@/lib/parse-db-timestamp";
import { formatStorePrice } from "@/lib/store-products";
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

type Props = {
  businessId: string;
  subscription: SubscriptionRow | null;
  lifetimePrice: number;
  lifetimeTitle: string;
  loadError?: string | null;
  mercadoPagoConfigured: boolean;
  manualContact: ManualContactProps;
};

const PLAN_FEATURES = ["Punto de venta y caja", "Productos y stock", "Ventas e informes", "Actualizaciones incluidas"];

export function SubscriptionClient({
  businessId,
  subscription,
  lifetimePrice,
  lifetimeTitle,
  loadError,
  mercadoPagoConfigured,
  manualContact,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingLifetime, setLoadingLifetime] = React.useState(false);

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
  const isLifetime = subscription?.plan_id === "lifetime";
  const trialEnds = parseDbTimestamptzToDate(subscription?.current_period_end ?? null);
  const periodEnds =
    isActive && subscription?.current_period_end
      ? parseDbTimestamptzToDate(subscription.current_period_end)
      : null;

  const onPayLifetime = async () => {
    setLoadingLifetime(true);
    try {
      const res = await startLifetimeUpgradeCheckout();
      if ("error" in res) {
        toast.error("No se pudo iniciar el pago", { description: res.error });
        return;
      }
      window.location.href = res.checkoutUrl;
    } finally {
      setLoadingLifetime(false);
    }
  };

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
          {subscription && isActive && hasAccess && isLifetime ? (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <BadgeCheck className="size-3.5" />
              Licencia de por vida
            </span>
          ) : null}
          {subscription && isActive && hasAccess && !isLifetime ? (
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
              {isActive && isLifetime ? (
                <p className="leading-relaxed text-muted-foreground">
                  Tenés la <strong className="text-emerald-700 dark:text-emerald-300">licencia de por vida</strong> activa.
                  Sin vencimiento ni pagos recurrentes.
                </p>
              ) : null}
              {isActive && !isLifetime && periodEnds ? (
                <p className="leading-relaxed">
                  Tu plan está <strong className="text-sky-600 dark:text-sky-300">activo</strong> hasta{" "}
                  <strong>
                    {periodEnds.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}
                  </strong>
                  .
                </p>
              ) : null}
              {isActive && !isLifetime && !periodEnds ? (
                <p className="text-muted-foreground">Plan activo. Gracias por confiar en nosotros.</p>
              ) : null}
            </>
          ) : (
            <div className="space-y-4">
              {isTrial && subscription?.current_period_end ? (
                <TrialCountdown endsAt={subscription.current_period_end} variant="large" />
              ) : null}
              <div className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-4">
                <p className="font-medium text-destructive">Tu prueba terminó</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Para seguir usando el punto de venta, productos e informes, activá la{" "}
                  <strong className="text-foreground">licencia de por vida</strong> con un pago único de{" "}
                  <strong className="text-foreground">{formatStorePrice(lifetimePrice)}</strong>.
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

      {/* Licencia de por vida */}
      {!isLifetime ? (
      <section className="space-y-4">
        <div className="text-center sm:text-left">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Activá tu licencia</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Un solo pago, sin suscripción mensual. El acceso queda activo para siempre.
          </p>
        </div>

        <div className="mx-auto w-full max-w-lg">
          <div className="relative flex flex-col rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-white px-6 pb-6 pt-8 text-center shadow-sm dark:from-emerald-950/35 dark:to-zinc-900/90 dark:border-emerald-800/60">
            <h4 className="text-base font-bold text-emerald-900 dark:text-emerald-100">Licencia de por vida</h4>
            <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">{lifetimeTitle}</p>

            <div className="mt-4 flex flex-col items-center gap-1">
              <div
                className="flex flex-wrap items-baseline justify-center gap-x-1"
                aria-label={`${lifetimePrice.toLocaleString("es-AR")} pesos argentinos`}
              >
                <span className="text-2xl font-bold tabular-nums leading-none text-emerald-600 dark:text-emerald-400">$</span>
                <span className="text-4xl font-black tabular-nums tracking-tight text-emerald-950 dark:text-emerald-50">
                  {lifetimePrice.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                </span>
                <span className="ml-0.5 inline-flex items-center rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none tracking-wider text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-100">
                  ARS
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Pago único · sin vencimiento</p>
            </div>

            <ul className="mt-5 space-y-1.5 border-t border-emerald-100 pt-4 text-left dark:border-emerald-900/50">
              {PLAN_FEATURES.map((f) => (
                <li key={f} className="text-[11px] leading-snug text-emerald-800/85 dark:text-emerald-200/75">
                  {f}
                </li>
              ))}
            </ul>

            <Button
              type="button"
              disabled={loadingLifetime}
              onClick={() => {
                if (!mercadoPagoConfigured) {
                  document.getElementById("subscription-manual")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  return;
                }
                void onPayLifetime();
              }}
              className="mt-5 h-10 w-full rounded-lg bg-emerald-600 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              {loadingLifetime ? (
                <>
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                  Procesando…
                </>
              ) : mercadoPagoConfigured ? (
                `Pagar ${formatStorePrice(lifetimePrice)}`
              ) : (
                "Ver opciones de pago"
              )}
            </Button>
          </div>
        </div>

        {mercadoPagoConfigured ? (
          <p className="text-center text-xs text-muted-foreground">
            Al tocar <strong className="font-medium text-foreground">Pagar</strong> abrís el checkout seguro de Mercado Pago
            (tarjeta, efectivo y más).
          </p>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            El cobro con tarjeta no está activo en este entorno. Usá las opciones de pago manual más abajo.
          </p>
        )}
      </section>
      ) : null}

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
