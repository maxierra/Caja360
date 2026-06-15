"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, FileKey, RefreshCw, ShieldCheck, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  BusinessFiscalConfig,
  FiscalCertificate,
  FiscalPointOfSale,
} from "@/features/billing/types";
import {
  downloadCertificateCsr,
  generateCertificateRequest,
  saveFiscalConfig,
  syncFiscalLastNumber,
  testFiscalAuth,
  uploadCertificateFromPem,
} from "@/app/app/(main)/settings/fiscal-actions";

type Props = {
  defaults: {
    cuit: string | null;
    name: string;
  };
  config: BusinessFiscalConfig | null;
  posHomolog: FiscalPointOfSale | null;
  posProd: FiscalPointOfSale | null;
  certHomolog: FiscalCertificate | null;
  certProd: FiscalCertificate | null;
};

export function FiscalConfigForm({
  defaults,
  config,
  posHomolog,
  posProd,
  certHomolog,
  certProd,
}: Props) {
  const [pending, startTransition] = React.useTransition();
  const [certEnv, setCertEnv] = React.useState<"homolog" | "prod">("homolog");
  const [form, setForm] = React.useState({
    tax_condition: (config?.tax_condition ?? "monotributo") as "monotributo" | "ri",
    cuit: config?.cuit ?? defaults.cuit ?? "",
    razon_social: config?.razon_social ?? defaults.name ?? "",
    domicilio_fiscal: config?.domicilio_fiscal ?? "",
    iibb: config?.iibb ?? "",
    environment: (config?.environment ?? "homolog") as "homolog" | "prod",
    billing_mode: (config?.billing_mode ?? "per_sale") as "per_sale" | "consolidated",
    is_active: config?.is_active ?? false,
    pos_number_homolog: posHomolog?.pos_number ?? 1,
    pos_number_prod: posProd?.pos_number ?? 1,
  });

  const activeCert = certEnv === "homolog" ? certHomolog : certProd;
  const certInputRef = React.useRef<HTMLInputElement>(null);

  const save = () => {
    startTransition(async () => {
      try {
        await saveFiscalConfig(form);
        toast.success("Configuración fiscal guardada");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  };

  const generateCsr = () => {
    startTransition(async () => {
      try {
        await generateCertificateRequest({
          environment: certEnv,
          cuit: form.cuit,
          razonSocial: form.razon_social,
        });
        toast.success("CSR generado. Descargalo y subilo a ARCA.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const downloadCsr = () => {
    startTransition(async () => {
      try {
        const pem = await downloadCertificateCsr(certEnv);
        const blob = new Blob([pem], { type: "application/pkcs10" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `solicitud-${certEnv}.csr`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  };

  const onCertFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    startTransition(async () => {
      try {
        const pem = await file.text();
        await uploadCertificateFromPem({ environment: certEnv, certPem: pem });
        toast.success("Certificado activado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
      }
    });
  };

  const testConn = () => {
    startTransition(async () => {
      try {
        const r = await testFiscalAuth(certEnv);
        toast.success(`Conexión OK. Último comprobante: ${r.lastVoucherNumber}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error de conexión");
      }
    });
  };

  const syncLast = () => {
    startTransition(async () => {
      try {
        const r = await syncFiscalLastNumber(certEnv);
        toast.success(`Último nº sincronizado: ${r.lastVoucherNumber}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/70 bg-card p-5">
        <h3 className="text-sm font-bold">Datos fiscales</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Monotributo (Fase 1). Responsable Inscripto — Fase 3 (próximamente).
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Monotributo
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            RI · Fase 3
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <span className="font-medium">CUIT</span>
            <Input value={form.cuit} onChange={(e) => setForm((f) => ({ ...f, cuit: e.target.value }))} />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="font-medium">Razón social</span>
            <Input value={form.razon_social} onChange={(e) => setForm((f) => ({ ...f, razon_social: e.target.value }))} />
          </label>
          <label className="grid gap-1 text-xs sm:col-span-2">
            <span className="font-medium">Domicilio fiscal</span>
            <Input value={form.domicilio_fiscal} onChange={(e) => setForm((f) => ({ ...f, domicilio_fiscal: e.target.value }))} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-5">
        <h3 className="text-sm font-bold">Punto de venta y modo</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <span className="font-medium">PtoVta homologación</span>
            <Input
              type="number"
              value={form.pos_number_homolog}
              onChange={(e) => setForm((f) => ({ ...f, pos_number_homolog: Number(e.target.value) || 1 }))}
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="font-medium">PtoVta producción</span>
            <Input
              type="number"
              value={form.pos_number_prod}
              onChange={(e) => setForm((f) => ({ ...f, pos_number_prod: Number(e.target.value) || 1 }))}
            />
          </label>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            {(["homolog", "prod"] as const).map((env) => (
              <button
                key={env}
                type="button"
                onClick={() => setForm((f) => ({ ...f, environment: env }))}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  form.environment === env ? "border-slate-900 bg-slate-900 text-white" : "border-border"
                )}
              >
                {env === "homolog" ? "Homologación" : "Producción"}
              </button>
            ))}
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, billing_mode: "per_sale" }))}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                form.billing_mode === "per_sale" ? "border-emerald-600 bg-emerald-600 text-white" : "border-border"
              )}
            >
              Venta a venta
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, billing_mode: "consolidated" }))}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                form.billing_mode === "consolidated" ? "border-amber-600 bg-amber-600 text-white" : "border-border"
              )}
              title="Fase 2"
            >
              Consolidada (Fase 2)
            </button>
          </div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Activar facturación electrónica en el POS
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={pending}>
            Guardar configuración
          </Button>
          <Button type="button" variant="outline" onClick={syncLast} disabled={pending}>
            <RefreshCw className="mr-1 size-4" />
            Sincronizar último nº
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-5">
        <h3 className="text-sm font-bold">Certificados ARCA</h3>
        <div className="mt-3 flex gap-2">
          {(["homolog", "prod"] as const).map((env) => (
            <button
              key={env}
              type="button"
              onClick={() => setCertEnv(env)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                certEnv === env ? "border-sky-700 bg-sky-700 text-white" : "border-border"
              )}
            >
              {env === "homolog" ? "Test" : "Prod"}
            </button>
          ))}
        </div>
        {activeCert && (
          <p className="mt-3 text-xs text-muted-foreground">
            Estado: <strong>{activeCert.status}</strong>
            {activeCert.expires_at ? ` · vence ${new Date(activeCert.expires_at).toLocaleDateString("es-AR")}` : ""}
          </p>
        )}
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Generá CSR + clave privada (se guarda en Storage privado)</li>
          <li>Descargá el CSR y subilo al portal ARCA</li>
          <li>Subí el certificado .crt que te devuelve ARCA</li>
          <li>Probá la conexión</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={generateCsr} disabled={pending}>
            <FileKey className="mr-1 size-4" />
            Generar CSR
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={downloadCsr} disabled={pending}>
            <Download className="mr-1 size-4" />
            Descargar CSR
          </Button>
          <label className="inline-flex">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => certInputRef.current?.click()}
            >
              <Upload className="mr-1 size-4" />
              Subir certificado
            </Button>
            <input
              ref={certInputRef}
              type="file"
              accept=".crt,.pem,.cer"
              className="hidden"
              onChange={onCertFile}
            />
          </label>
          <Button type="button" variant="outline" size="sm" onClick={testConn} disabled={pending}>
            <ShieldCheck className="mr-1 size-4" />
            Probar conexión
          </Button>
        </div>
      </section>
    </div>
  );
}
