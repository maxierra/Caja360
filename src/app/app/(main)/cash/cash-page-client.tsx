"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Landmark,
  NotebookPen,
  Plus,
  Wallet,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { closeCashRegisterAction, createCashMovementAction, openCashRegisterAction } from "@/app/app/(main)/cash/actions";
import { ONBOARDING_GUIDE_QUERY, ONBOARDING_GUIDE_TOTAL_STEPS } from "@/app/app/(main)/onboarding/onboarding-guide-constants";
import { OnboardingSpotlight } from "@/app/app/(main)/onboarding/onboarding-spotlight";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatArgentinaDateTime } from "@/lib/argentina-time";
import { cn } from "@/lib/utils";
import { generateTicketHtml, getPaymentMethodLabel, printTicket, type PosBusinessInfo, type TicketData, type TicketItem } from "@/lib/ticket-utils";
import { Eye, Printer } from "lucide-react";

type OpenRegister = {
  id: string;
  opened_at: string;
  shift_start_at: string | null;
  shift_end_at: string | null;
} | null;

type MethodTotals = {
  cash: number;
  card: number;
  transfer: number;
  mercadopago: number;
};

type LedgerRow = {
  id: string;
  created_at: string;
  sale_id?: string;
  kind: "sale" | "manual" | "void" | "opening" | "cc_sale" | "cc_payment";
  movement_type: "in" | "out" | "neutral";
  method: string;
  amount: number;
  reason: string;
  notes?: string;
  items?: TicketItem[];
  cashReceived?: number;
};

type Props = {
  openRegister: OpenRegister;
  soldByMethod: MethodTotals;
  movementNetByMethod: MethodTotals;
  soldTotal: number;
  totalIn: number;
  totalOut: number;
  expectedCash: number;
  registerTitle: string;
  registerDescription: string;
  openingAmount: number;
  expectedByMethod: MethodTotals;
  /** Cobros de deuda de cuenta corriente registrados en el período, por medio (sí ingresan al cierre). */
  cobrosCuentaByMethod: MethodTotals;
  /** Ventas en cuenta corriente del turno (sin ingreso físico en ese concepto). */
  pendienteCuentaCorriente: number;
  ledgerRows: LedgerRow[];
  historyTurns: Array<{
    id: string;
    opened_at: string;
    closed_at: string | null;
    opening_amount: number;
    closing_amount: number;
    sold_total: number;
    expected_totals: MethodTotals;
    closing_totals: MethodTotals;
    difference_totals: MethodTotals;
  }>;
  business: PosBusinessInfo;
  /** Recorrido inicial: foco en «Abrir caja» y salto al POS al confirmar apertura. */
  guideCashStep?: boolean;
};

function moneyAr(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

function methodLabel(method: string) {
  if (method === "cash") return "Efectivo";
  if (method === "card") return "Tarjeta";
  if (method === "transfer") return "Transferencia";
  if (method === "mercadopago") return "Mercado Pago";
  if (method === "cuenta_corriente") return "Cuenta corriente";
  return method;
}

function methodIcon(method: string) {
  if (method === "cash") return <Banknote className="size-3.5" />;
  if (method === "card") return <CreditCard className="size-3.5" />;
  if (method === "mercadopago") return <Wallet className="size-3.5" />;
  if (method === "cuenta_corriente") return <NotebookPen className="size-3.5" />;
  return <Landmark className="size-3.5" />;
}

function methodCardTone(method: keyof MethodTotals) {
  if (method === "cash") {
    return {
      wrap: "border-emerald-500/30 bg-emerald-500/10",
      title: "text-emerald-700 dark:text-emerald-300",
      badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    };
  }
  if (method === "card") {
    return {
      wrap: "border-[var(--pos-amber)]/30 bg-[var(--pos-amber)]/10",
      title: "text-[color-mix(in_oklab,var(--pos-amber)_40%,black)] dark:text-[var(--pos-amber)]",
      badge: "bg-[var(--pos-amber)]/15 text-[color-mix(in_oklab,var(--pos-amber)_35%,black)] dark:text-[var(--pos-amber)]",
    };
  }
  if (method === "transfer") {
    return {
      wrap: "border-violet-500/30 bg-violet-500/10",
      title: "text-violet-700 dark:text-violet-300",
      badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    };
  }
  return {
    wrap: "border-sky-500/30 bg-sky-500/10",
    title: "text-sky-700 dark:text-sky-300",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  };
}

function methodShortLabel(method: keyof MethodTotals) {
  if (method === "mercadopago") return "M. Pago";
  if (method === "transfer") return "Transfer.";
  if (method === "card") return "Tarjeta";
  return "Efectivo";
}

function clampNonNegative(n: number) {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n;
}

function DonutChart({
  values,
  centerTop,
  centerBottom,
  size = 168,
  stroke = 16,
}: {
  values: Array<{ label: string; value: number; color: string }>;
  centerTop: string;
  centerBottom: string;
  size?: number;
  stroke?: number;
}) {
  const total = values.reduce((acc, v) => acc + clampNonNegative(v.value), 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  let offset = 0;
  const segments = values
    .map((v) => ({ ...v, value: clampNonNegative(v.value) }))
    .filter((v) => v.value > 0);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <defs>
        <filter id="donutShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="rgba(0,0,0,0.35)" />
        </filter>
        {segments.map((v) => (
          <linearGradient key={v.label} id={`grad-${v.label.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={v.color} stopOpacity="0.95" />
            <stop offset="55%" stopColor={v.color} stopOpacity="0.75" />
            <stop offset="100%" stopColor={v.color} stopOpacity="1" />
          </linearGradient>
        ))}
      </defs>

      <g filter="url(#donutShadow)" transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="transparent"
          stroke="rgba(148,163,184,0.25)"
          strokeWidth={stroke}
        />

        {total <= 0
          ? null
          : segments.map((v) => {
              const dash = (v.value / total) * c;
              const labelId = v.label.replace(/\s+/g, "-");
              const el = (
                <g key={v.label}>
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="transparent"
                    stroke={v.color}
                    strokeOpacity={0.25}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${c - dash}`}
                    strokeDashoffset={-offset}
                    transform="translate(0 4)"
                  />
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="transparent"
                    stroke={`url(#grad-${labelId})`}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${c - dash}`}
                    strokeDashoffset={-offset}
                  />
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth={Math.max(2, Math.round(stroke * 0.18))}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${c - dash}`}
                    strokeDashoffset={-offset}
                    transform={`translate(0 ${Math.max(1, Math.round(stroke * -0.18))})`}
                  />
                </g>
              );
              offset += dash;
              return el;
            })}
      </g>

      <circle
        cx={size / 2}
        cy={size / 2}
        r={Math.max(8, r - stroke / 2 - 4)}
        fill="var(--pos-surface)"
        opacity={0.95}
      />
      <text x="50%" y="48%" textAnchor="middle" className="fill-foreground text-[10px] font-medium">
        {centerTop}
      </text>
      <text x="50%" y="62%" textAnchor="middle" className="fill-foreground text-[13px] font-semibold">
        {centerBottom}
      </text>
    </svg>
  );
}

