import { AdminSubscriptionRowActions } from "@/app/admin/(dashboard)/admin-subscription-row-actions";
import type { AdminDownloadStats, AdminSubscriptionListItem } from "@/app/admin/(dashboard)/data";
import { parseDbTimestamptzToDate } from "@/lib/parse-db-timestamp";

function shortUuid(id: string) {
  if (id.length <= 10) return id;
  return `${id.slice(0, 8)}…`;
}

function badgeForSummary(s: AdminSubscriptionListItem["billingSummary"]) {
  switch (s) {
    case "mp_automatico":
      return (
        <span className="inline-flex rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-800 dark:text-sky-200">
          MP / automático
        </span>
      );
    case "manual_admin":
      return (
        <span className="inline-flex rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-800 dark:text-violet-200">
          Manual (vos)
        </span>
      );
    case "free_admin":
      return (
        <span className="inline-flex rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-800 dark:text-sky-200">
          Gratis (admin)
        </span>
      );
    case "solo_prueba":
      return (
        <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:text-amber-100">
          Solo prueba
        </span>
      );
    case "suspendido_admin":
      return (
        <span className="inline-flex rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
          Suspendido (vos)
        </span>
      );
    default:
      return (
        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          Sin pagos en lista
        </span>
      );
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    trialing: "En prueba",
    active: "Activo",
    past_due: "Pago vencido",
    canceled: "Cancelado",
  };
  return map[status] ?? status;
}

function providerLabel(provider: string) {
  if (provider === "admin_suspended") return "Suspendido (admin)";
  if (provider === "free_admin") return "Gratis (admin)";
  return provider;
}

type Props = {
  rows: AdminSubscriptionListItem[];
  billingDays: number;
  downloadStats: AdminDownloadStats | null;
};

export function AdminSubscriptionsOverview({ rows, billingDays, downloadStats }: Props) {
  const sinAcceso = rows.filter((r) => !r.hasAppAccess).length;
  const mpAuto = rows.filter((r) => r.billingSummary === "mp_automatico").length;
  const manual = rows.filter((r) => r.billingSummary === "manual_admin").length;
  const free = rows.filter((r) => r.billingSummary === "free_admin").length;
  const lastDownload = downloadStats?.lastEventAt
    ? new Date(downloadStats.lastEventAt).toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Sin eventos";

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sin acceso al POS</p>
          <p className="mt-1 text-2xl font-bold text-destructive">{sinAcceso}</p>
          <p className="mt-1 text-xs text-muted-foreground">Trial vencido o plan inactivo — revisá transferencias</p>
        </div>
        <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cobro Mercado Pago</p>
          <p className="mt-1 text-2xl font-bold text-sky-600 dark:text-sky-300">{mpAuto}</p>
          <p className="mt-1 text-xs text-muted-foreground">Último pago aprobado vía MP o plan activo MP</p>
        </div>
        <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activado manual</p>
          <p className="mt-1 text-2xl font-bold text-violet-600 dark:text-violet-300">{manual}</p>
          <p className="mt-1 text-xs text-muted-foreground">Transferencia / panel admin</p>
        </div>
        <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acceso gratis</p>
          <p className="mt-1 text-2xl font-bold text-sky-600 dark:text-sky-300">{free}</p>
          <p className="mt-1 text-xs text-muted-foreground">Cortesía sin vencimiento desde admin</p>
        </div>
        <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descargas instalador</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-300">
            {downloadStats?.total ?? 0}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">24h: {downloadStats?.last24h ?? 0} · 7d: {downloadStats?.last7d ?? 0}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Última: {lastDownload}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-4 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">Todas las suscripciones</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Hasta 300 negocios por última actualización. <strong>+{billingDays}d</strong> habilita; el ícono de prohibido corta el
          acceso al POS. El regalo genera un código −50% (plan 1m / 6m / 12m) y se copia al portapapeles.
        </p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--pos-border)]">
          <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--pos-border)] bg-[var(--pos-surface-2)]/80 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">Negocio</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Estado</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Cobro</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Provider (DB)</th>
                <th className="px-3 py-2.5 whitespace-nowrap">POS</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Fin período</th>
                <th className="px-3 py-2.5 min-w-[140px]">Último pago</th>
                <th className="min-w-[22rem] whitespace-nowrap px-3 py-2.5">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const trialExpiredBlocked =
                  !r.hasAppAccess &&
                  r.status === "trialing" &&
                  r.currentPeriodEndMs != null &&
                  r.currentPeriodEndMs < Date.now();
                const posTitle = !r.hasAppAccess
                  ? trialExpiredBlocked
                    ? `Prueba vencida (misma regla que el POS). Usá +${billingDays}d para habilitar.`
                    : "Sin acceso al POS hasta reactivar o pagar."
                  : undefined;

                const lastPayLine = r.lastPayment
                  ? `${r.lastPayment.provider} ${r.lastPayment.amount} ${r.lastPayment.currency} · ${r.lastPayment.status} · ${new Date(r.lastPayment.created_at).toLocaleString("es-AR", {
                      timeZone: "America/Argentina/Buenos_Aires",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}`
                  : "";

                return (
                  <tr
                    key={r.subscriptionId}
                    className="border-b border-[var(--pos-border)]/80 hover:bg-[var(--pos-surface-2)]/40"
                  >
                    <td className="max-w-[min(22rem,32vw)] px-3 py-2 align-middle">
                      <div
                        className="truncate text-sm"
                        title={`${r.businessName} · ${r.businessSlug} · ${r.businessId}`}
                      >
                        <span className="font-medium">{r.businessName}</span>
                        <span className="text-muted-foreground"> · </span>
                        <span className="text-muted-foreground">{r.businessSlug}</span>
                        <span className="text-muted-foreground"> · </span>
                        <span className="font-mono text-[10px] text-muted-foreground">{shortUuid(r.businessId)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle whitespace-nowrap">
                      <span className="font-medium">{statusLabel(r.status)}</span>
                    </td>
                    <td className="px-3 py-2 align-middle whitespace-nowrap">{badgeForSummary(r.billingSummary)}</td>
                    <td className="px-3 py-2 align-middle font-mono text-xs whitespace-nowrap">
                      {providerLabel(r.provider)}
                    </td>
                    <td className="px-3 py-2 align-middle whitespace-nowrap">
                      {r.hasAppAccess ? (
                        <span className="text-emerald-600 dark:text-emerald-400">OK</span>
                      ) : (
                        <span className="cursor-help font-medium text-destructive underline decoration-dotted" title={posTitle}>
                          Bloqueado
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle text-xs whitespace-nowrap">
                      {r.currentPeriodEnd
                        ? (() => {
                            const d = parseDbTimestamptzToDate(r.currentPeriodEnd);
                            return d
                              ? d.toLocaleString("es-AR", {
                                  timeZone: "America/Argentina/Buenos_Aires",
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })
                              : r.currentPeriodEnd;
                          })()
                        : "—"}
                    </td>
                    <td className="max-w-[200px] px-3 py-2 align-middle text-xs">
                      {r.lastPayment ? (
                        <div className="truncate" title={lastPayLine}>
                          {r.lastPayment.provider} {r.lastPayment.amount} {r.lastPayment.currency} · {r.lastPayment.status}{" "}
                          ·{" "}
                          {new Date(r.lastPayment.created_at).toLocaleString("es-AR", {
                            timeZone: "America/Argentina/Buenos_Aires",
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-middle">
                      <div className="flex justify-end">
                        <AdminSubscriptionRowActions
                        businessId={r.businessId}
                        businessName={r.businessName}
                        billingDays={billingDays}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
