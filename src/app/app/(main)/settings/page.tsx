import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "@/app/app/(main)/settings/settings-client";
import { getFiscalSettings } from "@/app/app/(main)/settings/fiscal-actions";
import type { BusinessPaymentMethodRow } from "@/lib/business-payment-methods";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;

  let paymentMethods: BusinessPaymentMethodRow[] = [];
  let canEditPaymentMethods = false;
  let mercadoPagoPosExternalId: string | null = null;
  let mercadoPagoQrReady = false;

  let fiscalSettings: Awaited<ReturnType<typeof getFiscalSettings>> | null = null;

  let business: {
    name: string;
    business_type: string;
    gastronomy_counter_enabled: boolean;
    gastronomy_delivery_enabled: boolean;
    gastronomy_tables_enabled: boolean;
    address: string | null;
    phone: string | null;
    cuit: string | null;
    ticket_header: string | null;
    ticket_footer: string | null;
    report_daily_enabled: boolean;
    report_daily_email: string | null;
    report_daily_time: string | null;
    tables: Array<{ id: string; name: string; active: boolean }>;
  } | null = null;

  if (businessId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("businesses")
      .select(
        "name,business_type,gastronomy_counter_enabled,gastronomy_delivery_enabled,gastronomy_tables_enabled,address,phone,cuit,ticket_header,ticket_footer,report_daily_enabled,report_daily_email,report_daily_time,mercadopago_pos_external_id"
      )
      .eq("id", businessId)
      .single();

    if (data) {
      const typedBusiness = data as {
        name: string;
        business_type: string;
        gastronomy_counter_enabled: boolean;
        gastronomy_delivery_enabled: boolean;
        gastronomy_tables_enabled: boolean;
        address: string | null;
        phone: string | null;
        cuit: string | null;
        ticket_header: string | null;
        ticket_footer: string | null;
        report_daily_enabled: boolean;
        report_daily_email: string | null;
        report_daily_time: string | null;
      };
      const { data: tableRows } = await supabase
        .from("business_tables")
        .select("id,name,active")
        .eq("business_id", businessId)
        .order("name", { ascending: true });

      business = {
        ...typedBusiness,
        tables: (tableRows ?? []) as Array<{ id: string; name: string; active: boolean }>,
      };
      mercadoPagoPosExternalId =
        ((data as { mercadopago_pos_external_id?: string | null }).mercadopago_pos_external_id as string | null) ??
        null;
    }

    const { data: mpReady, error: mpRpcErr } = await supabase.rpc("business_mercadopago_qr_ready", {
      p_business_id: businessId,
    });
    if (!mpRpcErr) {
      mercadoPagoQrReady = mpReady === true;
    }

    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    if (uid) {
      const { data: mem } = await supabase
        .from("memberships")
        .select("role")
        .eq("business_id", businessId)
        .eq("user_id", uid)
        .is("deleted_at", null)
        .maybeSingle();
      canEditPaymentMethods = String((mem as { role?: string } | null)?.role) === "owner";
    }

    await supabase.rpc("ensure_business_payment_methods", { p_business_id: businessId });
    const { data: pm } = await supabase
      .from("business_payment_methods")
      .select("id,business_id,method_code,label,icon_key,icon_url,is_active,sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true });

    paymentMethods = (pm ?? []) as BusinessPaymentMethodRow[];

    try {
      fiscalSettings = await getFiscalSettings();
    } catch {
      fiscalSettings = null;
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-10 border-b border-border/60 pb-8">
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Preferencias del negocio y del sistema.
        </p>
      </div>

      <div className="grid gap-6">
        <SettingsClient
          defaults={business ?? undefined}
          paymentMethods={paymentMethods}
          canEditPaymentMethods={canEditPaymentMethods}
          mercadoPagoPosExternalId={mercadoPagoPosExternalId}
          mercadoPagoQrReady={mercadoPagoQrReady}
          fiscalSettings={fiscalSettings}
        />
      </div>
    </div>
  );
}
