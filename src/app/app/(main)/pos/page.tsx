import Link from "next/link";
import { cookies } from "next/headers";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BusinessPaymentMethodRow } from "@/lib/business-payment-methods";
import { normalizeBusinessType } from "@/lib/business-types";
import { isMissingOnboardingColumnError } from "@/lib/onboarding-column";
import { createClient } from "@/lib/supabase/server";

import { PosClient, type PosCustomerCredit, type PosProduct } from "@/app/app/(main)/pos/pos-client";
import { parseOnboardingGuideStep } from "@/app/app/(main)/onboarding/onboarding-guide-constants";

type PosProductRow = {
  id: string;
  name: string;
  category: string | null;
  size: string | null;
  color: string | null;
  image_url: string | null;
  price: number;
  barcode: string | null;
  scale_code: string | null;
  sold_by_weight: boolean;
  stock: number;
  stock_decimal: number;
};

type GastronomyConfig = {
  counterEnabled: boolean;
  deliveryEnabled: boolean;
  tablesEnabled: boolean;
};

type ServiceOrderRow = {
  id: string;
  type: "delivery" | "table";
  status: string;
  table_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  notes: string | null;
  created_at?: string | null;
  service_order_items: Array<{
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
  }> | null;
};

type PosBusinessRow = {
  name: string;
  business_type?: string | null;
  gastronomy_counter_enabled?: boolean | null;
  gastronomy_delivery_enabled?: boolean | null;
  gastronomy_tables_enabled?: boolean | null;
  address: string | null;
  phone: string | null;
  cuit: string | null;
  ticket_header: string | null;
  ticket_footer: string | null;
  onboarding_completed_at?: string | null;
};

