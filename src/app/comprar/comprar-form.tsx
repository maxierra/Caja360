"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { StoreProduct } from "@/lib/store-products";
import { formatStorePrice } from "@/lib/store-products";
import { startStoreCheckout } from "@/app/comprar/actions";
import { BUSINESS_TYPES, businessTypeLabel } from "@/lib/business-types";

type Props = {
  product: StoreProduct;
};

export function ComprarForm({ product }: Props) {
  const [pending, startTransition] = React.useTransition();
  const [form, setForm] = React.useState({
    email: "",
    customerName: "",
    phone: "",
    businessName: "",
    businessType: "retail",
    shippingAddress: "",
    shippingCity: "",
    shippingProvince: "",
    shippingPostalCode: "",
    shippingNotes: "",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const customerName = form.customerName.trim();
    if (product.includes_hardware && customerName.split(/\s+/).filter(Boolean).length < 2) {
      toast.error("Ingresá nombre y apellido completos para el envío.");
      return;
    }
    startTransition(async () => {
      const res = await startStoreCheckout({
        sku: product.sku,
        email: form.email,
        customerName,
        phone: form.phone,
        businessName: form.businessName,
        businessType: form.businessType,
        shippingAddress: form.shippingAddress,
        shippingCity: form.shippingCity,
        shippingProvince: form.shippingProvince,
        shippingPostalCode: form.shippingPostalCode,
        shippingNotes: form.shippingNotes,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      window.location.href = res.checkoutUrl;
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
        <div className="text-lg font-bold text-slate-900">{product.name}</div>
        <div className="mt-1 text-2xl font-bold text-sky-800">{formatStorePrice(product.price_ars)}</div>
        {product.includes_hardware && product.hardware_summary ? (
          <p className="mt-2 text-sm text-slate-600">Incluye: {product.hardware_summary}</p>
        ) : null}
        <p className="mt-2 text-xs text-slate-500">Licencia de por vida del software. Acceso inmediato al pagar.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="email">Email (será tu usuario de acceso)</Label>
          <Input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="dueño@minegocio.com"
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="customerName">Nombre completo</Label>
          <Input
            id="customerName"
            required
            autoComplete="name"
            value={form.customerName}
            onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
            placeholder="Nombre y apellido (como en el DNI)"
          />
          {product.includes_hardware ? (
            <p className="text-xs text-muted-foreground">
              Lo usamos en la etiqueta de envío a tu provincia.
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="phone">Teléfono / WhatsApp</Label>
          <Input
            id="phone"
            required
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="11 1234-5678"
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="businessName">Nombre del negocio</Label>
          <Input
            id="businessName"
            required
            value={form.businessName}
            onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
            placeholder="Mi kiosco"
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="businessType">Tipo de negocio</Label>
          <select
            id="businessType"
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
              "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            value={form.businessType}
            onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value }))}
          >
            {BUSINESS_TYPES.map((value) => (
              <option key={value} value={value}>
                {businessTypeLabel(value)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {product.includes_hardware ? (
        <fieldset className="grid gap-4 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4">
          <legend className="px-1 text-sm font-semibold text-amber-950">Envío del hardware</legend>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="shippingAddress">Dirección</Label>
            <Input
              id="shippingAddress"
              required
              value={form.shippingAddress}
              onChange={(e) => setForm((f) => ({ ...f, shippingAddress: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="shippingCity">Ciudad</Label>
              <Input
                id="shippingCity"
                required
                value={form.shippingCity}
                onChange={(e) => setForm((f) => ({ ...f, shippingCity: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="shippingProvince">Provincia</Label>
              <Input
                id="shippingProvince"
                required
                value={form.shippingProvince}
                onChange={(e) => setForm((f) => ({ ...f, shippingProvince: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="shippingPostalCode">Código postal</Label>
            <Input
              id="shippingPostalCode"
              value={form.shippingPostalCode}
              onChange={(e) => setForm((f) => ({ ...f, shippingPostalCode: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="shippingNotes">Notas para el envío (opcional)</Label>
            <Input
              id="shippingNotes"
              value={form.shippingNotes}
              onChange={(e) => setForm((f) => ({ ...f, shippingNotes: e.target.value }))}
              placeholder="Horario de entrega, piso, etc."
            />
          </div>
        </fieldset>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Redirigiendo a Mercado Pago…
          </>
        ) : (
          <>
            <ShoppingCart className="mr-2 size-4" />
            Pagar {formatStorePrice(product.price_ars)}
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Al pagar aceptás recibir tus credenciales por email.{" "}
        <Link href="/auth/login" className="underline">
          ¿Ya tenés cuenta?
        </Link>
      </p>
    </form>
  );
}
