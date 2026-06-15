"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, Store } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

type Props = {
  action: (formData: FormData) => Promise<void>;
};

export function SetupForm({ action }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const suggestedSlug = useMemo(() => slugify(name), [name]);
  const slugValue = slugTouched ? slug : suggestedSlug;

  return (
    <form action={action} className="grid gap-4">
      <div className="rounded-xl border border-[var(--pos-border)] bg-[var(--pos-surface-2)] p-3 text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-2 font-medium text-foreground">
          <Store className="size-3.5 text-[var(--pos-accent)]" />
          Configuración inicial
        </div>
        <div className="mt-1">Completá el nombre y el sistema genera el slug automáticamente.</div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="name">Nombre del negocio</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Kiosco Central"
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="slug">Slug (opcional)</Label>
        <Input
          id="slug"
          name="slug"
          value={slugValue}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          placeholder="mi-negocio"
        />
        <div className="text-xs text-muted-foreground">
          URL sugerida: <span className="font-medium">{slugValue || "mi-negocio"}</span>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="business_type" className="flex items-center gap-1.5">
          <LayoutGrid className="size-3.5 text-muted-foreground" />
          Tipo de negocio
        </Label>
        <select
          id="business_type"
          name="business_type"
          defaultValue="retail"
          className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="retail">Retail con lector y pesables</option>
          <option value="fashion">Indumentaria</option>
          <option value="gastronomy">Gastronomía</option>
        </select>
        <div className="text-xs text-muted-foreground">
          Esto nos va a permitir adaptar luego la carga de productos y la pantalla de ventas.
        </div>
      </div>

      <button className="h-10 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
        Crear negocio
      </button>
    </form>
  );
}
