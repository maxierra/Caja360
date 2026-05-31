import { ArrowLeft, PackageSearch } from "lucide-react";
import Link from "next/link";

import { loadAdminProductLoadTotals } from "@/app/admin/(dashboard)/carga-productos/data";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function shortUuid(id: string) {
  return id.length <= 10 ? id : `${id.slice(0, 8)}...`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR").format(value);
}

export default async function AdminProductLoadsPage() {
  const loaded = await loadAdminProductLoadTotals();

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="rounded-2xl border border-destructive/40 bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">No se pudo cargar la métrica</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {loaded.message ??
              (loaded.error === "forbidden"
                ? "Sesión no autorizada."
                : "Revisá la conexión con Supabase o aplicá la migración admin_product_load_totals.")}
          </p>
        </div>
      </div>
    );
  }

  const totalBusinesses = loaded.rows.length;
  const totalProducts = loaded.rows.reduce((sum, row) => sum + row.totalProductos, 0);
  const topBusiness = loaded.rows[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Comercios con productos" value={formatNumber(totalBusinesses)} />
        <MetricCard label="Productos cargados" value={formatNumber(totalProducts)} />
        <MetricCard
          label="Mayor carga"
          value={topBusiness ? formatNumber(topBusiness.totalProductos) : "0"}
          detail={topBusiness?.businessName ?? "Sin productos cargados"}
        />
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm dark:bg-[#120a00]/80 dark:border-amber-900/30">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground dark:text-amber-200/60">
          <PackageSearch className="h-4 w-4" />
          <span>Totales por comercio ordenados de mayor a menor</span>
        </div>

        {loaded.rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center dark:border-amber-900/30">
            <PackageSearch className="mb-4 h-8 w-8 text-muted-foreground dark:text-amber-500/30" />
            <h3 className="text-lg font-medium dark:text-amber-100">Sin productos cargados</h3>
            <p className="text-sm text-muted-foreground dark:text-amber-200/50">
              Todavía no hay productos asociados a comercios.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b dark:border-amber-900/30">
                  <th className="py-3 pr-4 text-left font-medium text-muted-foreground dark:text-amber-200/70">
                    #
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground dark:text-amber-200/70">
                    Comercio
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground dark:text-amber-200/70">
                    Business ID
                  </th>
                  <th className="py-3 pl-4 text-right font-medium text-muted-foreground dark:text-amber-200/70">
                    Total productos
                  </th>
                </tr>
              </thead>
              <tbody>
                {loaded.rows.map((row, index) => (
                  <tr
                    key={row.businessId}
                    className="border-b transition-colors hover:bg-muted/50 dark:border-amber-900/10 dark:hover:bg-amber-950/30"
                  >
                    <td className="py-3 pr-4 text-muted-foreground dark:text-amber-200/70">{index + 1}</td>
                    <td className="px-4 py-3 font-medium dark:text-amber-100">{row.businessName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground dark:text-amber-500/80">
                      <span title={row.businessId}>{shortUuid(row.businessId)}</span>
                    </td>
                    <td className="py-3 pl-4 text-right text-lg font-bold text-orange-600 dark:text-orange-300">
                      {formatNumber(row.totalProductos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Link href="/admin">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight dark:text-amber-50">
            <PackageSearch className="h-6 w-6 text-orange-500" />
            Carga de productos por comercio
          </h1>
        </div>
        <p className="ml-10 max-w-3xl text-sm text-muted-foreground dark:text-amber-200/50">
          Cantidad total de productos registrados por business ID.
        </p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-orange-600 dark:text-orange-300">{value}</p>
      {detail ? <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
