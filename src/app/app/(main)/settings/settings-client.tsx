"use client";

import * as React from "react";
import { Percent, Users, Store, Wallet, X, QrCode, FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { BusinessInfoForm } from "@/app/app/(main)/settings/business-info-form";
import { MercadoPagoPosForm } from "@/app/app/(main)/settings/mercadopago-pos-form";
import { PaymentMethodsManager } from "@/app/app/(main)/settings/payment-methods-manager";
import { UsersManager } from "@/app/app/(main)/settings/users-manager";
import { PromotionsManager } from "@/app/app/(main)/settings/promotions-manager";
import { FiscalConfigForm } from "@/app/app/(main)/settings/fiscal-config-form";
import type { BusinessPaymentMethodRow } from "@/lib/business-payment-methods";
import type {
  BusinessFiscalConfig,
  FiscalCertificate,
  FiscalPointOfSale,
} from "@/features/billing/types";

type BusinessDefaults = {
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
};

type FiscalSettingsProps = {
  config: BusinessFiscalConfig | null;
  posHomolog: FiscalPointOfSale | null;
  posProd: FiscalPointOfSale | null;
  certHomolog: FiscalCertificate | null;
  certProd: FiscalCertificate | null;
} | null;

type Props = {
  defaults?: BusinessDefaults;
  paymentMethods: BusinessPaymentMethodRow[];
  canEditPaymentMethods: boolean;
  mercadoPagoPosExternalId: string | null;
  mercadoPagoQrReady: boolean;
  fiscalSettings: FiscalSettingsProps;
};

type ModalAccent = "emerald" | "sky" | "violet" | "amber" | "cyan";

const MODAL_ACCENT: Record<ModalAccent, { blob: string; gradient: string }> = {
  emerald: {
    blob: "bg-emerald-400/20",
    gradient: "from-emerald-500/[0.12] via-teal-500/[0.06] to-transparent",
  },
  sky: {
    blob: "bg-sky-400/20",
    gradient: "from-sky-500/[0.12] via-blue-500/[0.06] to-transparent",
  },
  violet: {
    blob: "bg-violet-400/20",
    gradient: "from-violet-500/[0.12] via-fuchsia-500/[0.05] to-transparent",
  },
  amber: {
    blob: "bg-amber-400/20",
    gradient: "from-amber-500/[0.12] via-orange-500/[0.06] to-transparent",
  },
  cyan: {
    blob: "bg-cyan-400/20",
    gradient: "from-cyan-500/[0.12] via-sky-500/[0.06] to-transparent",
  },
};

function ModalShell({
  open,
  title,
  description,
  onClose,
  children,
  maxWidthClass = "max-w-3xl",
  accent = "emerald",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
  accent?: ModalAccent;
}) {
  if (!open) return null;

  const a = MODAL_ACCENT[accent];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card",
          "shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.55)]",
          "ring-1 ring-black/[0.06] dark:ring-white/10",
          maxWidthClass,
          "max-h-[min(95vh,960px)]"
        )}
      >
        <div className="relative shrink-0 overflow-hidden border-b border-border/50">
          <div className={cn("absolute inset-0 bg-gradient-to-br", a.gradient)} />
          <div
            className={cn("pointer-events-none absolute -right-16 -top-20 size-56 rounded-full blur-3xl", a.blob)}
          />
          <div className="relative flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
            <div className="min-w-0 space-y-1">
              <div className="text-lg font-semibold tracking-tight text-foreground">{title}</div>
              {description ? (
                <div className="text-sm leading-snug text-muted-foreground">{description}</div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="size-9 shrink-0 rounded-full border border-border/60 bg-background/80 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-muted/20 to-transparent p-5 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

type SettingsCardAccent = "emerald" | "sky" | "violet" | "amber" | "cyan";

const SETTINGS_CARD_STYLES: Record<
  SettingsCardAccent,
  { iconWrap: string; icon: string; hoverBorder: string; hoverShadow: string }
> = {
  emerald: {
    iconWrap: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    icon: "text-emerald-600 dark:text-emerald-400",
    hoverBorder: "hover:border-emerald-500/35",
    hoverShadow: "hover:shadow-emerald-500/[0.12]",
  },
  sky: {
    iconWrap: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    icon: "text-sky-600 dark:text-sky-400",
    hoverBorder: "hover:border-sky-500/35",
    hoverShadow: "hover:shadow-sky-500/[0.12]",
  },
  violet: {
    iconWrap: "bg-violet-500/15 text-violet-800 dark:text-violet-300",
    icon: "text-violet-600 dark:text-violet-400",
    hoverBorder: "hover:border-violet-500/35",
    hoverShadow: "hover:shadow-violet-500/[0.12]",
  },
  amber: {
    iconWrap: "bg-amber-500/15 text-amber-900 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-400",
    hoverBorder: "hover:border-amber-500/40",
    hoverShadow: "hover:shadow-amber-500/[0.12]",
  },
  cyan: {
    iconWrap: "bg-cyan-500/15 text-cyan-900 dark:text-cyan-300",
    icon: "text-cyan-600 dark:text-cyan-400",
    hoverBorder: "hover:border-cyan-500/40",
    hoverShadow: "hover:shadow-cyan-500/[0.12]",
  },
};

function SettingsCard({
  accent,
  icon: Icon,
  title,
  description,
  hint,
  tooltip,
  onClick,
}: {
  accent: SettingsCardAccent;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  hint: string;
  tooltip?: string;
  onClick: () => void;
}) {
  const s = SETTINGS_CARD_STYLES[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip ?? description}
      className={cn(
        "group relative flex h-full min-h-[220px] flex-col text-left",
        "rounded-2xl border border-border/70 bg-card",
        "shadow-md shadow-black/[0.04] dark:shadow-black/20",
        "ring-1 ring-transparent transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-lg",
        s.hoverBorder,
        s.hoverShadow
      )}
    >
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl p-6 sm:p-7">
        <div
          className={cn(
            "pointer-events-none absolute -right-8 -top-8 size-32 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100",
            accent === "emerald" && "bg-emerald-400/25",
            accent === "sky" && "bg-sky-400/25",
            accent === "violet" && "bg-violet-400/25",
            accent === "amber" && "bg-amber-400/25",
            accent === "cyan" && "bg-cyan-400/25"
          )}
        />
        <div
          className={cn(
            "relative mb-5 flex size-12 items-center justify-center rounded-xl border border-white/20 shadow-inner dark:border-white/5",
            s.iconWrap
          )}
        >
          <Icon className={cn("size-6", s.icon)} />
        </div>
        <div className="relative flex flex-1 flex-col gap-2">
          <div className="text-base font-semibold leading-snug tracking-tight text-foreground">{title}</div>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          <p className="text-xs font-medium text-muted-foreground/80">{hint}</p>
        </div>
        <div className="relative mt-6 border-t border-border/50 pt-4 text-xs font-semibold text-muted-foreground/80 group-hover:text-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="border-b border-transparent group-hover:border-current">Abrir sección</span>
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      </div>
    </button>
  );
}

export function SettingsClient({
  defaults,
  paymentMethods,
  canEditPaymentMethods,
  mercadoPagoPosExternalId,
  mercadoPagoQrReady,
  fiscalSettings,
}: Props) {
  const [bizOpen, setBizOpen] = React.useState(false);
  const [usersOpen, setUsersOpen] = React.useState(false);
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [mpPosOpen, setMpPosOpen] = React.useState(false);
  const [promosOpen, setPromosOpen] = React.useState(false);
  const [fiscalOpen, setFiscalOpen] = React.useState(false);

  const fiscalActive = Boolean(fiscalSettings?.config?.is_active);
  const fiscalCertStatus =
    fiscalSettings?.config?.environment === "prod"
      ? fiscalSettings?.certProd?.status
      : fiscalSettings?.certHomolog?.status;

  return (
    <>
      <div className="grid auto-rows-fr gap-6 sm:grid-cols-2 xl:grid-cols-3 xl:gap-8">
        <SettingsCard
          accent="emerald"
          icon={Store}
          title="Datos del negocio"
          description="Nombre, CUIT y datos fiscales del comercio."
          hint="Encabezado y pie del ticket."
          tooltip="Configurá nombre del negocio, CUIT, dirección y textos que se imprimen en el ticket."
          onClick={() => setBizOpen(true)}
        />
        <SettingsCard
          accent="sky"
          icon={Users}
          title="Usuarios"
          description="Cuentas para empleados y permisos."
          hint="Alta, baja y edición."
          tooltip="Creá usuarios para tus empleados, definí roles y permisos para cada uno."
          onClick={() => setUsersOpen(true)}
        />
        <SettingsCard
          accent="violet"
          icon={Wallet}
          title="Medios de pago"
          description="Opciones que aparecen al cobrar."
          hint={`${paymentMethods.filter((m) => m.is_active).length} medios activos`}
          tooltip="Elegí qué métodos de pago se muestran en el POS, su nombre visible, ícono y orden."
          onClick={() => setPaymentOpen(true)}
        />
        <SettingsCard
          accent="amber"
          icon={Percent}
          title="Promociones y descuentos"
          description="Reglas automáticas de descuentos."
          hint="Por monto, cantidad, producto o categoría."
          tooltip="Definí promociones por monto de ticket, cantidad total o cantidad de producto, filtradas por medios de pago y horarios."
          onClick={() => setPromosOpen(true)}
        />
        <SettingsCard
          accent="cyan"
          icon={QrCode}
          title="Mercado Pago (QR)"
          description="Cobro con QR en el POS."
          hint={mercadoPagoQrReady ? "QR activo" : "Pendiente de configurar"}
          tooltip="Cargá el token y la caja de Mercado Pago para mostrar el QR al cobrar desde el POS."
          onClick={() => setMpPosOpen(true)}
        />
        <SettingsCard
          accent="emerald"
          icon={FileText}
          title="Facturación ARCA"
          description="Certificados, punto de venta y CAE."
          hint={
            fiscalActive
              ? `Activa · cert ${fiscalCertStatus ?? "—"}`
              : "Monotributo · configurar"
          }
          tooltip="Generá CSR, subí certificados ARCA/AFIP y activá Factura C en el POS."
          onClick={() => setFiscalOpen(true)}
        />
      </div>

      <ModalShell
        open={bizOpen}
        title="Datos del negocio"
        description="Esta información aparecerá en los tickets de venta."
        onClose={() => setBizOpen(false)}
        accent="emerald"
      >
        <BusinessInfoForm defaults={defaults} />
      </ModalShell>

      <ModalShell
        open={usersOpen}
        title="Usuarios"
        description="Creá usuarios para tus empleados y asignales permisos para este comercio."
        onClose={() => setUsersOpen(false)}
        accent="sky"
      >
        <UsersManager />
      </ModalShell>

      <ModalShell
        open={paymentOpen}
        title="Medios de pago en el POS"
        description="Nombre visible, ícono o logo URL, orden y activación."
        onClose={() => setPaymentOpen(false)}
        maxWidthClass="max-w-4xl"
        accent="violet"
      >
        <PaymentMethodsManager initialRows={paymentMethods} canEdit={canEditPaymentMethods} />
      </ModalShell>

      <ModalShell
        open={promosOpen}
        title="Promociones y descuentos"
        description="Configurá reglas de descuento por monto de ticket, cantidad total o cantidad por producto/categoría. Se aplican automáticamente en el punto de venta."
        onClose={() => setPromosOpen(false)}
        maxWidthClass="max-w-[1320px]"
        accent="amber"
      >
        <PromotionsManager />
      </ModalShell>

      <ModalShell
        open={mpPosOpen}
        title="Mercado Pago QR"
        description="Token de producción + caja en MP para mostrar el QR al cobrar."
        onClose={() => setMpPosOpen(false)}
        maxWidthClass="max-w-lg"
        accent="cyan"
      >
        <MercadoPagoPosForm
          posExternalId={mercadoPagoPosExternalId}
          qrReady={mercadoPagoQrReady}
          canEdit={canEditPaymentMethods}
        />
      </ModalShell>

      <ModalShell
        open={fiscalOpen}
        title="Facturación ARCA"
        description="Monotributo — Factura C y Notas de Crédito. Certificados por ambiente (test/prod)."
        onClose={() => setFiscalOpen(false)}
        maxWidthClass="max-w-3xl"
        accent="emerald"
      >
        <FiscalConfigForm
          defaults={{
            cuit: defaults?.cuit ?? null,
            name: defaults?.name ?? "",
          }}
          config={fiscalSettings?.config ?? null}
          posHomolog={fiscalSettings?.posHomolog ?? null}
          posProd={fiscalSettings?.posProd ?? null}
          certHomolog={fiscalSettings?.certHomolog ?? null}
          certProd={fiscalSettings?.certProd ?? null}
        />
      </ModalShell>
    </>
  );
}
