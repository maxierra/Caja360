import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { FacturacionClient } from "@/app/app/(main)/facturacion/facturacion-client";
import { getFiscalVouchers, getPendingConsolidationSummary } from "@/app/app/(main)/facturacion/actions";
import type { FiscalVoucher } from "@/features/billing/types";

export default async function FacturacionPage() {
  const businessId = (await cookies()).get("active_business_id")?.value;
  let fiscalActive = false;
  let vouchers: FiscalVoucher[] = [];
  let consolidation = { billingMode: null as "per_sale" | "consolidated" | null, pending: [], byPeriod: {} as Record<string, number> };

  if (businessId) {
    const supabase = await createClient();
    const { data: config } = await supabase
      .from("business_fiscal_config")
      .select("is_active")
      .eq("business_id", businessId)
      .maybeSingle();
    fiscalActive = Boolean(config?.is_active);
    vouchers = await getFiscalVouchers();
    try {
      consolidation = await getPendingConsolidationSummary();
    } catch {
      /* tablas fiscales aún no migradas */
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 border-b border-border/60 pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Facturación</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Comprobantes electrónicos emitidos vía ARCA (AFIP). CAE, vencimiento y notas de crédito.
        </p>
      </div>
      <FacturacionClient
        vouchers={vouchers}
        fiscalActive={fiscalActive}
        billingMode={consolidation.billingMode}
        pendingConsolidation={consolidation.pending}
        pendingByPeriod={consolidation.byPeriod}
      />
    </div>
  );
}
