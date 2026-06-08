import Link from "next/link";
import { cookies } from "next/headers";

import { SalesRowActions } from "@/app/app/(main)/sales/sales-row-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ id: string }>;
};

function formatArDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

function moneyAr(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return `$${value}`;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(n);
}

type SaleRow = {
  id: string;
  created_at: string;
  total: string | number;
  payment_method: string;
  status: string;
  payment_details?: unknown;
};

type SalePromotionDetails = {
  name?: string;
  percent?: number;
  amount?: number;
  total_before?: number;
  total_after?: number;
};
type MembershipRow = {
  role?: string | null;
  permissions?: Record<string, unknown> | null;
};

type SaleItemRow = {
  id: string;
  name: string;
  quantity: string | number;
  unit_price: string | number;
  total: string | number;
};

export default async function SaleDetailPage({ params }: Props) {
  const { id } = await params;

  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;

  if (!businessId) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Venta</CardTitle>
            <CardDescription>Primero tenés que crear o seleccionar un negocio.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="text-sm underline" href="/app/setup">
              Ir a /app/setup
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id ?? null;
  const { data: saleData, error: saleError } = await supabase
    .from("sales")
    .select("id,created_at,total,payment_method,payment_details,status")
    .eq("business_id", businessId)
    .eq("id", id)
    .single();

  if (saleError || !saleData) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Venta</CardTitle>
            <CardDescription>No se encontró la venta.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="text-sm underline" href="/app/sales">
              Volver a ventas
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sale = saleData as SaleRow;
  const promotion =
    sale.payment_details && typeof sale.payment_details === "object"
      ? (((sale.payment_details as Record<string, unknown>).promotion as SalePromotionDetails | undefined) ?? null)
      : null;

  const { data: itemsData } = await supabase
    .from("sale_items")
    .select("id,name,quantity,unit_price,total")
    .eq("business_id", businessId)
    .eq("sale_id", id)
    .order("created_at", { ascending: true });

  const items = (itemsData ?? []) as SaleItemRow[];

  let canVoid = sale.status === "paid";
  if (userId) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("role,permissions")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .maybeSingle();
    const membershipRow = membership as MembershipRow | null;
    const role = membershipRow?.role ?? null;
    const perms = membershipRow?.permissions ?? {};
    canVoid = canVoid && (role === "owner" || perms.sales_void === true);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Venta #{sale.id.slice(0, 8)}</h1>
          <p className="text-sm text-muted-foreground">{formatArDateTime(sale.created_at)}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link className="text-sm underline" href="/app/sales">
            Volver
          </Link>
          <SalesRowActions saleId={sale.id} canVoid={canVoid} />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-base font-semibold tracking-tight">Productos</div>
            <div className="text-sm text-muted-foreground">{items.length} ítems</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="font-numeric text-lg font-semibold">{moneyAr(sale.total)}</div>
          </div>
        </div>

        {promotion && Number(promotion.amount ?? 0) > 0 ? (
          <div className="border-b bg-emerald-500/5 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  Promoción aplicada
                </div>
                <div className="text-sm text-muted-foreground">
                  {promotion.name ?? "Descuento"} {promotion.percent ? `(${Number(promotion.percent).toFixed(2)}%)` : ""}
                </div>
              </div>
              <div className="text-right text-sm">
                {promotion.total_before != null ? (
                  <div className="text-muted-foreground">Subtotal: {moneyAr(promotion.total_before)}</div>
                ) : null}
                <div className="font-medium text-emerald-700 dark:text-emerald-300">
                  Descuento: -{moneyAr(Number(promotion.amount ?? 0))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-[var(--pos-surface-2)] text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium">Producto</th>
                <th className="px-4 py-3 text-right font-medium">Cantidad</th>
                <th className="px-4 py-3 text-right font-medium">Precio</th>
                <th className="px-4 py-3 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    No hay ítems.
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{it.name}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-numeric text-muted-foreground">{it.quantity}</td>
                    <td className="px-4 py-3 text-right font-numeric text-muted-foreground">{moneyAr(it.unit_price)}</td>
                    <td className="px-4 py-3 text-right font-numeric font-semibold">{moneyAr(it.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