export function CashPageClient({
  openRegister,
  soldByMethod,
  movementNetByMethod,
  soldTotal,
  totalIn,
  totalOut,
  expectedCash,
  registerTitle,
  registerDescription,
  openingAmount,
  expectedByMethod,
  cobrosCuentaByMethod,
  pendienteCuentaCorriente,
  ledgerRows,
  historyTurns,
  business,
  guideCashStep = false,
}: Props) {
  const router = useRouter();
  const openCashHighlightRef = React.useRef<HTMLSpanElement>(null);
  const handledCashOpenSuccessRef = React.useRef(false);
  const [openCashModal, setOpenCashModal] = React.useState(false);
  const [movementModal, setMovementModal] = React.useState(false);
  const [movementSavedModal, setMovementSavedModal] = React.useState(false);
  const [movementPending, startMovementTransition] = React.useTransition();
  const [closeModal, setCloseModal] = React.useState(false);
  const [historyModal, setHistoryModal] = React.useState(false);
  const [historyDetailTurn, setHistoryDetailTurn] = React.useState<Props["historyTurns"][number] | null>(null);
  
  const [openCashState, openCashFormAction] = React.useActionState(openCashRegisterAction, {
    success: false,
    error: null as string | null,
  });
  const [countedCash, setCountedCash] = React.useState(String(expectedByMethod.cash || 0));
  const [countedCard, setCountedCard] = React.useState(String(expectedByMethod.card || 0));
  const [countedTransfer, setCountedTransfer] = React.useState(String(expectedByMethod.transfer || 0));
  const [countedMercadoPago, setCountedMercadoPago] = React.useState(String(expectedByMethod.mercadopago || 0));

  const [ticketPreview, setTicketPreview] = React.useState<TicketData | null>(null);

  React.useEffect(() => {
    setCountedCash(String(expectedByMethod.cash || 0));
    setCountedCard(String(expectedByMethod.card || 0));
    setCountedTransfer(String(expectedByMethod.transfer || 0));
    setCountedMercadoPago(String(expectedByMethod.mercadopago || 0));
  }, [expectedByMethod.cash, expectedByMethod.card, expectedByMethod.transfer, expectedByMethod.mercadopago, closeModal]);

  // Tras abrir caja: ir al POS si viene del recorrido inicial; si no, refrescar vista actual.
  React.useEffect(() => {
    if (!openCashState?.success) {
      handledCashOpenSuccessRef.current = false;
      return;
    }
    if (handledCashOpenSuccessRef.current) return;
    handledCashOpenSuccessRef.current = true;
    setOpenCashModal(false);
    if (guideCashStep) {
      router.push(`/app/pos?${ONBOARDING_GUIDE_QUERY}=pos`);
      return;
    }
    router.refresh();
  }, [openCashState?.success, guideCashStep, router]);

  const showCashSpotlight = guideCashStep && !openRegister && !openCashModal;

  React.useEffect(() => {
    if (!showCashSpotlight) return;
    const id = window.requestAnimationFrame(() => {
      const wrap = openCashHighlightRef.current;
      wrap?.scrollIntoView({ block: "center", behavior: "smooth" });
      wrap?.querySelector("button")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [showCashSpotlight]);

  const counted = {
    cash: Number(countedCash || 0),
    card: Number(countedCard || 0),
    transfer: Number(countedTransfer || 0),
    mercadopago: Number(countedMercadoPago || 0),
  };
  const differences = {
    cash: counted.cash - expectedByMethod.cash,
    card: counted.card - expectedByMethod.card,
    transfer: counted.transfer - expectedByMethod.transfer,
    mercadopago: counted.mercadopago - expectedByMethod.mercadopago,
  };
  const hasDifference =
    Math.abs(differences.cash) > 0.009 ||
    Math.abs(differences.card) > 0.009 ||
    Math.abs(differences.transfer) > 0.009 ||
    Math.abs(differences.mercadopago) > 0.009;

  const cobrosTotal =
    cobrosCuentaByMethod.cash +
    cobrosCuentaByMethod.card +
    cobrosCuentaByMethod.transfer +
    cobrosCuentaByMethod.mercadopago;

  function netInChannel(m: keyof MethodTotals) {
    return soldByMethod[m] + movementNetByMethod[m] + cobrosCuentaByMethod[m];
  }

  const totalNetDistribucion =
    netInChannel("cash") +
    netInChannel("card") +
    netInChannel("transfer") +
    netInChannel("mercadopago");

   return (
    <div className="w-full">
      <OnboardingSpotlight
        active={showCashSpotlight}
        targetRef={openCashHighlightRef}
        dimBackground={false}
        stepIndex={3}
        totalSteps={ONBOARDING_GUIDE_TOTAL_STEPS}
        title="Abrir la caja"
        description='Tocá «Abrir caja», dejá el saldo inicial en 0 si querés, y confirmá. Después pasamos al punto de venta.'
      />

      <div className="flex items-center justify-end gap-3 mb-6">

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setHistoryModal(true)}>
            <Clock3 className="size-4" />
            Ver turnos
          </Button>
          {!openRegister ? (
            <span
              ref={openCashHighlightRef}
              className={cn(
                "inline-flex rounded-xl",
                showCashSpotlight &&
                  "relative z-[82] shadow-[0_0_0_4px_rgba(16,185,129,0.55),0_8px_40px_-8px_rgba(16,185,129,0.35)]"
              )}
            >
              <Button
                type="button"
                onClick={() => setOpenCashModal(true)}
                className={cn(
                  showCashSpotlight &&
                    "animate-onboarding-product-pulse relative min-h-12 min-w-[min(100vw-2rem,240px)] rounded-2xl border-2 border-white/90 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-7 text-base font-bold text-white hover:brightness-110 hover:saturate-110 md:min-w-[220px]"
                )}
              >
                <Wallet className={cn("size-4", showCashSpotlight && "size-5")} />
                Abrir caja
              </Button>
            </span>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setMovementModal(true)}>
                <Plus className="size-4" />
                Movimiento manual
              </Button>
              <Button type="button" className="bg-rose-600 text-white hover:bg-rose-700" onClick={() => setCloseModal(true)}>
                Cerrar caja
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="relative overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent shadow-[0_0_20px_-5px_rgba(16,185,129,0.1)] transition-all hover:shadow-[0_0_25px_-5px_rgba(16,185,129,0.15)]">
          <div className="absolute top-0 right-0 h-16 w-16 -translate-y-1/2 translate-x-1/2 rounded-full bg-emerald-500/10 blur-2xl" />
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-700/80 dark:text-emerald-400 font-medium tracking-wide uppercase text-[10px]">
              Ventas cobradas
            </CardDescription>
            <CardTitle className="text-emerald-700 dark:text-emerald-300 text-2xl font-bold tracking-tight">{moneyAr(soldTotal)}</CardTitle>
            <p className="pt-1 text-[10px] leading-tight text-muted-foreground">POS: efectivo, tarjeta, etc. (sin ventas solo en CC)</p>
          </CardHeader>
        </Card>
        <Card className="relative overflow-hidden border-violet-500/30 bg-gradient-to-br from-violet-500/15 via-violet-500/5 to-transparent shadow-[0_0_20px_-5px_rgba(139,92,246,0.12)] transition-all hover:shadow-[0_0_25px_-5px_rgba(139,92,246,0.18)]">
          <div className="absolute top-0 right-0 h-16 w-16 -translate-y-1/2 translate-x-1/2 rounded-full bg-violet-500/10 blur-2xl" />
          <CardHeader className="pb-2">
            <CardDescription className="text-violet-700/80 dark:text-violet-400 font-medium tracking-wide uppercase text-[10px]">
              Cobros de deuda (CC)
            </CardDescription>
            <CardTitle className="text-violet-700 dark:text-violet-300 text-2xl font-bold tracking-tight">{moneyAr(cobrosTotal)}</CardTitle>
            <p className="pt-1 text-[10px] leading-tight text-muted-foreground">Dinero que entró al cobrar deudas; suma al medio elegido</p>
          </CardHeader>
        </Card>
        <Card className="relative overflow-hidden border-sky-500/30 bg-gradient-to-br from-sky-500/15 via-sky-500/5 to-transparent shadow-[0_0_20px_-5px_rgba(14,165,233,0.1)] transition-all hover:shadow-[0_0_25px_-5px_rgba(14,165,233,0.15)]">
          <div className="absolute top-0 right-0 h-16 w-16 -translate-y-1/2 translate-x-1/2 rounded-full bg-sky-500/10 blur-2xl" />
          <CardHeader className="pb-2">
            <CardDescription className="text-sky-700/80 dark:text-sky-400 font-medium tracking-wide uppercase text-[10px]">Entradas manuales</CardDescription>
            <CardTitle className="text-sky-700 dark:text-sky-300 text-2xl font-bold tracking-tight">{moneyAr(totalIn)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="relative overflow-hidden border-rose-500/30 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent shadow-[0_0_20px_-5px_rgba(244,63,94,0.1)] transition-all hover:shadow-[0_0_25px_-5px_rgba(244,63,94,0.15)]">
          <div className="absolute top-0 right-0 h-16 w-16 -translate-y-1/2 translate-x-1/2 rounded-full bg-rose-500/10 blur-2xl" />
          <CardHeader className="pb-2">
            <CardDescription className="text-rose-700/80 dark:text-rose-400 font-medium tracking-wide uppercase text-[10px]">Salidas manuales</CardDescription>
            <CardTitle className="text-rose-700 dark:text-rose-300 text-2xl font-bold tracking-tight">{moneyAr(totalOut)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="relative overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent shadow-[0_0_20px_-5px_rgba(245,158,11,0.1)] transition-all hover:shadow-[0_0_25px_-5px_rgba(245,158,11,0.15)]">
          <div className="absolute top-0 right-0 h-16 w-16 -translate-y-1/2 translate-x-1/2 rounded-full bg-amber-500/10 blur-2xl" />
          <CardHeader className="pb-2">
            <CardDescription className="text-amber-700/80 dark:text-amber-400 font-medium tracking-wide uppercase text-[10px]">Efectivo esperado en caja</CardDescription>
            <CardTitle className="text-amber-700 dark:text-amber-300 text-2xl font-bold tracking-tight">{moneyAr(expectedCash)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {pendienteCuentaCorriente > 0.01 ? (
        <div className="mt-4 rounded-xl border border-slate-500/30 bg-slate-500/5 px-4 py-3 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Pendiente de cobro (ventas en cuenta corriente en este período):{" "}
          </span>
          <span className="tabular-nums font-semibold">{moneyAr(pendienteCuentaCorriente)}</span>
          <span className="text-muted-foreground">
            {" "}
            — no ingresa como efectivo hasta que el cliente pague; los cobros de deuda sí suman al medio elegido.
          </span>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background/50 to-background/80 backdrop-blur-sm">
          <div className="absolute top-0 right-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
          <CardHeader className="border-b bg-primary/5 backdrop-blur-md">
            <CardTitle className="text-xl font-bold">{registerTitle}</CardTitle>
            <CardDescription className="text-muted-foreground/80 font-medium">{registerDescription}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {!openRegister ? (
              <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
                No hay caja abierta. Usá el botón <span className="font-medium">Abrir caja</span> para iniciar el turno.
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-primary/20 bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">Apertura</div>
                    <div className="font-medium">{formatArgentinaDateTime(openRegister.opened_at)}</div>
                    <div className="mt-1 text-sm text-muted-foreground">Monto inicial: {moneyAr(openingAmount)}</div>
                    {openRegister.shift_start_at || openRegister.shift_end_at ? (
                      <div className="mt-1 text-sm text-muted-foreground">
                        Horario: {openRegister.shift_start_at ?? "--:--"} a {openRegister.shift_end_at ?? "--:--"}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-inner">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Distribución por medio</div>
                        <div className="mt-1 text-xs text-muted-foreground">Ventas + movimientos + cobros de deuda CC</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-muted-foreground">Total neto</div>
                        <div className="text-sm font-semibold text-foreground">{moneyAr(totalNetDistribucion)}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                      <DonutChart
                        centerTop="Total neto"
                        centerBottom={moneyAr(totalNetDistribucion)}
                        values={([
                          { label: "Efectivo", value: netInChannel("cash"), color: "rgb(16,185,129)" },
                          { label: "Tarjeta", value: netInChannel("card"), color: "rgb(245,158,11)" },
                          { label: "Transfer.", value: netInChannel("transfer"), color: "rgb(139,92,246)" },
                          { label: "M. Pago", value: netInChannel("mercadopago"), color: "rgb(14,165,233)" },
                        ] as const).map((v) => v)}
                      />

                      <div className="grid w-full gap-1.5 text-xs">
                        {([
                          { key: "cash", label: "Efectivo", tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" },
                          { key: "card", label: "Tarjeta", tone: "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-200" },
                          { key: "transfer", label: "Transferencia", tone: "border-violet-500/20 bg-violet-500/10 text-violet-800 dark:text-violet-200" },
                          { key: "mercadopago", label: "Mercado Pago", tone: "border-sky-500/20 bg-sky-500/10 text-sky-800 dark:text-sky-200" },
                        ] as const).map((it) => {
                          const key = it.key as keyof MethodTotals;
                          const net = netInChannel(key);
                          return (
                            <div key={it.key} className={"flex items-center justify-between rounded-md border px-2 py-1.5 " + it.tone}>
                              <span className="font-medium">{it.label}</span>
                              <span className="font-bold">{moneyAr(net)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                  <div className="mb-2 text-sm font-medium">Validación de cierre</div>
                  <div className="text-sm text-muted-foreground">
                    Ahora el cierre valida todos los medios de pago. Usá el botón <span className="font-medium">Cerrar caja</span> para comparar esperado vs contado.
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background/50 to-background/80 backdrop-blur-sm">
          <div className="absolute top-0 right-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
          <CardHeader className="border-b bg-primary/5 backdrop-blur-md">
            <CardTitle className="text-xl font-bold">Resultado por medio</CardTitle>
            <CardDescription className="text-muted-foreground/80 font-medium">
              Ventas + movimientos manuales + cobros de deuda CC
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 pt-6 text-sm">
            {(["cash", "card", "transfer", "mercadopago"] as const).map((m) => {
              const sold = soldByMethod[m];
              const mov = movementNetByMethod[m];
              const cobro = cobrosCuentaByMethod[m];
              const net = sold + mov + cobro;
              return (
                <div key={m} className="group relative overflow-hidden rounded-xl border border-primary/20 bg-background/40 p-3 transition-all hover:bg-background/60 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2">
                      <div className={"rounded-lg p-2 " + methodCardTone(m).badge}>
                        {methodIcon(m)}
                      </div>
                      <span className="font-medium">{methodLabel(m)}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold tracking-tight">{moneyAr(net)}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    <span>Venta: {moneyAr(sold)}</span>
                    <span className="text-muted-foreground/40">•</span>
                    <span>Mov: {moneyAr(mov)}</span>
                    <span className="text-muted-foreground/40">•</span>
                    <span title="Cobros de cuenta corriente por este medio">Cobro CC: {moneyAr(cobro)}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-primary/20 bg-background/40 backdrop-blur-md">
        <div className="border-b bg-primary/10 px-6 py-5 flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-primary rounded-r-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
          <div className="pl-2">
            <div className="text-base font-semibold tracking-tight">Libro de caja</div>
            <div className="text-sm text-muted-foreground">Entradas y salidas por método de pago</div>
          </div>
          {openRegister && (
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="h-9 gap-2 border-[var(--pos-accent)]/50 hover:bg-[var(--pos-accent)]/10 text-xs sm:text-sm font-medium" 
              onClick={() => setMovementModal(true)}
            >
              <Plus className="size-4" />
              Nuevo movimiento
            </Button>
          )}
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-[var(--pos-surface-2)]/60 text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-left font-medium">Origen</th>
                <th className="px-4 py-3 text-left font-medium">Medio</th>
                <th className="px-4 py-3 text-left font-medium">Motivo</th>
                <th className="px-4 py-3 text-right font-medium">Monto</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ledgerRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Sin movimientos para mostrar.
                  </td>
                </tr>
              ) : (
                ledgerRows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="border-b last:border-b-0 hover:bg-primary/5 group">
                    <td className="px-4 py-3 text-muted-foreground">{formatArgentinaDateTime(row.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {row.kind === "cc_sale" ? (
                          <>
                            <Clock3 className="size-4 text-slate-400" />
                            Pendiente
                          </>
                        ) : row.movement_type === "in" ? (
                          <>
                            <ArrowDownCircle className="size-4 text-emerald-400" />
                            Entrada
                          </>
                        ) : (
                          <>
                            <ArrowUpCircle className="size-4 text-rose-400" />
                            Salida
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.kind === "sale"
                        ? "Venta"
                        : row.kind === "void"
                          ? "Venta eliminada"
                          : row.kind === "opening"
                            ? "Apertura"
                            : row.kind === "cc_sale"
                              ? "Cuenta corriente"
                              : row.kind === "cc_payment"
                                ? "Cobro deuda"
                                : "Manual"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">{methodIcon(row.method)}{methodLabel(row.method)}</span>
                    </td>
                    <td className="px-4 py-3">{row.reason}</td>
                    <td
                      className={
                        "px-4 py-3 text-right font-semibold " +
                        (row.kind === "cc_sale"
                          ? "text-slate-500"
                          : row.movement_type === "in"
                            ? "text-emerald-500"
                            : "text-rose-500")
                      }
                    >
                      {row.kind === "cc_sale" ? "+" : row.movement_type === "in" ? "+" : "-"}
                      {moneyAr(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 hover:bg-emerald-500/10 transition-colors"
                          title="Vista previa"
                          onClick={() => {
                            setTicketPreview({
                              business,
                              kind: row.kind === "cc_sale" || row.kind === "cc_payment" ? "sale" : row.kind,
                              total: row.amount,
                              saleId: row.sale_id || row.id,
                              items: row.items,
                              paymentMethod: row.method,
                              reason: row.reason,
                              notes: row.notes,
                              created_at: row.created_at,
                              cashReceived: row.cashReceived,
                            });
                          }}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 hover:bg-emerald-500/10 transition-colors"
                          title="Imprimir"
                          onClick={() => {
                            printTicket({
                              business,
                              kind: row.kind === "cc_sale" || row.kind === "cc_payment" ? "sale" : row.kind,
                              total: row.amount,
                              saleId: row.sale_id || row.id,
                              items: row.items,
                              paymentMethod: row.method,
                              reason: row.reason,
                              notes: row.notes,
                              created_at: row.created_at,
                              cashReceived: row.cashReceived,
                            });
                          }}
                        >
                          <Printer className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {openCashModal ? (
          <motion.div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpenCashModal(false);
            }}
          >
            <motion.div
              className="w-full max-w-xl rounded-2xl border bg-card shadow-xl"
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <div className="text-sm font-semibold tracking-tight">Abrir caja</div>
                  <div className="text-xs text-muted-foreground">Configurá el inicio del turno</div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setOpenCashModal(false)}>
                  <X className="size-4" />
                </Button>
              </div>
              <form action={openCashFormAction} className="grid gap-3 p-5">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="opening_amount_modal">Monto inicial</Label>
                    <Input id="opening_amount_modal" name="opening_amount" type="number" step="0.01" defaultValue="0" required />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="shift_start_at_modal">Horario inicio</Label>
                    <Input id="shift_start_at_modal" name="shift_start_at" type="time" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="shift_end_at_modal">Horario fin</Label>
                    <Input id="shift_end_at_modal" name="shift_end_at" type="time" />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="notes_modal">Notas</Label>
                  <Input id="notes_modal" name="notes" placeholder="Observaciones de apertura (opcional)" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpenCashModal(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Abrir caja</Button>
                </div>
                {openCashState?.error && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                    {openCashState.error}
                  </div>
                )}
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {movementModal && openRegister ? (
          <motion.div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setMovementModal(false);
            }}
          >
            <motion.div
              className="w-full max-w-6xl rounded-2xl border bg-card shadow-xl"
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <div className="text-sm font-semibold tracking-tight">Movimiento manual</div>
                  <div className="text-xs text-muted-foreground">Ingreso o retiro con motivo y medio</div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setMovementModal(false)}>
                  <X className="size-4" />
                </Button>
              </div>
              <form
                className="grid gap-3 p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const formEl = e.currentTarget;
                  const formData = new FormData(formEl);
                  startMovementTransition(() => {
                    (async () => {
                      try {
                        await createCashMovementAction(formData);
                        setMovementModal(false);
                        setMovementSavedModal(true);
                        formEl.reset();
                        router.refresh();
                      } catch {
                        // Keep modal open if action fails.
                      }
                    })();
                  });
                }}
              >
                <input type="hidden" name="cash_register_id" value={openRegister.id} />
                <div className="grid gap-2 sm:grid-cols-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="movement_type_modal">Tipo</Label>
                    <select
                      id="movement_type_modal"
                      name="movement_type"
                      defaultValue="out"
                      className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                      <option value="in">Ingreso</option>
                      <option value="out">Retiro / Egreso</option>
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="payment_method_modal">Medio</Label>
                    <select
                      id="payment_method_modal"
                      name="payment_method"
                      defaultValue="cash"
                      className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta</option>
                      <option value="transfer">Transferencia</option>
                      <option value="mercadopago">Mercado Pago</option>
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="amount_modal">Monto</Label>
                    <Input id="amount_modal" name="amount" type="number" step="0.01" required />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="reason_modal">Motivo</Label>
                    <Input id="reason_modal" name="reason" placeholder="Pago proveedor, retiro..." required />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="notes_movement_modal">Notas</Label>
                  <Input id="notes_movement_modal" name="notes" placeholder="Detalle opcional" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setMovementModal(false)} disabled={movementPending}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={movementPending}>
                    {movementPending ? "Guardando..." : "Guardar movimiento"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {movementSavedModal ? (
          <motion.div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setMovementSavedModal(false);
            }}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl border bg-card shadow-xl"
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              <div className="p-5">
                <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                  Movimiento manual registrado
                </div>
                <div className="mt-4 flex justify-end">
                  <Button type="button" onClick={() => setMovementSavedModal(false)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {closeModal && openRegister ? (
          <motion.div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setCloseModal(false);
            }}
          >
            <motion.div
              className="w-full max-w-2xl rounded-2xl border bg-card shadow-xl"
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <div className="text-sm font-semibold tracking-tight">Cierre de caja por medios</div>
                  <div className="text-xs text-muted-foreground">Compará esperado vs contado y registrá diferencias</div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setCloseModal(false)}>
                  <X className="size-4" />
                </Button>
              </div>
              <form action={closeCashRegisterAction} className="grid gap-3 p-5">
                <input type="hidden" name="cash_register_id" value={openRegister.id} />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {([
                    ["cash", "Efectivo", countedCash, setCountedCash],
                    ["card", "Tarjeta", countedCard, setCountedCard],
                    ["transfer", "Transferencia", countedTransfer, setCountedTransfer],
                    ["mercadopago", "Mercado Pago", countedMercadoPago, setCountedMercadoPago],
                  ] as const).map(([key, label, value, setter]) => (
                    <div key={key} className={"min-w-0 rounded-xl border p-3 shadow-sm " + methodCardTone(key).wrap}>
                      <div className="flex items-center justify-between">
                        <div className={"truncate text-xs font-semibold " + methodCardTone(key).title}>{label}</div>
                        <span className={"inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap " + methodCardTone(key).badge}>
                          {methodIcon(key)}
                          {methodShortLabel(key)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">Esperado: {moneyAr(expectedByMethod[key])}</div>
                      <Input
                        className="mt-2"
                        type="number"
                        step="0.01"
                        name={`closing_${key}`}
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        required
                      />
                      <div className={"mt-1 text-xs font-medium " + (Math.abs(differences[key]) < 0.01 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                        Dif: {moneyAr(differences[key])}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="notes_close_modal">Notas de cierre</Label>
                  <Input id="notes_close_modal" name="notes" placeholder="Diferencias, observaciones..." />
                </div>
                <div
                  className={
                    "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm " +
                    (hasDifference
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-500"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500")
                  }
                >
                  {hasDifference ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                  {hasDifference ? "Hay diferencia en el cierre. Se guardará para auditoría." : "Cierre OK en todos los medios."}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setCloseModal(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="gap-2 border-emerald-500/50 hover:bg-emerald-500/10"
                    onClick={() => {
                      const notesEl = document.getElementById("notes_close_modal") as HTMLInputElement;
                      const closureNotes = notesEl?.value || "";
                      const methodsData = [
                        { key: "cash", label: "Efectivo", expected: expectedByMethod.cash, counted: counted.cash, difference: differences.cash },
                        { key: "card", label: "Tarjeta", expected: expectedByMethod.card, counted: counted.card, difference: differences.card },
                        { key: "transfer", label: "Transferencia", expected: expectedByMethod.transfer, counted: counted.transfer, difference: differences.transfer },
                        { key: "mercadopago", label: "Mercado Pago", expected: expectedByMethod.mercadopago, counted: counted.mercadopago, difference: differences.mercadopago },
                      ];
                      setTicketPreview({
                        business,
                        kind: "closure",
                        total: 0,
                        notes: closureNotes,
                        closureData: {
                          openedAt: openRegister!.opened_at,
                          closedAt: new Date().toISOString(),
                          methods: methodsData
                        }
                      });
                    }}
                  >
                    <Eye className="size-4" />
                    Vista previa
                  </Button>
                  <Button type="submit" className="bg-rose-600 text-white hover:bg-rose-700">
                    Confirmar cierre
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {historyModal ? (
          <motion.div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setHistoryModal(false);
            }}
          >
            <motion.div
              className="w-full max-w-6xl rounded-2xl border bg-card shadow-xl"
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <div className="text-sm font-semibold tracking-tight">Turnos de caja</div>
                  <div className="text-xs text-muted-foreground">Totales y control de cierre por turno</div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setHistoryModal(false)}>
                  <X className="size-4" />
                </Button>
              </div>
              <div className="max-h-[70vh] overflow-auto p-5">
                <div className="grid gap-3">
                  {historyTurns.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No hay turnos para mostrar.
                    </div>
                  ) : (
                    historyTurns.map((turn) => {
                      const diffSum =
                        Math.abs(turn.difference_totals.cash) +
                        Math.abs(turn.difference_totals.card) +
                        Math.abs(turn.difference_totals.transfer) +
                        Math.abs(turn.difference_totals.mercadopago);
                      const isClosed = Boolean(turn.closed_at);
                      const ok = isClosed && diffSum < 0.01;
                      return (
                        <div key={turn.id} className="rounded-xl border p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="font-medium">Turno #{turn.id.slice(0, 8)}</div>
                              <div className="text-xs text-muted-foreground">
                                Apertura: {formatArgentinaDateTime(turn.opened_at)}
                                {turn.closed_at ? ` · Cierre: ${formatArgentinaDateTime(turn.closed_at)}` : " · Abierto"}
                              </div>
                            </div>
                            <div
                              className={
                                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs " +
                                (ok
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                                  : isClosed
                                    ? "border-rose-500/30 bg-rose-500/10 text-rose-500"
                                    : "border-amber-500/30 bg-amber-500/10 text-amber-500")
                              }
                            >
                              {ok ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                              {ok ? "Cierre OK" : isClosed ? "Con diferencias" : "Abierto"}
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 md:grid-cols-4 text-sm">
                            <div className="rounded-md bg-primary/5 px-3 py-2">Vendido: {moneyAr(turn.sold_total)}</div>
                            <div className="rounded-md bg-primary/5 px-3 py-2">Apertura: {moneyAr(turn.opening_amount)}</div>
                            <div className="rounded-md bg-primary/5 px-3 py-2">Cierre efec.: {moneyAr(turn.closing_amount)}</div>
                            <div className="rounded-md bg-primary/5 px-3 py-2">Dif total: {moneyAr(diffSum)}</div>
                          </div>
                          <div className="mt-3 flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => setHistoryDetailTurn(turn)}
                            >
                              Ver detalle
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {historyDetailTurn ? (
          <motion.div
            className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setHistoryDetailTurn(null);
            }}
          >
            <motion.div
              className="w-full max-w-5xl rounded-2xl border bg-card shadow-xl"
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <div className="text-sm font-semibold tracking-tight">
                    Detalle de turno #{historyDetailTurn.id.slice(0, 8)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Apertura: {formatArgentinaDateTime(historyDetailTurn.opened_at)}
                    {historyDetailTurn.closed_at ? ` · Cierre: ${formatArgentinaDateTime(historyDetailTurn.closed_at)}` : " · Abierto"}
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setHistoryDetailTurn(null)}>
                  <X className="size-4" />
                </Button>
              </div>
              <div className="max-h-[75vh] overflow-auto p-6 space-y-4 text-sm">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-md bg-primary/5 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Vendido</div>
                    <div className="font-semibold">{moneyAr(historyDetailTurn.sold_total)}</div>
                  </div>
                  <div className="rounded-md bg-primary/5 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Apertura</div>
                    <div className="font-semibold">{moneyAr(historyDetailTurn.opening_amount)}</div>
                  </div>
                  <div className="rounded-md bg-primary/5 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Cierre efectivo</div>
                    <div className="font-semibold">{moneyAr(historyDetailTurn.closing_amount)}</div>
                  </div>
                  <div className="rounded-md bg-primary/5 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Diferencia total</div>
                    <div className="font-semibold">
                      {moneyAr(
                        Math.abs(historyDetailTurn.difference_totals.cash) +
                          Math.abs(historyDetailTurn.difference_totals.card) +
                          Math.abs(historyDetailTurn.difference_totals.transfer) +
                          Math.abs(historyDetailTurn.difference_totals.mercadopago),
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Detalle por medio de pago
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {(["cash", "card", "transfer", "mercadopago"] as const).map((m) => {
                      const tone = methodCardTone(m);
                      const label = methodLabel(m);
                      const expected = historyDetailTurn.expected_totals[m];
                      const closing = historyDetailTurn.closing_totals[m];
                      const diff = historyDetailTurn.difference_totals[m];
                      return (
                        <div
                          key={m}
                          className={
                            "rounded-xl border px-2 py-1.5 text-[11px] flex flex-col gap-1 " +
                            tone.wrap
                          }
                        >
                          <div className="flex items-center justify-between">
                            <div className="inline-flex items-center gap-1.5">
                              <span className={tone.title}>{label}</span>
                            </div>
                            <span className={"inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium " + tone.badge}>
                              {methodIcon(m)}
                              {methodShortLabel(m)}
                            </span>
                          </div>
                          <div
                            className={
                              "mt-0.5 flex flex-wrap items-center gap-1 text-[11px] " +
                              (Math.abs(diff) < 0.01
                                ? "text-muted-foreground"
                                : diff > 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400")
                            }
                          >
                            <span className="text-muted-foreground">
                              Esp: <span className="font-semibold text-foreground">{moneyAr(expected)}</span>
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">
                              Cont: <span className="font-semibold text-foreground">{moneyAr(closing)}</span>
                            </span>
                            <span className="text-muted-foreground">·</span>
                            <span className="font-semibold">
                              Dif: {moneyAr(diff)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {ticketPreview ? (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setTicketPreview(null);
            }}
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl border bg-card shadow-2xl overflow-hidden"
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30 text-foreground">
                <span className="text-sm font-semibold">Vista previa de ticket</span>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setTicketPreview(null)}>
                  <X className="size-4" />
                </Button>
              </div>

              <div className="p-6 bg-white text-black dark:bg-[var(--pos-surface)] dark:text-white overflow-auto max-h-[70vh]">
                <div
                  className="ticket-container dark:[&_*]:text-white dark:[&_*]:border-white/30 dark:[&_hr]:border-white/30"
                  dangerouslySetInnerHTML={{
                    __html: generateTicketHtml(ticketPreview)
                      .split("</head>")[1]
                      .replace("<body>", "")
                      .replace("</body></html>", ""),
                  }}
                />
              </div>

              <div className="p-4 border-t border-border bg-muted/30 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setTicketPreview(null)}>
                  Cerrar
                </Button>
                <Button 
                  className="flex-1 bg-[var(--pos-accent)] text-black hover:bg-[var(--pos-accent)]/80" 
                  onClick={() => {
                    printTicket(ticketPreview);
                    setTicketPreview(null);
                  }}
                >
                  <Printer className="mr-2 size-4" />
                  Imprimir
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
