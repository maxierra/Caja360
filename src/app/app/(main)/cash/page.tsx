import Link from "next/link";
import { cookies } from "next/headers";

import { CashPageClient } from "@/app/app/(main)/cash/cash-page-client";
import { CashFilter } from "@/app/app/(main)/cash/cash-filter";
import { parseOnboardingGuideStep } from "@/app/app/(main)/onboarding/onboarding-guide-constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatArgentinaDateTime, getArgentinaDayRangeUtcIso } from "@/lib/argentina-time";
import { isMissingOnboardingColumnError } from "@/lib/onboarding-column";
import { createClient } from "@/lib/supabase/server";
import { effectiveSalePaymentMethod } from "@/lib/sale-payment-method-display";

type CashRegisterRow = {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number | string;
  closing_amount: number | string | null;
  shift_start_at: string | null;
  shift_end_at: string | null;
  expected_totals?: unknown;
  closing_totals?: unknown;
  difference_totals?: unknown;
};

type SaleRow = {
  id: string;
  total: number | string;
  payment_method: string;
  payment_details?: unknown;
  status: string;
  created_at: string;
  cash_register_id?: string | null;
};

type CashMovementRow = {
  id: string;
  movement_type: "in" | "out";
  payment_method: "cash" | "card" | "transfer" | "mercadopago";
  amount: number | string;
  reason: string;
  notes: string | null;
  created_at: string;
  cash_register_id?: string | null;
};

type MethodTotals = {
  cash: number;
  card: number;
  transfer: number;
  mercadopago: number;
};

type CustomerPaymentRow = {
  id: string;
  amount: number | string;
  payment_method: string;
  created_at: string;
  notes: string | null;
  cash_register_id?: string | null;
};

function toNum(value: number | string | null | undefined) {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function expandSaleTotalsByMethod(sales: SaleRow[]) {
  const totals: MethodTotals = {
    cash: 0,
    card: 0,
    transfer: 0,
    mercadopago: 0,
  };
  for (const s of sales) {
    if (s.status !== "paid") continue;
    const total = toNum(s.total);
    if (s.payment_method === "mixed") {
      const details = s.payment_details as any;
      const split = Array.isArray(details?.split) ? details.split : [];
      for (const part of split) {
        const method = String(part?.method ?? "");
        const amount = toNum(part?.amount);
        if (method in totals) {
          (totals as any)[method] += amount;
        }
      }
      continue;
    }
    if (s.payment_method in totals) {
      (totals as any)[s.payment_method] += total;
    }
  }
  return totals;
}

function sumCuentaCorrienteSales(sales: SaleRow[]) {
  let t = 0;
  for (const s of sales) {
    if (s.status !== "paid") continue;
    if (s.payment_method === "cuenta_corriente") t += toNum(s.total);
  }
  return t;
}

function customerPaymentTotalsByMethod(rows: CustomerPaymentRow[]): MethodTotals {
  const totals: MethodTotals = {
    cash: 0,
    card: 0,
    transfer: 0,
    mercadopago: 0,
  };
  for (const r of rows) {
    const m = String(r.payment_method ?? "");
    if (m in totals) {
      (totals as Record<string, number>)[m] += toNum(r.amount);
    }
  }
  return totals;
}

function movementTotalsByMethod(movements: CashMovementRow[]) {
  const byMethod: MethodTotals = {
    cash: 0,
    card: 0,
    transfer: 0,
    mercadopago: 0,
  };
  for (const m of movements) {
    const amount = toNum(m.amount);
    const sign = m.movement_type === "in" ? 1 : -1;
    byMethod[m.payment_method] += sign * amount;
  }
  return byMethod;
}

function parseMethodTotals(raw: unknown): MethodTotals {
  const obj = (raw ?? {}) as Record<string, number | string | null | undefined>;
  return {
    cash: toNum(obj?.cash),
    card: toNum(obj?.card),
    transfer: toNum(obj?.transfer),
    mercadopago: toNum(obj?.mercadopago),
  };
}

function cashReceivedFromDetails(details: unknown) {
  if (!details || typeof details !== "object") return null;
  const val = (details as Record<string, unknown>)["cash_received"];
  const num = toNum(val as number | string | null | undefined);
  return num > 0 ? num : null;
}

function splitFromDetails(details: unknown) {
  if (!details || typeof details !== "object") return [];
  const raw = (details as Record<string, unknown>)["split"];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      const obj = x as Record<string, unknown>;
      return {
        method: String(obj?.method ?? ""),
        amount: toNum(obj?.amount as number | string | null | undefined),
      };
    })
    .filter((x) => x.method && x.amount > 0);
}

