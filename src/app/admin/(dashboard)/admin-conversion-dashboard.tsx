import type { AdminConversionDashboard } from "@/app/admin/(dashboard)/data";

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function statusChip(row: AdminConversionDashboard["recent"][number]) {
  if (!row.hasAppAccess) {
    return <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">Sin acceso</span>;
  }
  if (row.currentSubscriptionStatus === "active") {
    return <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300">Plan activo</span>;
  }
  if (row.currentSubscriptionStatus === "trialing") {
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">En prueba</span>;
  }
  return <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Sin suscripción</span>;
}

function monthNameShort(monthKey: string) {
  const [y, m] = monthKey.split("-");
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1, 12, 0, 0, 0));
  return d.toLocaleDateString("es-AR", { month: "short", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
}

type Props = {
  data: AdminConversionDashboard;
};

export function AdminConversionDashboardView({ data }: Props) {
  const noActivityPct = data.monthRegistrations > 0 ? (data.monthNoActivity / data.monthRegistrations) * 100 : 0;
  const maxDaily = Math.max(
    1,
    ...data.daily.map((d) => Math.max(d.registrations, d.productActiveBusinesses, d.salesActiveBusinesses))
  );

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-4 shadow-sm">
        <h2 className="text-lg font-semibold tracking-tight">Conversión y uso real ({data.monthLabel})</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vista clara para saber quién se registra, quién carga productos, quién vende y quién termina pagando.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {data.availableMonths.map((m) => (
            <a
              key={m}
              href={`/admin?month=${encodeURIComponent(m)}`}
              className={
                m === data.selectedMonth
                  ? "rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                  : "rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/60"
              }
            >
              {monthNameShort(m)}
            </a>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface-2)]/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registros del mes</p>
            <p className="mt-1 text-2xl font-bold">{data.monthRegistrations}</p>
          </div>
          <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface-2)]/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Con productos</p>
            <p className="mt-1 text-2xl font-bold text-sky-600 dark:text-sky-300">
              {data.monthWithProducts} <span className="text-base text-muted-foreground">({data.monthWithProductsPct.toFixed(1)}%)</span>
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface-2)]/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Con ventas</p>
            <p className="mt-1 text-2xl font-bold text-violet-600 dark:text-violet-300">
              {data.monthWithSales} <span className="text-base text-muted-foreground">({data.monthWithSalesPct.toFixed(1)}%)</span>
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface-2)]/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagaron en el mes</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-300">
              {data.monthPaidBusinesses} <span className="text-base text-muted-foreground">({data.monthPaidPct.toFixed(1)}%)</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-4 shadow-sm xl:col-span-2">
          <h3 className="text-base font-semibold tracking-tight">Gráfico de barras diario ({data.monthLabel})</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Día por día: registrados, negocios que cargan productos y negocios que hacen ventas.
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--pos-border)] p-3">
            <div className="flex min-w-[980px] items-end gap-1">
              {data.daily.map((d) => {
                const regH = Math.max(2, Math.round((d.registrations / maxDaily) * 90));
                const prodH = Math.max(2, Math.round((d.productActiveBusinesses / maxDaily) * 90));
                const saleH = Math.max(2, Math.round((d.salesActiveBusinesses / maxDaily) * 90));
                return (
                  <div key={d.day} className="flex w-8 flex-col items-center gap-1">
                    <div className="flex h-24 items-end gap-[2px]" title={`${d.day} · Reg ${d.registrations} · Prod ${d.productActiveBusinesses} · Ventas ${d.salesActiveBusinesses}`}>
                      <span className="w-2 rounded-t bg-emerald-500/85" style={{ height: `${regH}px` }} />
                      <span className="w-2 rounded-t bg-sky-500/85" style={{ height: `${prodH}px` }} />
                      <span className="w-2 rounded-t bg-violet-500/85" style={{ height: `${saleH}px` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{d.day.slice(-2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Registros</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" />Negocios que cargan productos</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500" />Negocios que venden</span>
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-4 shadow-sm">
          <h3 className="text-base font-semibold tracking-tight">Embudo mensual</h3>
          <p className="mt-1 text-xs text-muted-foreground">Del registro al uso y pago (con porcentajes).</p>
          <div className="mt-4 space-y-2 text-xs">
            <div className="rounded-xl border p-2">
              <div className="flex items-center justify-between"><span>Registrados</span><strong>{data.monthRegistrations}</strong></div>
            </div>
            <div className="rounded-xl border p-2">
              <div className="flex items-center justify-between"><span>Cargaron productos</span><strong>{data.monthWithProducts} ({data.monthWithProductsPct.toFixed(1)}%)</strong></div>
            </div>
            <div className="rounded-xl border p-2">
              <div className="flex items-center justify-between"><span>Hicieron ventas</span><strong>{data.monthWithSales} ({data.monthWithSalesPct.toFixed(1)}%)</strong></div>
            </div>
            <div className="rounded-xl border p-2">
              <div className="flex items-center justify-between"><span>Pagaron</span><strong>{data.monthPaidBusinesses} ({data.monthPaidPct.toFixed(1)}%)</strong></div>
            </div>
            <div className="rounded-xl border p-2">
              <div className="flex items-center justify-between"><span>Sin actividad</span><strong>{data.monthNoActivity} ({noActivityPct.toFixed(1)}%)</strong></div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-4 shadow-sm">
        <h3 className="text-base font-semibold tracking-tight">Registros recientes (seguimiento de adopción)</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Detectá rápido quién se registró y no avanzó en carga de productos, ventas o pago.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-[var(--pos-border)] text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2">Negocio</th>
                <th className="px-2 py-2">Registro</th>
                <th className="px-2 py-2">Antigüedad</th>
                <th className="px-2 py-2">Estado</th>
                <th className="px-2 py-2">Plan</th>
                <th className="px-2 py-2">Productos</th>
                <th className="px-2 py-2">Ventas</th>
                <th className="px-2 py-2">Prod. cargados (mes)</th>
                <th className="px-2 py-2">Ventas (mes)</th>
                <th className="px-2 py-2">Pago</th>
                <th className="px-2 py-2">Conversión +7d</th>
                <th className="px-2 py-2">Últ. producto</th>
                <th className="px-2 py-2">Últ. venta</th>
                <th className="px-2 py-2">Primer pago</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.businessId} className="border-b border-[var(--pos-border)]/60">
                  <td className="px-2 py-2 font-medium">{r.businessName}</td>
                  <td className="px-2 py-2 text-xs">{fmtDateTime(r.createdAt)}</td>
                  <td className="px-2 py-2 text-xs">{r.ageDays} días</td>
                  <td className="px-2 py-2">{statusChip(r)}</td>
                  <td className="px-2 py-2 text-xs">{r.currentPlanId ?? "—"}</td>
                  <td className="px-2 py-2 text-xs">
                    {r.hasProducts ? (
                      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 font-medium text-sky-700 dark:text-sky-300">Sí</span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {r.hasPaidSales ? (
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-medium text-violet-700 dark:text-violet-300">Sí</span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs font-medium">{r.productsCreatedInMonth}</td>
                  <td className="px-2 py-2 text-xs font-medium">{r.paidSalesCountInMonth}</td>
                  <td className="px-2 py-2 text-xs">
                    {r.hasApprovedPayment ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-300">
                        Aprobado
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">No pagó</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {r.convertedAfter7d ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-300">
                        Sí
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs">{fmtDateTime(r.lastProductAt)}</td>
                  <td className="px-2 py-2 text-xs">{fmtDateTime(r.lastSaleAt)}</td>
                  <td className="px-2 py-2 text-xs">{fmtDateTime(r.lastPaymentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
