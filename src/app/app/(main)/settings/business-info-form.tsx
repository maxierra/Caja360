"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Store, MapPin, Phone, FileText, MessageSquare, Receipt, LayoutGrid, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBusinessInfo } from "@/app/app/(main)/settings/actions";
import { businessTypeLabel, getBusinessCapabilities, normalizeBusinessType } from "@/lib/business-types";

type Props = {
  defaults?: {
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
    tables: Array<{ id: string; name: string; active: boolean }>;
  };
};

function businessDefaultsKey(defaults: Props["defaults"]) {
  const tf = defaults?.ticket_footer ?? "¡Gracias por su compra!";
  return [
    defaults?.name ?? "",
    defaults?.business_type ?? "",
    defaults?.gastronomy_counter_enabled ? "1" : "0",
    defaults?.gastronomy_delivery_enabled ? "1" : "0",
    defaults?.gastronomy_tables_enabled ? "1" : "0",
    defaults?.address ?? "",
    defaults?.phone ?? "",
    defaults?.cuit ?? "",
    defaults?.ticket_header ?? "",
    tf,
    (defaults?.tables ?? []).map((table) => table.name).join("|"),
  ].join("\u0001");
}

function parseTableNames(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function BusinessInfoForm({ defaults }: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const businessType = normalizeBusinessType(defaults?.business_type);
  const capabilities = getBusinessCapabilities(businessType);
  const defaultsKey = businessDefaultsKey(defaults);
  const [tableLines, setTableLines] = React.useState(() =>
    (defaults?.tables ?? []).map((table) => table.name).join("\n")
  );
  const tableCount = React.useMemo(() => parseTableNames(tableLines).length, [tableLines]);

  React.useEffect(() => {
    setTableLines((defaults?.tables ?? []).map((table) => table.name).join("\n"));
  }, [defaultsKey]);

  const handleTableCountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const count = Math.max(0, Math.min(200, Number.parseInt(event.target.value, 10) || 0));
    const current = parseTableNames(tableLines);
    if (count === current.length) return;

    if (count > current.length) {
      const next = [...current];
      for (let index = current.length + 1; index <= count; index += 1) {
        next.push(`Mesa ${index}`);
      }
      setTableLines(next.join("\n"));
      return;
    }

    setTableLines(current.slice(0, count).join("\n"));
  };

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await updateBusinessInfo(formData);
      if (result.error) {
        toast.error("Error al guardar", { description: result.error });
      } else {
        toast.success("Datos del negocio actualizados");
        router.refresh();
      }
    });
  };

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-zinc-900">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
          <Store className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Datos del Negocio</h2>
          <p className="text-sm text-muted-foreground">
            Esta información aparecerá en los tickets de venta.
          </p>
        </div>
      </div>

      <form action={handleSubmit} key={defaultsKey} className="grid gap-5">
        {/* Nombre y CUIT */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="name" className="flex items-center gap-1.5">
              <Store className="size-3.5 text-muted-foreground" />
              Nombre del negocio
            </Label>
            <Input
              id="name"
              name="name"
              defaultValue={defaults?.name ?? ""}
              required
              placeholder="Mi Negocio"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="business_type" className="flex items-center gap-1.5">
              <LayoutGrid className="size-3.5 text-muted-foreground" />
              Rubro operativo
            </Label>
            <select
              id="business_type"
              name="business_type"
              defaultValue={businessType}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="retail">Retail con lector y pesables</option>
              <option value="fashion">Indumentaria</option>
              <option value="gastronomy">Gastronomía</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              Define el modo base de carga y venta que vamos a ir adaptando para este negocio.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Perfil operativo actual
          </div>
          <div className="mt-2 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
            <div>
              <span className="font-medium">Rubro:</span> {businessTypeLabel(businessType)}
            </div>
            <div>
              <span className="font-medium">Modo de venta:</span>{" "}
              {capabilities.salesMode === "scanner" ? "Escáner / búsqueda" : "Catálogo"}
            </div>
            <div>
              <span className="font-medium">Carga de productos:</span>{" "}
              {capabilities.productMode === "variants" ? "Con variantes" : "Simple"}
            </div>
            <div>
              <span className="font-medium">Pesables:</span> {capabilities.supportsWeight ? "Sí" : "No"}
            </div>
          </div>
        </div>

        {businessType === "gastronomy" ? (
          <div className="grid gap-4 rounded-xl border border-amber-200/70 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-950/10">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="size-4 text-amber-600 dark:text-amber-400" />
              <div className="text-sm font-semibold">Modo gastronómico</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm dark:bg-zinc-900">
                <input
                  type="checkbox"
                  name="gastronomy_counter_enabled"
                  defaultChecked={defaults?.gastronomy_counter_enabled ?? true}
                  className="size-4"
                />
                Venta mostrador
              </label>
              <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm dark:bg-zinc-900">
                <input
                  type="checkbox"
                  name="gastronomy_delivery_enabled"
                  defaultChecked={defaults?.gastronomy_delivery_enabled ?? false}
                  className="size-4"
                />
                Pedidos delivery
              </label>
              <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm dark:bg-zinc-900">
                <input
                  type="checkbox"
                  name="gastronomy_tables_enabled"
                  defaultChecked={defaults?.gastronomy_tables_enabled ?? false}
                  className="size-4"
                />
                Mesas en el local
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="tables_count">Cantidad de mesas</Label>
                <Input
                  id="tables_count"
                  name="tables_count"
                  type="number"
                  min="0"
                  max="200"
                  value={tableCount}
                  onChange={handleTableCountChange}
                  placeholder="Ej: 12"
                />
                <p className="text-[11px] text-muted-foreground">
                  Si no cargás nombres, el sistema genera automáticamente `Mesa 1`, `Mesa 2`, etc.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tables_names">Mesas configuradas</Label>
                <textarea
                  id="tables_names"
                  name="tables_names"
                  value={tableLines}
                  onChange={(event) => setTableLines(event.target.value)}
                  rows={5}
                  placeholder={"Mesa 1\nMesa 2\nMesa 3"}
                  className="flex w-full rounded-lg border border-input bg-white px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-zinc-900"
                />
                <p className="text-[11px] text-muted-foreground">Una mesa por línea. Podés usar nombres como `Patio 1` o `Barra 2`.</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <input type="hidden" name="gastronomy_counter_enabled" value="off" />
            <input type="hidden" name="gastronomy_delivery_enabled" value="off" />
            <input type="hidden" name="gastronomy_tables_enabled" value="off" />
            <input type="hidden" name="tables_count" value="0" />
            <input type="hidden" name="tables_names" value="" />
          </>
        )}        

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="cuit" className="flex items-center gap-1.5">
              <FileText className="size-3.5 text-muted-foreground" />
              CUIT
            </Label>
            <Input
              id="cuit"
              name="cuit"
              defaultValue={defaults?.cuit ?? ""}
              placeholder="20-12345678-9"
            />
          </div>
        </div>

        {/* Dirección y Teléfono */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="address" className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-muted-foreground" />
              Dirección
            </Label>
            <Input
              id="address"
              name="address"
              defaultValue={defaults?.address ?? ""}
              placeholder="Av. Corrientes 1234, CABA"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone" className="flex items-center gap-1.5">
              <Phone className="size-3.5 text-muted-foreground" />
              Teléfono
            </Label>
            <Input
              id="phone"
              name="phone"
              defaultValue={defaults?.phone ?? ""}
              placeholder="11 1234-5678"
            />
          </div>
        </div>

        {/* Separador visual */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
          </div>
          <div className="relative flex justify-center">
            <span className="flex items-center gap-1.5 bg-white px-3 text-xs font-medium text-muted-foreground dark:bg-zinc-900">
              <Receipt className="size-3.5" />
              Configuración del Ticket
            </span>
          </div>
        </div>

        {/* Encabezado del ticket */}
        <div className="grid gap-2">
          <Label htmlFor="ticket_header" className="flex items-center gap-1.5">
            <Receipt className="size-3.5 text-muted-foreground" />
            Encabezado del ticket
          </Label>
          <textarea
            id="ticket_header"
            name="ticket_header"
            defaultValue={defaults?.ticket_header ?? ""}
            placeholder="Texto adicional que aparece arriba del ticket (ej: horario de atención, slogan, etc.)"
            rows={2}
            className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <p className="text-[11px] text-muted-foreground">
            Aparece debajo del nombre y dirección en el ticket.
          </p>
        </div>

        {/* Mensaje de agradecimiento */}
        <div className="grid gap-2">
          <Label htmlFor="ticket_footer" className="flex items-center gap-1.5">
            <MessageSquare className="size-3.5 text-muted-foreground" />
            Mensaje de agradecimiento
          </Label>
          <textarea
            id="ticket_footer"
            name="ticket_footer"
            defaultValue={defaults?.ticket_footer ?? "¡Gracias por su compra!"}
            placeholder="¡Gracias por su compra!"
            rows={2}
            className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <p className="text-[11px] text-muted-foreground">
            Aparece al final del ticket de venta.
          </p>
        </div>

        {/* Preview mini */}
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Vista previa del ticket
          </div>
          <div className="mt-2 space-y-0.5 text-center font-mono text-xs text-zinc-700 dark:text-zinc-300">
            <div className="font-bold">{defaults?.name ?? "Mi Negocio"}</div>
            {defaults?.address ? <div>{defaults.address}</div> : null}
            {defaults?.phone ? <div>Tel: {defaults.phone}</div> : null}
            {defaults?.cuit ? <div>CUIT: {defaults.cuit}</div> : null}
            {defaults?.ticket_header ? <div className="mt-1">{defaults.ticket_header}</div> : null}
            <div className="my-1 border-b border-dashed border-zinc-300 dark:border-zinc-600" />
            <div className="text-muted-foreground">... ítems de la venta ...</div>
            <div className="my-1 border-b border-dashed border-zinc-300 dark:border-zinc-600" />
            <div className="font-bold">{defaults?.ticket_footer ?? "¡Gracias por su compra!"}</div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending} className="min-w-32">
            {pending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </div>
  );
}