export default async function CashPage({ searchParams }: { searchParams: Promise<{ date?: string; ob?: string }> }) {
  const params = await searchParams;
  const filterDate = params.date;
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;

  if (!businessId) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Caja</CardTitle>
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

  const { data: openData } = await supabase
    .from("cash_registers")
    .select("id,opened_at,closed_at,opening_amount,closing_amount,shift_start_at,shift_end_at,expected_totals,closing_totals,difference_totals")
    .eq("business_id", businessId)
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const openRegister = (openData as CashRegisterRow | null) ?? null;

  const { startIso: dayStartIso, endInclusiveIso: dayEndIso } = getArgentinaDayRangeUtcIso(filterDate);

  let sales: SaleRow[] = [];
  let movements: CashMovementRow[] = [];
  let customerPayments: CustomerPaymentRow[] = [];

  // MODELO B: siempre mostramos la foto del día (o fecha filtrada),
  // independientemente de si hay caja abierta o no.
  const [{ data: salesData }, { data: movementsData }, { data: capData }] = await Promise.all([
    supabase
      .from("sales")
      .select("id,total,payment_method,payment_details,status,created_at,cash_register_id")
      .eq("business_id", businessId)
      .gte("created_at", dayStartIso)
      .lte("created_at", dayEndIso)
      .order("created_at", { ascending: false }),
    supabase
      .from("cash_movements")
      .select("id,movement_type,payment_method,amount,reason,notes,created_at,cash_register_id")
      .eq("business_id", businessId)
      .gte("created_at", dayStartIso)
      .lte("created_at", dayEndIso)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_account_payments")
      .select("id,amount,payment_method,created_at,notes,cash_register_id")
      .eq("business_id", businessId)
      .gte("created_at", dayStartIso)
      .lte("created_at", dayEndIso)
      .order("created_at", { ascending: false }),
  ]);
  sales = (salesData ?? []) as SaleRow[];
  movements = (movementsData ?? []) as CashMovementRow[];
  customerPayments = (capData ?? []) as CustomerPaymentRow[];

  const turnSales = openRegister
    ? sales.filter((s: any) => String((s as any).cash_register_id ?? "") === openRegister.id)
    : sales;
  const turnMovements = openRegister
    ? movements.filter((m: any) => String((m as any).cash_register_id ?? "") === openRegister.id)
    : movements;
  const turnCustomerPayments = openRegister
    ? customerPayments.filter((p: any) => String((p as any).cash_register_id ?? "") === openRegister.id)
    : customerPayments;

  const [{ data: businessData, error: businessError }, { data: turnsData }] = await Promise.all([
    supabase
      .from("businesses")
      .select("name,address,phone,cuit,ticket_header,ticket_footer,onboarding_completed_at")
      .eq("id", businessId)
      .single(),
    supabase
      .from("cash_registers")
      .select("id,opened_at,closed_at,opening_amount,closing_amount,expected_totals,closing_totals,difference_totals")
      .eq("business_id", businessId)
      .order("opened_at", { ascending: false })
      .limit(20),
  ]);

  const business = (businessData as any) ?? null;
  const onboardingIncomplete = isMissingOnboardingColumnError(businessError)
    ? false
    : !(businessData as { onboarding_completed_at?: string | null } | null)?.onboarding_completed_at;
  const guideCashStep = onboardingIncomplete && parseOnboardingGuideStep(params.ob) === "cash";
  const turns = (turnsData ?? []) as CashRegisterRow[];

  const soldByMethod = expandSaleTotalsByMethod(turnSales);
  const movementNetByMethod = movementTotalsByMethod(turnMovements);
  const cobrosCuentaByMethod = customerPaymentTotalsByMethod(turnCustomerPayments);
  const pendienteCuentaCorriente = sumCuentaCorrienteSales(turnSales);
  const openingAmount = toNum(openRegister?.opening_amount);
  const soldTotal = soldByMethod.cash + soldByMethod.card + soldByMethod.transfer + soldByMethod.mercadopago;

  const totalIn = movements
    .filter((m) => m.movement_type === "in")
    .reduce((acc, m) => acc + toNum(m.amount), 0);
  const totalOut = movements
    .filter((m) => m.movement_type === "out")
    .reduce((acc, m) => acc + toNum(m.amount), 0);

  const expectedCash = openingAmount + soldByMethod.cash + movementNetByMethod.cash + cobrosCuentaByMethod.cash;
  const expectedByMethod: MethodTotals = {
    cash: expectedCash,
    card: soldByMethod.card + movementNetByMethod.card + cobrosCuentaByMethod.card,
    transfer: soldByMethod.transfer + movementNetByMethod.transfer + cobrosCuentaByMethod.transfer,
    mercadopago: soldByMethod.mercadopago + movementNetByMethod.mercadopago + cobrosCuentaByMethod.mercadopago,
  };
  const registerTitle = openRegister ? "Caja abierta" : "Caja cerrada";
  const registerDescription = openRegister
    ? `Abierta el ${formatArgentinaDateTime(openRegister.opened_at)}`
    : "No hay una caja abierta. Podés abrir una nueva para comenzar a operar.";

  // Fetch items for the sales in ledgerRows to show in tickets
  const saleIds = sales.map(s => s.id);
  const { data: allItemsData } = saleIds.length 
    ? await supabase.from("sale_items").select("sale_id,name,quantity,unit_price").in("sale_id", saleIds)
    : { data: [] };
  const itemsBySale = new Map<string, any[]>();
  (allItemsData ?? []).forEach((it: any) => {
    if (!itemsBySale.has(it.sale_id)) itemsBySale.set(it.sale_id, []);
    itemsBySale.get(it.sale_id)?.push(it);
  });

  const ledgerRows = [
    ...(openRegister
      ? [
          {
            id: `${openRegister.id}-opening`,
            created_at: openRegister.opened_at,
            kind: "opening" as const,
            movement_type: "in" as const,
            method: "cash",
            amount: toNum(openRegister.opening_amount),
            reason: "Apertura de caja",
            notes: "",
            items: [],
          },
        ]
      : []),
    ...(sales
      .filter((s) => s.status === "paid" && s.payment_method !== "cuenta_corriente")
      .flatMap((s) => {
        const total = toNum(s.total);
        const saleIdShort = s.id.slice(0, 8);
        const cashReceived = cashReceivedFromDetails(s.payment_details);
        const sItems = itemsBySale.get(s.id) || [];

        if (s.payment_method === "cash" && cashReceived && cashReceived > total) {
          const change = Math.max(0, cashReceived - total);
          return [
            {
              id: `${s.id}-cash-in`,
              sale_id: s.id,
              created_at: s.created_at,
              kind: "sale" as const,
              movement_type: "in" as const,
              method: "cash",
              amount: cashReceived,
              reason: `Venta #${saleIdShort} · Cobrado`,
              items: sItems,
              cashReceived: cashReceived ?? undefined,
            },
            {
              id: `${s.id}-cash-change`,
              sale_id: s.id,
              created_at: s.created_at,
              kind: "sale" as const,
              movement_type: "out" as const,
              method: "cash",
              amount: change,
              reason: `Venta #${saleIdShort} · Vuelto`,
              items: sItems,
              cashReceived: cashReceived ?? undefined,
            },
          ] as any[];
        }

        return [
          {
            id: s.id,
            sale_id: s.id,
            created_at: s.created_at,
            kind: "sale" as const,
            movement_type: "in" as const,
            method: effectiveSalePaymentMethod(s.payment_method, s.payment_details),
            amount: total,
            reason: `Venta #${saleIdShort}`,
            items: sItems,
            cashReceived: cashReceived ?? undefined,
          },
        ] as any[];
      })),
    ...(sales
      .filter((s) => s.status === "paid" && s.payment_method === "cuenta_corriente")
      .map((s) => {
        const total = toNum(s.total);
        const saleIdShort = s.id.slice(0, 8);
        const sItems = itemsBySale.get(s.id) || [];
        return {
          id: `${s.id}-cc`,
          sale_id: s.id,
          created_at: s.created_at,
          kind: "cc_sale" as const,
          movement_type: "neutral" as const,
          method: "cuenta_corriente",
          amount: total,
          reason: `Venta #${saleIdShort} · Sin ingreso (cuenta corriente)`,
          notes: "",
          items: sItems,
        };
      })),
    ...customerPayments.map((p) => ({
      id: p.id,
      created_at: p.created_at,
      kind: "cc_payment" as const,
      movement_type: "in" as const,
      method: String(p.payment_method),
      amount: toNum(p.amount),
      reason: "Cobro de deuda (cuenta corriente)",
      notes: p.notes || "",
      items: [] as any[],
    })),
    ...sales
      .filter((s) => s.status === "voided")
      .flatMap((s) => {
        const saleIdShort = s.id.slice(0, 8);
        const sItems = itemsBySale.get(s.id) || [];
        if (s.payment_method === "mixed") {
          const split = splitFromDetails(s.payment_details);
          if (split.length > 0) {
            return split.map((part, idx) => ({
              id: `${s.id}-void-${idx}`,
              sale_id: s.id,
              created_at: s.created_at,
              kind: "void" as const,
              movement_type: "out" as const,
              method: part.method,
              amount: part.amount,
              reason: `Venta #${saleIdShort} eliminada`,
              items: sItems,
            }));
          }
        }
        return [
          {
            id: `${s.id}-void`,
            sale_id: s.id,
            created_at: s.created_at,
            kind: "void" as const,
            movement_type: "out" as const,
            method: effectiveSalePaymentMethod(s.payment_method, s.payment_details),
            amount: toNum(s.total),
            reason: `Venta #${saleIdShort} eliminada`,
            items: sItems,
          },
        ];
      }),
    ...movements.map((m) => ({
      id: m.id,
      created_at: m.created_at,
      kind: "manual" as const,
      movement_type: m.movement_type,
      method: m.payment_method,
      amount: toNum(m.amount),
      reason: m.reason,
      notes: m.notes || "",
      items: [],
    })),
  ].sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1));

  const turnIds = turns.map((t) => t.id);
  const [{ data: turnSalesData }, { data: turnMovementsData }, { data: turnCapData }] = turnIds.length
    ? await Promise.all([
        supabase
          .from("sales")
          .select("cash_register_id,total,payment_method,payment_details,status")
          .eq("business_id", businessId)
          .in("cash_register_id", turnIds),
        supabase
          .from("cash_movements")
          .select("cash_register_id,movement_type,payment_method,amount")
          .eq("business_id", businessId)
          .in("cash_register_id", turnIds),
        supabase
          .from("customer_account_payments")
          .select("cash_register_id,amount,payment_method")
          .eq("business_id", businessId)
          .in("cash_register_id", turnIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const historyMap = new Map<
    string,
    {
      soldByMethod: MethodTotals;
      movementByMethod: MethodTotals;
    }
  >();
  for (const t of turns) {
    historyMap.set(t.id, {
      soldByMethod: { cash: 0, card: 0, transfer: 0, mercadopago: 0 },
      movementByMethod: { cash: 0, card: 0, transfer: 0, mercadopago: 0 },
    });
  }

  for (const s of (turnSalesData ?? []) as Array<any>) {
    const turn = historyMap.get(String(s.cash_register_id ?? ""));
    if (!turn) continue;
    if (s.status !== "paid") continue;
    const single: SaleRow = {
      id: "",
      total: s.total,
      payment_method: String(s.payment_method ?? ""),
      payment_details: s.payment_details,
      status: "paid",
      created_at: "",
    };
    const partTotals = expandSaleTotalsByMethod([single]);
    turn.soldByMethod.cash += partTotals.cash;
    turn.soldByMethod.card += partTotals.card;
    turn.soldByMethod.transfer += partTotals.transfer;
    turn.soldByMethod.mercadopago += partTotals.mercadopago;
  }

  for (const p of (turnCapData ?? []) as Array<any>) {
    const turn = historyMap.get(String(p.cash_register_id ?? ""));
    if (!turn) continue;
    const m = String(p.payment_method ?? "") as keyof MethodTotals;
    if (m in turn.soldByMethod) {
      turn.soldByMethod[m] += toNum(p.amount);
    }
  }

  for (const m of (turnMovementsData ?? []) as Array<any>) {
    const turn = historyMap.get(String(m.cash_register_id ?? ""));
    if (!turn) continue;
    const method = String(m.payment_method ?? "") as keyof MethodTotals;
    if (!(method in turn.movementByMethod)) continue;
    const amount = toNum(m.amount);
    const sign = String(m.movement_type ?? "") === "in" ? 1 : -1;
    turn.movementByMethod[method] += sign * amount;
  }

  const historyTurns = turns.map((t) => {
    const metrics = historyMap.get(t.id) ?? {
      soldByMethod: { cash: 0, card: 0, transfer: 0, mercadopago: 0 },
      movementByMethod: { cash: 0, card: 0, transfer: 0, mercadopago: 0 },
    };
    const expected = parseMethodTotals(t.expected_totals);
    const closing = parseMethodTotals(t.closing_totals);
    const difference = parseMethodTotals(t.difference_totals);
    const soldTotalTurn =
      metrics.soldByMethod.cash +
      metrics.soldByMethod.card +
      metrics.soldByMethod.transfer +
      metrics.soldByMethod.mercadopago;
    return {
      id: t.id,
      opened_at: t.opened_at,
      closed_at: t.closed_at,
      opening_amount: toNum(t.opening_amount),
      closing_amount: toNum(t.closing_amount),
      sold_total: soldTotalTurn,
      expected_totals: expected,
      closing_totals: closing,
      difference_totals: difference,
    };
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Caja diaria</h1>
          <p className="text-sm text-muted-foreground">Control de flujo, arqueo y liquidación de turnos.</p>
        </div>
        <CashFilter ledgerRows={ledgerRows} turns={historyTurns} />
      </div>

      <CashPageClient
      openRegister={
        openRegister
          ? {
              id: openRegister.id,
              opened_at: openRegister.opened_at,
              shift_start_at: openRegister.shift_start_at,
              shift_end_at: openRegister.shift_end_at,
            }
          : null
      }
      soldByMethod={soldByMethod}
      movementNetByMethod={movementNetByMethod}
      soldTotal={soldTotal}
      totalIn={totalIn}
      totalOut={totalOut}
      expectedCash={expectedCash}
      registerTitle={registerTitle}
      registerDescription={registerDescription}
      openingAmount={openingAmount}
      expectedByMethod={expectedByMethod}
      cobrosCuentaByMethod={cobrosCuentaByMethod}
      pendienteCuentaCorriente={pendienteCuentaCorriente}
      ledgerRows={ledgerRows as any}
      historyTurns={historyTurns}
      business={business}
      guideCashStep={guideCashStep}
    />
    </div>
  );
}
