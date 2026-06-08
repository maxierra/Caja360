"use client";

import * as React from "react";
import { Percent, Filter, Tag } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PosPaymentMethodCode } from "@/lib/business-payment-methods";

type PromotionKind = "ticket_amount" | "ticket_quantity" | "product_quantity";
type PromotionTargetMode = "products" | "categories";

type PromotionProduct = {
  id: string;
  name: string | null;
  barcode: string | null;
  sku: string | null;
  category: string | null;
};

type PromotionRuleRow = {
  id: string;
  name: string;
  kind: PromotionKind;
  target_mode: PromotionTargetMode;
  categories: string[];
  discount_percent: number;
  amount_min: number | null;
  amount_max: number | null;
  quantity_min: number | null;
  payment_methods: PosPaymentMethodCode[] | null;
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  days_of_week: string[] | null;
  time_start: string | null;
  time_end: string | null;
  products: PromotionProduct[];
};

type PromotionsListResponse =
  | { error: string }
  | {
      rows: PromotionRuleRow[];
      paymentMethodLabels: Record<string, string>;
      availableCategories: string[];
    };

export function PromotionsManager() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [rows, setRows] = React.useState<PromotionRuleRow[]>([]);
  const [availableCategories, setAvailableCategories] = React.useState<string[]>([]);
  const [paymentLabels, setPaymentLabels] = React.useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [productSearch, setProductSearch] = React.useState("");
  const [productLookupLoading, setProductLookupLoading] = React.useState(false);
  const [productResults, setProductResults] = React.useState<PromotionProduct[]>([]);

  const emptyRow: PromotionRuleRow = {
    id: "",
    name: "",
    kind: "ticket_amount",
    target_mode: "products",
    categories: [],
    discount_percent: 0,
    amount_min: 0,
    amount_max: null,
    quantity_min: null,
    payment_methods: null,
    active: true,
    valid_from: null,
    valid_until: null,
    days_of_week: null,
    time_start: null,
    time_end: null,
    products: [],
  };

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  React.useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/app/api/settings/promotions");
        const json = (await res.json()) as PromotionsListResponse;
        if (!res.ok || "error" in json) {
          if (!ignore) setError(json && "error" in json ? json.error : "No se pudieron cargar las promociones.");
          return;
        }
        if (ignore) return;
        setRows(json.rows);
        setAvailableCategories(json.availableCategories ?? []);
        setPaymentLabels(json.paymentMethodLabels);
      } catch (e) {
        if (!ignore) setError(e instanceof Error ? e.message : "Error de red");
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  const startNew = () => {
    const tempId = `temp-${Date.now()}`;
    setRows((prev) => [
      ...prev,
      { ...emptyRow, id: tempId },
    ]);
    setProductSearch("");
    setProductResults([]);
    setError(null);
    setSelectedId(tempId);
  };

  const updateSelected = (patch: Partial<PromotionRuleRow>) => {
    setRows((prev) => prev.map((r) => (r.id === (selected?.id ?? "") ? { ...r, ...patch } : r)));
  };

  const addProductToSelected = React.useCallback((product: PromotionProduct) => {
    if (!selected) return;
    setRows((prev) =>
      prev.map((r) =>
        r.id === selected.id
          ? {
              ...r,
              products: r.products.some((p) => p.id === product.id) ? r.products : [...r.products, product],
            }
          : r
      )
    );
    setProductSearch("");
    setProductResults([]);
    setError(null);
  }, [selected]);

  const runProductLookup = React.useCallback(async (rawValue: string) => {
    const value = rawValue.trim();
    if (!value) {
      setProductResults([]);
      return;
    }

    setProductLookupLoading(true);
    setError(null);
    try {
      const res = await fetch(`/app/api/settings/promotions/product-lookup?code=${encodeURIComponent(value)}`);
      const json = (await res.json()) as {
        results?: PromotionProduct[];
        error?: string;
      };
      if (!res.ok) {
        setProductResults([]);
        setError(json.error ?? "No se encontró el producto.");
        return;
      }
      setProductResults(Array.isArray(json.results) ? json.results : []);
    } catch (err) {
      setProductResults([]);
      setError(err instanceof Error ? err.message : "Error al buscar producto.");
    } finally {
      setProductLookupLoading(false);
    }
  }, []);

  const onToggleActive = (id: string, value: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, active: value } : r)));
  };

  const onSave = async () => {
    if (!selected) return;
    if (selected.kind === "product_quantity") {
      if (selected.target_mode === "products" && selected.products.length === 0) {
        setError("Agregá al menos un producto para esta promoción.");
        return;
      }
      if (selected.target_mode === "categories" && selected.categories.length === 0) {
        setError("Elegí al menos una categoría para esta promoción.");
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/app/api/settings/promotions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(selected),
      });
      const json = (await res.json()) as { error?: string; row?: PromotionRuleRow };
      if (!res.ok || json.error) {
        setError(json.error ?? "No se pudo guardar la promoción.");
        return;
      }
      if (json.row) {
        setRows((prev) => prev.map((r) => (r.id === selected.id ? json.row! : r)));
        setSelectedId(json.row.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!selected || !selected.id || selected.id.startsWith("temp-")) {
      // Si es una fila temporal, solo la quitamos localmente.
      setRows((prev) => prev.filter((r) => r.id !== selected?.id));
      setSelectedId(null);
      return;
    }
    if (!window.confirm("¿Eliminar esta promoción? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/app/api/settings/promotions?id=${encodeURIComponent(selected.id)}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || json.error) {
        setError(json.error ?? "No se pudo eliminar la promoción.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== selected.id));
      setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red al eliminar.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Promociones configuradas</h3>
            <p className="text-xs text-muted-foreground">
              Se aplican solo a este negocio, según prioridad y condiciones.
            </p>
          </div>
          <Button type="button" size="sm" onClick={startNew}>
            <Percent className="mr-1 size-3.5" />
            Nueva promoción
          </Button>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/80">
          {loading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Cargando promociones…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Todavía no configuraste promociones. Creá la primera con el botón de arriba.
            </div>
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/60",
                    selectedId === r.id && "bg-muted/80"
                  )}
                  onClick={() => {
                    setProductSearch("");
                    setProductResults([]);
                    setError(null);
                    setSelectedId(r.id);
                  }}
                >
                  <div className="flex flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.name || "Sin título"}</span>
                      <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                        {r.discount_percent || 0}% dto.
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.kind === "ticket_amount" && (
                        <>
                          Ticket entre{" "}
                          <strong>
                            ${Number(r.amount_min ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                          </strong>{" "}
                          y{" "}
                          <strong>
                            $
                            {r.amount_max != null
                              ? Number(r.amount_max).toLocaleString("es-AR", { maximumFractionDigits: 0 })
                              : "∞"}
                          </strong>
                        </>
                      )}
                      {r.kind === "ticket_quantity" && (
                        <>
                          Desde <strong>{r.quantity_min ?? 0}</strong> unidades en el ticket
                        </>
                      )}
                      {r.kind === "product_quantity" && (
                        <>
                          Desde <strong>{r.quantity_min ?? 0}</strong> unidades de{" "}
                          <strong>
                            {r.target_mode === "categories"
                              ? r.categories[0] ?? "categoría"
                              : r.products[0]?.name ?? r.products[0]?.barcode ?? "producto"}
                          </strong>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        r.active
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-slate-500/10 text-slate-600 dark:text-slate-300"
                      )}
                    >
                      {r.active ? "Activa" : "Inactiva"}
                    </span>
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={r.active}
                      onChange={(e) => onToggleActive(r.id, e.target.checked)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Detalle de la promoción</h3>
          <p className="text-xs text-muted-foreground">
            Elegí una promo o creá una nueva para editar nombre, tipo, condiciones y medios de pago.
          </p>
        </div>

        {!selected ? (
          <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
            Seleccioná una promoción de la lista o creá una nueva.
          </div>
        ) : (
          <div className="space-y-4 rounded-xl border border-border/70 bg-background/80 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="promo-name">Nombre</Label>
                <Input
                  id="promo-name"
                  value={selected.name}
                  onChange={(e) => updateSelected({ name: e.target.value })}
                  placeholder="Ej: 10% para tickets grandes"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="promo-kind">Tipo de promoción</Label>
                <select
                  id="promo-kind"
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                  value={selected.kind}
                  onChange={(e) => {
                    const v = e.target.value as PromotionKind;
                    updateSelected({
                      kind: v,
                      target_mode: v === "product_quantity" ? selected.target_mode : "products",
                      amount_min: v === "ticket_amount" ? selected.amount_min ?? 0 : null,
                      amount_max: v === "ticket_amount" ? selected.amount_max : null,
                      quantity_min:
                        v === "ticket_quantity" || v === "product_quantity" ? selected.quantity_min ?? 1 : null,
                      categories: v === "product_quantity" ? selected.categories : [],
                      products: v === "product_quantity" ? selected.products : [],
                    });
                  }}
                >
                  <option value="ticket_amount">Por monto de ticket</option>
                  <option value="ticket_quantity">Por cantidad total</option>
                  <option value="product_quantity">Por cantidad de un producto</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {selected.kind === "ticket_amount" && (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="promo-amount-min">Monto desde</Label>
                    <Input
                      id="promo-amount-min"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={selected.amount_min ?? 0}
                      onChange={(e) => updateSelected({ amount_min: Number(e.target.value || 0) })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="promo-amount-max">Monto hasta (opcional)</Label>
                    <Input
                      id="promo-amount-max"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={selected.amount_max ?? ""}
                      onChange={(e) =>
                        updateSelected({ amount_max: e.target.value ? Number(e.target.value) : null })
                      }
                    />
                  </div>
                </>
              )}

              {(selected.kind === "ticket_quantity" || selected.kind === "product_quantity") && (
                <div className="grid gap-1.5">
                  <Label htmlFor="promo-qty-min">Cantidad mínima</Label>
                  <Input
                    id="promo-qty-min"
                    type="number"
                    inputMode="decimal"
                    step="1"
                    value={selected.quantity_min ?? 1}
                    onChange={(e) => updateSelected({ quantity_min: Number(e.target.value || 1) })}
                  />
                </div>
              )}

              {selected.kind === "product_quantity" && (
                <div className="grid gap-3 md:col-span-2">
                  <div className="grid gap-1.5 md:max-w-xs">
                    <Label htmlFor="promo-target-mode">Aplica sobre</Label>
                    <select
                      id="promo-target-mode"
                      className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                      value={selected.target_mode}
                      onChange={(e) =>
                        updateSelected({
                          target_mode: e.target.value === "categories" ? "categories" : "products",
                        })
                      }
                    >
                      <option value="products">Productos específicos</option>
                      <option value="categories">Categorías</option>
                    </select>
                  </div>

                  {selected.target_mode === "products" ? (
                    <div className="grid gap-2">
                      <div className="grid gap-1.5">
                        <Label htmlFor="promo-product-search">Productos incluidos</Label>
                        <div className="flex gap-2">
                          <Input
                            id="promo-product-search"
                            value={productSearch}
                            placeholder="Nombre, código de barras o código interno"
                            onChange={(e) => setProductSearch(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key !== "Enter") return;
                              e.preventDefault();
                              await runProductLookup(productSearch);
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void runProductLookup(productSearch)}
                            disabled={productLookupLoading || !productSearch.trim()}
                          >
                            {productLookupLoading ? "Buscando..." : "Buscar"}
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Buscá por nombre, barcode o código interno y elegí el producto correcto de la lista.
                        </p>
                      </div>

                      {productResults.length > 0 ? (
                        <div className="rounded-xl border border-border/70 bg-muted/20">
                          <div className="border-b border-border/60 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                            Coincidencias
                          </div>
                          <div className="divide-y divide-border/60">
                            {productResults.map((product) => (
                              <div key={product.id} className="flex items-center justify-between gap-3 px-3 py-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium">{product.name ?? "Producto sin nombre"}</div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {[product.category, product.sku ? `Cod: ${product.sku}` : null, product.barcode ? `EAN: ${product.barcode}` : null]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </div>
                                </div>
                                <Button type="button" size="sm" variant="outline" onClick={() => addProductToSelected(product)}>
                                  Agregar
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {selected.products.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {selected.products.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px]"
                              onClick={() =>
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.id === selected.id ? { ...r, products: r.products.filter((x) => x.id !== p.id) } : r
                                  )
                                )
                              }
                              title={p.barcode ?? p.sku ?? undefined}
                            >
                              <Tag className="size-3" />
                              <span className="max-w-[180px] truncate">{p.name ?? p.barcode ?? p.sku ?? p.id}</span>
                              <span className="ml-0.5 text-xs text-muted-foreground/80">×</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Todavía no agregaste productos. Esta promo se va a aplicar solo a los que selecciones acá.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <div className="grid gap-1.5">
                        <Label>Categorías incluidas</Label>
                        <div className="flex flex-wrap gap-2">
                          {availableCategories.length > 0 ? (
                            availableCategories.map((category) => {
                              const checked = selected.categories.includes(category);
                              return (
                                <button
                                  key={category}
                                  type="button"
                                  className={cn(
                                    "rounded-full border px-3 py-1 text-xs transition-colors",
                                    checked
                                      ? "border-amber-500/60 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                                      : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                                  )}
                                  onClick={() =>
                                    updateSelected({
                                      categories: checked
                                        ? selected.categories.filter((item) => item !== category)
                                        : [...selected.categories, category],
                                    })
                                  }
                                >
                                  {category}
                                </button>
                              );
                            })
                          ) : (
                            <p className="text-[11px] text-muted-foreground">
                              Todavía no hay categorías cargadas en productos para este negocio.
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        El descuento se va a calcular solo sobre los productos del ticket que pertenezcan a las categorías elegidas.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="promo-percent">% de descuento</Label>
                <Input
                  id="promo-percent"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={selected.discount_percent}
                  onChange={(e) => updateSelected({ discount_percent: Number(e.target.value || 0) })}
                />
              </div>

              <div className="grid gap-1.5">
                <Label>Medios de pago</Label>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {(["cash", "card", "transfer", "mercadopago", "cuenta_corriente"] as PosPaymentMethodCode[]).map(
                    (code) => {
                      const checked = selected.payment_methods == null || selected.payment_methods.includes(code);
                      const label = paymentLabels[code] ?? code;
                      return (
                        <label
                          key={code}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px]",
                            checked
                              ? "border-emerald-500/60 bg-emerald-500/8"
                              : "border-border bg-background hover:bg-muted/40"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="size-3.5"
                            checked={checked}
                            onChange={(e) => {
                              const current = selected.payment_methods;
                              if (!e.target.checked) {
                                if (current == null) {
                                  // Pasamos de "todos" a "todos menos este"
                                  updateSelected({
                                    payment_methods: (
                                      ["cash", "card", "transfer", "mercadopago", "cuenta_corriente"] as PosPaymentMethodCode[]
                                    ).filter((c) => c !== code),
                                  });
                                } else {
                                  const next = current.filter((c) => c !== code);
                                  updateSelected({ payment_methods: next.length ? next : null });
                                }
                              } else {
                                if (current == null) {
                                  updateSelected({ payment_methods: null });
                                } else if (!current.includes(code)) {
                                  updateSelected({ payment_methods: [...current, code] });
                                }
                              }
                            }}
                          />
                          <span className="inline-flex items-center gap-1">
                            <Filter className="size-3" />
                            {label}
                          </span>
                        </label>
                      );
                    }
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Si no tildás ninguno o los tildás todos, la promoción aplica a todos los medios de pago.
                </p>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Estado</Label>
              <div className="flex items-center gap-2">
                <input
                  id="promo-active"
                  type="checkbox"
                  className="size-4"
                  checked={selected.active}
                  onChange={(e) => updateSelected({ active: e.target.checked })}
                />
                <Label htmlFor="promo-active" className="text-sm font-normal">
                  Promoción activa
                </Label>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="promo-valid-from">Válida desde (fecha)</Label>
                <Input
                  id="promo-valid-from"
                  type="date"
                  value={selected.valid_from ? selected.valid_from.slice(0, 10) : ""}
                  onChange={(e) => updateSelected({ valid_from: e.target.value ? `${e.target.value}T00:00:00Z` : null })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="promo-valid-until">Válida hasta (fecha)</Label>
                <Input
                  id="promo-valid-until"
                  type="date"
                  value={selected.valid_until ? selected.valid_until.slice(0, 10) : ""}
                  onChange={(e) =>
                    updateSelected({ valid_until: e.target.value ? `${e.target.value}T23:59:59Z` : null })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Días de la semana</Label>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                  {[
                    ["mon", "Lun"],
                    ["tue", "Mar"],
                    ["wed", "Mié"],
                    ["thu", "Jue"],
                    ["fri", "Vie"],
                    ["sat", "Sáb"],
                    ["sun", "Dom"],
                  ].map(([code, label]) => {
                    const checked = !selected.days_of_week || selected.days_of_week.includes(code);
                    return (
                      <label
                        key={code}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1 text-[11px]",
                          checked
                            ? "border-sky-500/60 bg-sky-500/8 text-sky-900 dark:text-sky-100"
                            : "border-border bg-background hover:bg-muted/40 text-muted-foreground"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-3.5"
                          checked={checked}
                          onChange={(e) => {
                            const current = selected.days_of_week;
                            if (!e.target.checked) {
                              if (current == null) {
                                const all = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
                                updateSelected({ days_of_week: all.filter((d) => d !== code) });
                              } else {
                                const next = current.filter((d) => d !== code);
                                updateSelected({ days_of_week: next.length ? next : null });
                              }
                            } else {
                              if (current == null) {
                                updateSelected({ days_of_week: null });
                              } else if (!current.includes(code)) {
                                updateSelected({ days_of_week: [...current, code] });
                              }
                            }
                          }}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Si no tildás ninguno o tildás todos, la promoción aplica todos los días.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label>Horario</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    className="h-9"
                    value={selected.time_start ?? ""}
                    onChange={(e) => updateSelected({ time_start: e.target.value || null })}
                  />
                  <span className="text-xs text-muted-foreground">a</span>
                  <Input
                    type="time"
                    className="h-9"
                    value={selected.time_end ?? ""}
                    onChange={(e) => updateSelected({ time_end: e.target.value || null })}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Dejá ambos vacíos para que la promo aplique todo el día.
                </p>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-700 dark:text-red-200">
                {error}
              </div>
            ) : null}

            <div className="flex justify-between gap-2 pt-1">
              <div>
                {selected.id && !selected.id.startsWith("temp-") ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-red-500 text-red-600 hover:bg-red-50"
                    onClick={onDelete}
                    disabled={deleting}
                  >
                    {deleting ? "Eliminando…" : "Eliminar promoción"}
                  </Button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={onSave} disabled={saving}>
                  {saving ? "Guardando…" : "Guardar promoción"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
