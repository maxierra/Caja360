import { AdminConversionDashboardView } from "@/app/admin/(dashboard)/admin-conversion-dashboard";
import { AdminPasswordResetTool } from "@/app/admin/(dashboard)/admin-password-reset-tool";
import { loadAdminConversionDashboard, loadAdminDownloadStats, loadAdminSubscriptionList } from "@/app/admin/(dashboard)/data";
import { AdminSubscriptionsOverview } from "@/app/admin/(dashboard)/subscriptions-overview";
import { AdminWithMonitoring } from "@/components/admin-with-monitoring";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { emailIsPlatformAdmin } from "@/lib/platform-admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function billingDaysFromEnv(): number {
  const d = Number(
    process.env.MANUAL_SUBSCRIPTION_PERIOD_DAYS ?? process.env.MERCADOPAGO_BILLING_PERIOD_DAYS ?? 30
  );
  return Number.isFinite(d) && d > 0 ? Math.floor(d) : 30;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !emailIsPlatformAdmin(user.email)) {
    redirect("/admin/login?error=No+tienes+acceso+al+panel+de+administracion");
  }

  const serviceRoleOk = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim());
  const billingDays = billingDaysFromEnv();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 space-y-8">
      <AdminWithMonitoring />

      {!serviceRoleOk ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Falta service role</CardTitle>
            <CardDescription>
              Sin SUPABASE_SERVICE_ROLE_KEY no se puede actualizar suscripciones de otros negocios. Copiá la clave desde
              Supabase → Settings → API.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <AdminAdminBody billingDays={billingDays} month={sp.month} />
      )}
    </div>
  );
}

async function AdminAdminBody({ billingDays, month }: { billingDays: number; month?: string }) {
  const [loaded, downloadStatsLoaded, conversionLoaded] = await Promise.all([
    loadAdminSubscriptionList(),
    loadAdminDownloadStats(),
    loadAdminConversionDashboard(month),
  ]);

  if (!loaded.ok) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>No se pudo cargar el listado</CardTitle>
          <CardDescription>
            {loaded.error === "forbidden"
              ? "Sesión no autorizada."
              : (loaded.message ?? "Revisá la consola o la conexión a Supabase.")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const downloadStats = downloadStatsLoaded.ok ? downloadStatsLoaded.stats : null;

  return (
    <>
      <AdminPasswordResetTool />

      {!downloadStatsLoaded.ok && downloadStatsLoaded.error !== "forbidden" ? (
        <Card className="border-amber-400/40">
          <CardHeader>
            <CardTitle>Métrica de descargas no disponible</CardTitle>
            <CardDescription>
              {downloadStatsLoaded.message ?? "Revisá si aplicaste la migración de download_events."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!conversionLoaded.ok && conversionLoaded.error !== "forbidden" ? (
        <Card className="border-amber-400/40">
          <CardHeader>
            <CardTitle>Métricas de conversión no disponibles</CardTitle>
            <CardDescription>
              {conversionLoaded.message ?? "No se pudieron cargar los indicadores de registros/uso."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {conversionLoaded.ok ? <AdminConversionDashboardView data={conversionLoaded.data} /> : null}

      <AdminSubscriptionsOverview rows={loaded.rows} billingDays={billingDays} downloadStats={downloadStats} />
    </>
  );
}
