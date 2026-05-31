"use client";

import * as React from "react";

import { Hash, ScanLine } from "lucide-react";
import { toast } from "sonner";

import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateInternalEan13, INTERNAL_PRODUCT_DEFAULTS } from "@/lib/internal-barcode";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";

type ProductDefaults = {
  id?: string;
  name?: string;
  barcode?: string | null;
  scale_code?: string | null;
  category?: string | null;
  cost?: number | null;
  price?: number | null;
  expires_at?: string | null;
  sold_by_weight?: boolean | null;
  stock?: number | null;
  stock_decimal?: number | null;
  low_stock_threshold?: number | null;
  low_stock_threshold_decimal?: number | null;
  active?: boolean | null;
};

type Props = {
  title: string;
  description?: string;
  defaults?: ProductDefaults;
  action: (formData: FormData) => void | Promise<void>;
  /** Si false, el formulario no envuelve en card (modales). */
  container?: boolean;
  canEditPrice?: boolean;
  canEditStock?: boolean;
  submitPulse?: boolean;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseNumberLoose(input: string) {
  const raw = String(input ?? "").replace(",", ".").trim();
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function formatNumberLoose(n: number) {
  if (!Number.isFinite(n)) return "0";
  return String(n);
}

export function ProductForm({
  title,
  description,
  defaults,
  action,
  container = true,
  canEditPrice = true,
  canEditStock = true,
  submitPulse = false,
}: Props) {
  const initialCost = defaults?.cost ?? 0;
  const initialPrice = defaults?.price ?? 0;

  const [soldByWeight, setSoldByWeight] = React.useState(Boolean(defaults?.sold_by_weight));
  const [barcodeInput, setBarcodeInput] = React.useState<string>(defaults?.barcode ?? "");
  const [nameInput, setNameInput] = React.useState<string>(defaults?.name ?? "");
  const [categoryInput, setCategoryInput] = React.useState<string>(defaults?.category ?? "");
  const [expiresAtInput, setExpiresAtInput] = React.useState<string>(defaults?.expires_at ?? "");
  const [stockInput, setStockInput] = React.useState<string>(String(defaults?.stock ?? 0));
  const [lowStockThresholdInput, setLowStockThresholdInput] = React.useState<string>(
    String(defaults?.low_stock_threshold ?? 0)
  );
  const [stockDecimalInput, setStockDecimalInput] = React.useState<string>(String(defaults?.stock_decimal ?? 0));
  const [lowStockThresholdDecimalInput, setLowStockThresholdDecimalInput] = React.useState<string>(
    String(defaults?.low_stock_threshold_decimal ?? 0)
  );
  const [costInput, setCostInput] = React.useState<string>(formatNumberLoose(initialCost));
  const [marginInput, setMarginInput] = React.useState<string>(() => {
    if (!initialCost) return "0";
    return formatNumberLoose(round2(((initialPrice - initialCost) / initialCost) * 100));
  });
  const [priceInput, setPriceInput] = React.useState<string>(formatNumberLoose(initialPrice));
  /** En alta, el margen puede arrastrar el precio. En edición, el precio guardado manda (si no, al redondear el % y volver a aplicar costo×(1+margen) se desfasa, ej. 3500 → 3500.1). */
  const [lastEdited, setLastEdited] = React.useState<"margin" | "price">(() => (defaults?.id ? "price" : "margin"));

  const [scannerOpen, setScannerOpen] = React.useState(false);

  const [preloadLoading, setPreloadLoading] = React.useState(false);
  const [preload, setPreload] = React.useState<
    | null
    | {
        ean: string;
        name: string;
        brand: string | null;
        price_real: number | null;
        price_offer: number | null;
        cat1: string | null;
        cat2: string | null;
        cat3: string | null;
      }
  >(null);

  const preloadSuggestedPrice = React.useMemo(() => {
    if (!preload) return null;
    const offer = preload.price_offer ?? null;
    const real = preload.price_real ?? null;
    if (offer && offer > 0) return offer;
    if (real && real > 0) return real;
    return null;
  }, [preload]);

  const preloadCategoryPath = React.useMemo(() => {
    if (!preload) return null;
    const parts = [preload.cat1, preload.cat2, preload.cat3].filter(Boolean);
    return parts.length ? parts.join(" > ") : null;
  }, [preload]);

  const preloadRepresentativeCategory = React.useMemo(() => {
    if (!preload) return null;
    return preload.cat3 || preload.cat2 || preload.cat1 || null;
  }, [preload]);

  const lastAutoFilledEanRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!preload) return;
    if (defaults?.id) return;

    if (lastAutoFilledEanRef.current === preload.ean) return;
    lastAutoFilledEanRef.current = preload.ean;

    if (!nameInput.trim()) {
      const brand = preload.brand ? String(preload.brand).trim() : "";
      const baseName = String(preload.name ?? "").trim();
      setNameInput(brand ? `${baseName} - ${brand}` : baseName);
    }
    if (!categoryInput.trim() && preloadRepresentativeCategory) setCategoryInput(preloadRepresentativeCategory);

    const suggestedPrice = (() => {
      const offer = preload.price_offer ?? null;
      const real = preload.price_real ?? null;
      if (offer && offer > 0) return offer;
      if (real && real > 0) return real;
      return null;
    })();

    if (suggestedPrice != null) {
      const currentPrice = parseNumberLoose(priceInput);
      if (!currentPrice) {
        setLastEdited("price");
        setPriceInput(formatNumberLoose(suggestedPrice));
      }
    }

    const farExpiry = "2099-12-31";
    if (!expiresAtInput) setExpiresAtInput(farExpiry);

    if (!soldByWeight) {
      const currentStock = Number(stockInput);
      const currentMin = Number(lowStockThresholdInput);
      if (!currentStock) setStockInput("100");
      if (!currentMin) setLowStockThresholdInput("50");
    } else {
      const currentStock = Number(stockDecimalInput);
      const currentMin = Number(lowStockThresholdDecimalInput);
      if (!currentStock) setStockDecimalInput("100");
      if (!currentMin) setLowStockThresholdDecimalInput("50");
    }
  }, [preload, defaults?.id, soldByWeight]);

  React.useEffect(() => {
    const ean = barcodeInput.replace(/\s+/g, "").trim();
    if (!ean) {
      setPreload(null);
      return;
    }

    const t = window.setTimeout(() => {
      (async () => {
        try {
          setPreloadLoading(true);
          const supabase = createClient();

          const tryLoad = async (select: string) => {
            return await supabase.from("preload_products").select(select).eq("ean", ean).limit(1).maybeSingle();
          };

          const first = await tryLoad("ean,name,brand,price_real,price_offer,cat1,cat2,cat3");
          const second = first.error
            ? await tryLoad("ean,producto,brand,precio_real,precio_oferta,cat1,cat2,cat3")
            : { data: null, error: null };

          const data = (first.data ?? second.data) as any;
          const error = first.error && second.error ? (second.error as any) : null;

          if (error || !data) {
            setPreload(null);
            setPreloadLoading(false);
            return;
          }

          const name = data.name ?? data.producto ?? "";
          const priceReal = data.price_real ?? data.precio_real;
          const priceOffer = data.price_offer ?? data.precio_oferta;

          setPreload({
            ean: String(data.ean),
            name: String(name ?? ""),
            brand: data.brand ? String(data.brand) : null,
            price_real: priceReal != null ? Number(priceReal) : null,
            price_offer: priceOffer != null ? Number(priceOffer) : null,
            cat1: data.cat1 ? String(data.cat1) : null,
            cat2: data.cat2 ? String(data.cat2) : null,
            cat3: data.cat3 ? String(data.cat3) : null,
          });
          setPreloadLoading(false);
        } catch {
          setPreload(null);
          setPreloadLoading(false);
        }
      })();
    }, 250);

    return () => window.clearTimeout(t);
  }, [barcodeInput]);

  const cost = React.useMemo(() => parseNumberLoose(costInput), [costInput]);
  const margin = React.useMemo(() => parseNumberLoose(marginInput), [marginInput]);
  const price = React.useMemo(() => parseNumberLoose(priceInput), [priceInput]);

  React.useEffect(() => {
    if (lastEdited !== "margin") return;
    const p = round2(cost * (1 + margin / 100));
    setPriceInput(formatNumberLoose(p));
  }, [cost, margin, lastEdited]);

  React.useEffect(() => {
    if (lastEdited !== "price") return;
    if (!cost) {
      setMarginInput("0");
      return;
    }
    const m = round2(((price - cost) / cost) * 100);
    setMarginInput(formatNumberLoose(m));
  }, [cost, price, lastEdited]);

  const content = (
    <>
      <div className="space-y-1">
        <div className="text-base font-semibold tracking-tight">{title}</div>
        {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
      </div>

      <form action={action} className="mt-5 grid gap-4">
        {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

        {defaults?.id ? (
          <div className="flex flex-col gap-2 lg:hidden">
            <Button
              type="button"
              variant="outline"
              className="h-14 w-full shrink-0 gap-2 rounded-2xl border-[var(--pos-accent)]/40 bg-[var(--pos-surface-2)] text-base font-semibold hover:bg-[var(--pos-accent)]/10"
              onClick={() => setScannerOpen(true)}
            >
              <ScanLine className="size-5" />
              Escanear
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Leé el código para actualizar el EAN. Podés seguir editando precio y stock abajo.
            </p>
          </div>
        ) : null}

        <div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2 md:col-span-1">
              <Label htmlFor="barcode">Código de barras</Label>
              <div className="flex gap-2">
                <Input
                  id="barcode"
                  name="barcode"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="O escribilo a mano"
                  className="min-w-0 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  title={
                    barcodeInput.trim()
                      ? "Vacía el campo para generar un EAN interno"
                      : "Generar EAN interno (sin código de fabricante)"
                  }
                  disabled={Boolean(barcodeInput.trim())}
                  onClick={() => {
                    const code = generateInternalEan13();
                    setBarcodeInput(code);
                    setExpiresAtInput(INTERNAL_PRODUCT_DEFAULTS.expiresAt);
                    if (soldByWeight) {
                      setStockDecimalInput(INTERNAL_PRODUCT_DEFAULTS.stockKg);
                      setLowStockThresholdDecimalInput(INTERNAL_PRODUCT_DEFAULTS.lowStockKg);
                    } else {
                      setStockInput(INTERNAL_PRODUCT_DEFAULTS.stockUnits);
                      setLowStockThresholdInput(INTERNAL_PRODUCT_DEFAULTS.lowStockUnits);
                    }
                    toast.success("Código interno generado", {
                      description: soldByWeight
                        ? `${code} · Stock ${INTERNAL_PRODUCT_DEFAULTS.stockKg} kg · Mín. ${INTERNAL_PRODUCT_DEFAULTS.lowStockKg} kg · Vto. ${INTERNAL_PRODUCT_DEFAULTS.expiresAt}`
                        : `${code} · Stock ${INTERNAL_PRODUCT_DEFAULTS.stockUnits} u. · Mín. ${INTERNAL_PRODUCT_DEFAULTS.lowStockUnits} u. · Vto. ${INTERNAL_PRODUCT_DEFAULTS.expiresAt}`,
                    });
                  }}
                >
                  <Hash className="size-4" />
                  <span className="sr-only">Generar código interno</span>
                </Button>
              </div>
              {preloadLoading ? (
                <p className="text-[11px] text-muted-foreground">Buscando datos en la base…</p>
              ) : null}
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} required />
            </div>
          </div>

          {preload && !defaults?.id ? (
            <div
              className={cn(
                "mt-3 rounded-xl border border-emerald-500/35 bg-emerald-500/[0.07] p-3 text-left",
                "dark:bg-emerald-950/25"
              )}
            >
              <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Datos sugeridos</div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {preloadCategoryPath ? <span className="block">{preloadCategoryPath}</span> : null}
                {preloadSuggestedPrice != null ? (
                  <span className="mt-0.5 block">Precio referencia venta: ${preloadSuggestedPrice}</span>
                ) : null}
                <span className="mt-1 block text-emerald-700/90 dark:text-emerald-300/90">
                  Revisá precio de compra y stock abajo antes de guardar.
                </span>
              </p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="unit_type">Tipo</Label>
            <select
              id="unit_type"
              name="unit_type"
              value={soldByWeight ? "weight" : "unit"}
              onChange={(e) => setSoldByWeight(e.target.value === "weight")}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="unit">Por unidad</option>
              <option value="weight">Pesable (por kg)</option>
            </select>
            <input type="hidden" name="sold_by_weight" value={soldByWeight ? "on" : "off"} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category">Categoría</Label>
            <Input id="category" name="category" value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="scale_code">Código balanza</Label>
            <Input
              id="scale_code"
              name="scale_code"
              defaultValue={defaults?.scale_code ?? ""}
              disabled={!soldByWeight}
              placeholder={soldByWeight ? "Ej: 201" : "Solo para pesables"}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="cost">Precio compra</Label>
            <Input
              id="cost"
              name="cost"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              disabled={!canEditPrice}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="margin">Margen (%)</Label>
            <Input
              id="margin"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={marginInput}
              onChange={(e) => {
                setLastEdited("margin");
                setMarginInput(e.target.value);
              }}
              disabled={!canEditPrice}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="price">Precio venta{soldByWeight ? " (por kg)" : ""}</Label>
            <Input
              id="price"
              name="price"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={priceInput}
              onChange={(e) => {
                setLastEdited("price");
                setPriceInput(e.target.value);
              }}
              disabled={!canEditPrice}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="expires_at">Vencimiento</Label>
            <Input
              id="expires_at"
              name="expires_at"
              type="date"
              value={expiresAtInput}
              onChange={(e) => setExpiresAtInput(e.target.value)}
            />
          </div>

          <div className="flex items-end gap-2">
            <input
              id="active"
              name="active"
              type="checkbox"
              defaultChecked={defaults?.active ?? true}
              className="size-4"
            />
            <Label htmlFor="active">Activo</Label>
          </div>
        </div>

        {soldByWeight ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="stock_decimal">Stock (kg)</Label>
              <Input
                id="stock_decimal"
                name="stock_decimal"
                type="number"
                inputMode="decimal"
                step="0.001"
                value={stockDecimalInput}
                onChange={(e) => setStockDecimalInput(e.target.value)}
                disabled={!canEditStock}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="low_stock_threshold_decimal">Stock mínimo (kg)</Label>
              <Input
                id="low_stock_threshold_decimal"
                name="low_stock_threshold_decimal"
                type="number"
                inputMode="decimal"
                step="0.001"
                value={lowStockThresholdDecimalInput}
                onChange={(e) => setLowStockThresholdDecimalInput(e.target.value)}
                disabled={!canEditStock}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="stock">Stock (unidades)</Label>
              <Input
                id="stock"
                name="stock"
                type="number"
                step="1"
                value={stockInput}
                onChange={(e) => setStockInput(e.target.value)}
                disabled={!canEditStock}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="low_stock_threshold">Stock mínimo (unidades)</Label>
              <Input
                id="low_stock_threshold"
                name="low_stock_threshold"
                type="number"
                step="1"
                value={lowStockThresholdInput}
                onChange={(e) => setLowStockThresholdInput(e.target.value)}
                disabled={!canEditStock}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 lg:pt-0">
          <Button
            type="submit"
            className={cn(
              "h-12 w-full rounded-2xl text-base font-semibold lg:h-10 lg:w-auto",
              submitPulse && "animate-onboarding-product-pulse border-2 border-emerald-300"
            )}
          >
            Guardar producto
          </Button>
        </div>
      </form>

      <BarcodeScanner
        open={scannerOpen}
        continuous={false}
        steppedAfterSuccess={false}
        onClose={() => setScannerOpen(false)}
        onDecoded={(raw) => {
          const code = raw.replace(/\s+/g, "").trim();
          if (!code) return true;
          setBarcodeInput(code);
          if (
            defaults?.id &&
            typeof window !== "undefined" &&
            window.matchMedia("(max-width: 1023px)").matches
          ) {
            toast.success("Código leído", {
              description: "Revisá precio de compra, margen y stock.",
              duration: 2800,
            });
            window.setTimeout(() => {
              const el = document.getElementById("cost");
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
              (el as HTMLInputElement | null)?.focus({ preventScroll: true });
            }, 400);
          }
          return true;
        }}
      />
    </>
  );

  return container ? <div className="rounded-xl border bg-card p-5">{content}</div> : <div>{content}</div>;
}