function toNum(v: unknown) {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ ob?: string }>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;

  if (!businessId) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Punto de venta</CardTitle>
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
  const { data: businessData, error: businessError } = await supabase
    .from("businesses")
    .select("name,business_type,gastronomy_counter_enabled,gastronomy_delivery_enabled,gastronomy_tables_enabled,address,phone,cuit,ticket_header,ticket_footer,onboarding_completed_at")
    .eq("id", businessId)
    .single();

  const { data: tableRows } = await supabase
    .from("business_tables")
    .select("id,name,active")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("name", { ascending: true });

  const { data } = await supabase
    .from("products")
    .select("id,name,category,size,color,image_url,price,barcode,scale_code,sold_by_weight,stock,stock_decimal")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("name", { ascending: true })
    .limit(5000);

  const products = ((data ?? []) as PosProductRow[]).map(
    (p): PosProduct => ({
      id: String(p.id),
      name: String(p.name),
      category: p.category ? String(p.category) : null,
      size: p.size ? String(p.size) : null,
      color: p.color ? String(p.color) : null,
      image_url: p.image_url ? String(p.image_url) : null,
      price: Number(p.price) || 0,
      barcode: p.barcode ? String(p.barcode) : null,
      scale_code: p.scale_code ? String(p.scale_code) : null,
      sold_by_weight: Boolean(p.sold_by_weight),
      stock: Number(p.stock) || 0,
      stock_decimal: Number(p.stock_decimal) || 0,
    })
  );

  const business = businessData
    ? {
        name: String((businessData as PosBusinessRow).name ?? ""),
        address: (businessData as PosBusinessRow).address ?? null,
        phone: (businessData as PosBusinessRow).phone ?? null,
        cuit: (businessData as PosBusinessRow).cuit ?? null,
        ticket_header: (businessData as PosBusinessRow).ticket_header ?? null,
        ticket_footer: (businessData as PosBusinessRow).ticket_footer ?? null,
      }
    : null;

  const { data: openRegister } = await supabase
    .from("cash_registers")
    .select("id")
    .eq("business_id", businessId)
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .single();

  const cashOpen = !!openRegister;

  await supabase.rpc("ensure_business_payment_methods", { p_business_id: businessId });
  const { data: pmRows } = await supabase
    .from("business_payment_methods")
    .select("id,business_id,method_code,label,icon_key,icon_url,is_active,sort_order")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true });

  const paymentMethodConfig = (pmRows ?? []) as BusinessPaymentMethodRow[];

  const [{ data: customerRows }, { data: ccSales }, { data: capPayments }] = await Promise.all([
    supabase
      .from("business_customers")
      .select("id,name,credit_limit")
      .eq("business_id", businessId)
      .order("name", { ascending: true }),
    supabase
      .from("sales")
      .select("customer_id,total")
      .eq("business_id", businessId)
      .eq("payment_method", "cuenta_corriente")
      .eq("status", "paid")
      .not("customer_id", "is", null),
    supabase.from("customer_account_payments").select("customer_id,amount").eq("business_id", businessId),
  ]);

  const charges = new Map<string, number>();
  for (const s of ccSales ?? []) {
    const id = String((s as { customer_id: string | null }).customer_id ?? "");
    if (!id) continue;
    charges.set(id, (charges.get(id) ?? 0) + toNum((s as { total: unknown }).total));
  }
  const pays = new Map<string, number>();
  for (const p of capPayments ?? []) {
    const id = String((p as { customer_id: string }).customer_id ?? "");
    if (!id) continue;
    pays.set(id, (pays.get(id) ?? 0) + toNum((p as { amount: unknown }).amount));
  }

  const posCustomers: PosCustomerCredit[] = ((customerRows ?? []) as Record<string, unknown>[]).map((c) => {
    const id = String(c.id ?? "");
    const creditLimit = toNum(c.credit_limit);
    const balance = Math.round(((charges.get(id) ?? 0) - (pays.get(id) ?? 0) + Number.EPSILON) * 100) / 100;
    const available = Math.max(0, Math.round((creditLimit - balance + Number.EPSILON) * 100) / 100);
    return {
      id,
      name: String(c.name ?? ""),
      credit_limit: creditLimit,
      balance,
      available_to_spend: available,
    };
  });

  const { data: mpQrReady, error: mpRpcErr } = await supabase.rpc("business_mercadopago_qr_ready", {
    p_business_id: businessId,
  });
  const mercadoPagoQrReady = !mpRpcErr && mpQrReady === true;

  const onboardingIncomplete = isMissingOnboardingColumnError(businessError)
    ? false
    : !(businessData as PosBusinessRow | null)?.onboarding_completed_at;
  const guidePosStep = onboardingIncomplete && parseOnboardingGuideStep(sp.ob) === "pos";
  const gastronomyConfig: GastronomyConfig = {
    counterEnabled: (businessData as PosBusinessRow | null)?.gastronomy_counter_enabled ?? true,
    deliveryEnabled: (businessData as PosBusinessRow | null)?.gastronomy_delivery_enabled ?? false,
    tablesEnabled: (businessData as PosBusinessRow | null)?.gastronomy_tables_enabled ?? false,
  };

  return (
    <PosClient
      products={products}
      business={business}
      businessType={normalizeBusinessType((businessData as PosBusinessRow | null)?.business_type)}
      cashOpen={cashOpen}
      paymentMethodConfig={paymentMethodConfig}
      posCustomers={posCustomers}
      mercadoPagoQrReady={mercadoPagoQrReady}
      gastronomyConfig={gastronomyConfig}
      gastronomyTables={(tableRows ?? []) as Array<{ id: string; name: string; active: boolean }>}
      serviceOrders={((await supabase
        .from("service_orders")
        .select("id,type,status,table_id,customer_name,customer_phone,delivery_address,notes,created_at,service_order_items(product_id,name,quantity,unit_price)")
        .eq("business_id", businessId)
        .neq("status", "delivery_closed")
        .order("updated_at", { ascending: false })).data ?? []) as ServiceOrderRow[]}
      guidePosStep={guidePosStep}
    />
  );
}
