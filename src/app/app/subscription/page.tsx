import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";

import { SubscriptionClient } from "@/app/app/subscription/subscription-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { fetchSubscriptionWithAutoTrial } from "@/lib/supabase/ensure-subscription-trial";
import { getStoreEnvPrice, getStoreEnvTitle } from "@/lib/store-products";

/** Valores por defecto si no configurás env (transferencia / alias fijos de la tienda). */
const DEFAULT_MANUAL_MP_ALIAS = "tienda360.mp";
const DEFAULT_MANUAL_PHONE = "11 2314-5742";

function manualContactFromEnv() {
  const mpAlias =
    (process.env.NEXT_PUBLIC_SUBSCRIPTION_MANUAL_MP_ALIAS ?? "").trim() || DEFAULT_MANUAL_MP_ALIAS;
  const phoneDisplay =
    (process.env.NEXT_PUBLIC_SUBSCRIPTION_MANUAL_PHONE ?? "").trim() || DEFAULT_MANUAL_PHONE;
  const whatsappDigits = (process.env.NEXT_PUBLIC_SUBSCRIPTION_MANUAL_WHATSAPP ?? "").replace(/\D/g, "");
  const cbu = (process.env.NEXT_PUBLIC_SUBSCRIPTION_MANUAL_CBU ?? "").trim();
  const transferHolder = (process.env.NEXT_PUBLIC_SUBSCRIPTION_MANUAL_TRANSFER_HOLDER ?? "").trim();
  const transferNote = (process.env.NEXT_PUBLIC_SUBSCRIPTION_MANUAL_TRANSFER_NOTE ?? "").trim();
  return { mpAlias, phoneDisplay, whatsappDigits, cbu, transferHolder, transferNote };
}

export default async function SubscriptionPage() {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;
  const manualContact = manualContactFromEnv();
  const mercadoPagoConfigured = Boolean((process.env.MERCADOPAGO_ACCESS_TOKEN ?? "").trim());
  const lifetimePrice = getStoreEnvPrice("software_lifetime");
  const lifetimeTitle = getStoreEnvTitle("software_lifetime");

  if (!businessId) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Suscripción</CardTitle>
            <CardDescription>Seleccioná o creá un negocio primero.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/app/setup" className="text-sm underline">
              Ir a configuración
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const { row: subscription, errorMessage: subErrorMessage } = await fetchSubscriptionWithAutoTrial(
    supabase,
    businessId
  );

  return (
    <div className="relative isolate min-h-[60vh]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:linear-gradient(180deg,black,transparent_95%)]"
      >
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[color-mix(in_oklab,var(--pos-accent)_22%,transparent)] blur-3xl" />
        <div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-[color-mix(in_oklab,var(--sub-sky)_35%,transparent)] blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-[color-mix(in_oklab,var(--sub-orchid)_12%,transparent)] blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--pos-accent)]">Facturación</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Mi{" "}
            <span className="bg-gradient-to-r from-[var(--pos-accent)] via-teal-500 to-[var(--sub-sky)] bg-clip-text text-transparent">
              suscripción
            </span>
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Gestioná tu prueba gratis y activá la licencia de por vida con un pago único por Mercado Pago.
          </p>
        </header>

        <div className="mt-8">
          <Suspense
            fallback={
              <div className="flex h-32 items-center justify-center rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface)] text-sm text-muted-foreground">
                Cargando…
              </div>
            }
          >
            <SubscriptionClient
              businessId={businessId}
              subscription={subscription}
              lifetimePrice={lifetimePrice}
              lifetimeTitle={lifetimeTitle}
              loadError={subErrorMessage ?? null}
              mercadoPagoConfigured={mercadoPagoConfigured}
              manualContact={manualContact}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
