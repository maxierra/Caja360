"use client";

import * as React from "react";

import { Hash, ScanLine } from "lucide-react";
import { toast } from "sonner";

import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BusinessType } from "@/lib/business-types";
import { createClient } from "@/lib/supabase/browser";
import { generateInternalEan13, INTERNAL_PRODUCT_DEFAULTS } from "@/lib/internal-barcode";
import { cn } from "@/lib/utils";

type ProductDefaults = {
  id?: string;
  name?: string;
  image_path?: string | null;
  image_url?: string | null;
  barcode?: string | null;
  scale_code?: string | null;
  category?: string | null;
  variant_group?: string | null;
  size?: string | null;
  color?: string | null;
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
  businessType?: BusinessType;
  defaults?: ProductDefaults;
  action: (formData: FormData) => void | Promise<void>;
  container?: boolean;
  canEditPrice?: boolean;
  canEditStock?: boolean;
  submitPulse?: boolean;
};

type PreloadProduct = {
  ean: string;
  name: string;
  brand: string | null;
  price_real: number | null;
  price_offer: number | null;
  cat1: string | null;
  cat2: string | null;
  cat3: string | null;
};

const FASHION_COLOR_OPTIONS = [
  { name: "Negro", swatch: "#111111" },
  { name: "Blanco", swatch: "#f5f5f5" },
  { name: "Gris", swatch: "#9ca3af" },
  { name: "Azul", swatch: "#2563eb" },
  { name: "Celeste", swatch: "#38bdf8" },
  { name: "Rojo", swatch: "#dc2626" },
  { name: "Rosa", swatch: "#ec4899" },
  { name: "Verde", swatch: "#16a34a" },
  { name: "Beige", swatch: "#d6c2a1" },
  { name: "Marrón", swatch: "#8b5e3c" },
  { name: "Camel", swatch: "#c19a6b" },
  { name: "Bordo", swatch: "#7f1d1d" },
] as const;

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

function splitCommaValues(input: string) {
  const raw = String(input ?? "").trim();
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function joinCommaValues(values: string[]) {
  return values.join(", ");
}

export function ProductForm({
  title,
  description,
  businessType = "retail",
  defaults,
  action,
  container = true,
  canEditPrice = true,
  canEditStock = true,
  submitPulse = false,
}: Props) {
  const isFashion = businessType === "fashion";
  const isGastronomy = businessType === "gastronomy";
  const catalogStyle = isFashion || isGastronomy;

  const initialCost = defaults?.cost ?? 0;
  const initialPrice = defaults?.price ?? 0;

  const [soldByWeight, setSoldByWeight] = React.useState(Boolean(defaults?.sold_by_weight) && !catalogStyle);
  const [barcodeInput, setBarcodeInput] = React.useState<string>(defaults?.barcode ?? "");
  const [nameInput, setNameInput] = React.useState<string>(defaults?.name ?? "");
  const [categoryInput, setCategoryInput] = React.useState<string>(defaults?.category ?? "");
  const [sizeInput, setSizeInput] = React.useState<string>(defaults?.size ?? "");
  const [colorInput, setColorInput] = React.useState<string>(defaults?.color ?? "");
  const [sizesInput, setSizesInput] = React.useState<string>(defaults?.size ?? "");
  const [colorsInput, setColorsInput] = React.useState<string>(defaults?.color ?? "");
  const [selectedColors, setSelectedColors] = React.useState<string[]>(() => splitCommaValues(defaults?.color ?? ""));
  const [customColorsInput, setCustomColorsInput] = React.useState<string>("");
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
  const [lastEdited, setLastEdited] = React.useState<"margin" | "price">(() => (defaults?.id ? "price" : "margin"));
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(defaults?.image_url ?? null);
  const [preloadLoading, setPreloadLoading] = React.useState(false);
  const [preload, setPreload] = React.useState<PreloadProduct | null>(null);
  const lastAutoFilledEanRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (catalogStyle && soldByWeight) {
      setSoldByWeight(false);
    }
  }, [catalogStyle, soldByWeight]);

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

  React.useEffect(() => {
    if (!preload || defaults?.id) return;
    if (lastAutoFilledEanRef.current === preload.ean) return;
    lastAutoFilledEanRef.current = preload.ean;

    if (!nameInput.trim()) {
      const brand = preload.brand ? String(preload.brand).trim() : "";
      const baseName = String(preload.name ?? "").trim();
      setNameInput(brand ? `${baseName} - ${brand}` : baseName);
    }

    if (!categoryInput.trim() && preloadRepresentativeCategory) {
      setCategoryInput(preloadRepresentativeCategory);
    }

    if (preloadSuggestedPrice != null && !parseNumberLoose(priceInput)) {
      setLastEdited("price");
      setPriceInput(formatNumberLoose(preloadSuggestedPrice));
    }

    if (!catalogStyle && !expiresAtInput) {
      setExpiresAtInput("2099-12-31");
    }

    if (!soldByWeight) {
      if (!Number(stockInput)) setStockInput("100");
      if (!Number(lowStockThresholdInput)) setLowStockThresholdInput("50");
    } else {
      if (!Number(stockDecimalInput)) setStockDecimalInput("100");
      if (!Number(lowStockThresholdDecimalInput)) setLowStockThresholdDecimalInput("50");
    }
  }, [
    preload,
    defaults?.id,
    nameInput,
    categoryInput,
    preloadRepresentativeCategory,
    preloadSuggestedPrice,
    priceInput,
    catalogStyle,
    expiresAtInput,
    soldByWeight,
    stockInput,
    lowStockThresholdInput,
    stockDecimalInput,
    lowStockThresholdDecimalInput,
  ]);

  React.useEffect(() => {
    if (catalogStyle) {
      setPreload(null);
      setPreloadLoading(false);
      return;
    }

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

          const tryLoad = async (select: string) =>
            supabase.from("preload_products").select(select).eq("ean", ean).limit(1).maybeSingle();

          const first = await tryLoad("ean,producto,brand,precioReal,precioOferta,cat1,cat2,cat3");
          const second =
            first.error && !first.data
              ? await tryLoad("ean,producto,brand,precioreal,preciooferta,cat1,cat2,cat3")
              : { data: null, error: null };
          const third =
            first.error && second.error && !second.data
              ? await tryLoad("ean,name,brand,price_real,price_offer,cat1,cat2,cat3")
              : { data: null, error: null };

          const data = (first.data ?? second.data ?? third.data) as Record<string, unknown> | null;
          const error = first.error && second.error && third.error ? third.error : null;

          if (error || !data) {
            setPreload(null);
            setPreloadLoading(false);
            return;
          }

          const name = data.name ?? data.producto ?? "";
          const priceReal = data.price_real ?? data.precio_real ?? data.precioreal ?? data.precioReal;
          const priceOffer = data.price_offer ?? data.precio_oferta ?? data.preciooferta ?? data.precioOferta;

          setPreload({
            ean: String(data.ean ?? ""),
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
  }, [barcodeInput, catalogStyle]);

  const cost = React.useMemo(() => parseNumberLoose(costInput), [costInput]);
  const margin = React.useMemo(() => parseNumberLoose(marginInput), [marginInput]);
  const price = React.useMemo(() => parseNumberLoose(priceInput), [priceInput]);

  React.useEffect(() => {
    if (lastEdited !== "margin") return;
    setPriceInput(formatNumberLoose(round2(cost * (1 + margin / 100))));
  }, [cost, margin, lastEdited]);

  React.useEffect(() => {
    if (lastEdited !== "price") return;
    if (!cost) {
      setMarginInput("0");
      return;
    }
    setMarginInput(formatNumberLoose(round2(((price - cost) / cost) * 100)));
  }, [cost, price, lastEdited]);

  const generateInternalCode = () => {
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
    toast.success("Código interno generado");
  };

  const syncCreateColors = React.useCallback((nextSelectedColors: string[], manualInput: string) => {
    const merged = Array.from(new Set([...nextSelectedColors, ...splitCommaValues(manualInput)]));
    setSelectedColors(nextSelectedColors);
    setColorsInput(joinCommaValues(merged));
  }, []);

  const toggleFashionColor = React.useCallback(
    (colorName: string) => {
      if (defaults?.id) {
        setColorInput((current) => (current === colorName ? "" : colorName));
        return;
      }

      const nextSelectedColors = selectedColors.includes(colorName)
        ? selectedColors.filter((item) => item !== colorName)
        : [...selectedColors, colorName];
      syncCreateColors(nextSelectedColors, customColorsInput);
    },
    [customColorsInput, defaults?.id, selectedColors, syncCreateColors]
  );

  const handleCustomColorsChange = React.useCallback(
    (value: string) => {
      setCustomColorsInput(value);
      syncCreateColors(selectedColors, value);
    },
    [selectedColors, syncCreateColors]
  );

  const isColorSelected = React.useCallback(
    (colorName: string) => {
      if (defaults?.id) return colorInput === colorName;
      return selectedColors.includes(colorName);
    },
    [colorInput, defaults?.id, selectedColors]
  );

  React.useEffect(() => {
    setImagePreviewUrl(defaults?.image_url ?? null);
  }, [defaults?.image_url]);

  const handleImageChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        setImagePreviewUrl(defaults?.image_url ?? null);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      setImagePreviewUrl((current) => {
        if (current?.startsWith("blob:")) {
          URL.revokeObjectURL(current);
        }
        return objectUrl;
      });
    },
    [defaults?.image_url]
  );

  React.useEffect(() => {
    return () => {
      if (imagePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const catalogHint = isFashion
    ? "Podés cargar una sola variante o crear varias combinaciones de talle y color en una sola vez."
    : isGastronomy
      ? "Primera versión para gastronomía: formulario simple para productos de catálogo, sin foco en balanza ni vencimiento."
      : null;

  const content = (
    <>
      <div className="space-y-1">
        <div className="text-base font-semibold tracking-tight">{title}</div>
        {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
        {catalogHint ? <div className="text-sm text-muted-foreground">{catalogHint}</div> : null}
      </div>

      <form action={action} className="mt-5 grid gap-4">
        {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
        <input type="hidden" name="business_type" value={businessType} />

        {defaults?.id && !catalogStyle ? (
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
            {!catalogStyle ? (
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
                    title={barcodeInput.trim() ? "Vacía el campo para generar un EAN interno" : "Generar EAN interno"}
                    disabled={Boolean(barcodeInput.trim())}
                    onClick={generateInternalCode}
                  >
                    <Hash className="size-4" />
                    <span className="sr-only">Generar código interno</span>
                  </Button>
                </div>
                {preloadLoading ? <p className="text-[11px] text-muted-foreground">Buscando datos en la base...</p> : null}
              </div>
            ) : null}

            <div className={cn("grid gap-2", catalogStyle ? "md:col-span-3" : "md:col-span-2")}>
              <Label htmlFor="name">{isFashion ? "Nombre de la prenda" : isGastronomy ? "Nombre del producto" : "Nombre"}</Label>
              <Input id="name" name="name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} required />
            </div>
          </div>

          {preload && !defaults?.id && !catalogStyle ? (
            <div className={cn("mt-3 rounded-xl border border-emerald-500/35 bg-emerald-500/[0.07] p-3 text-left", "dark:bg-emerald-950/25")}>
              <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Datos sugeridos</div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {preloadCategoryPath ? <span className="block">{preloadCategoryPath}</span> : null}
                {preloadSuggestedPrice != null ? <span className="mt-0.5 block">Precio referencia venta: ${preloadSuggestedPrice}</span> : null}
                <span className="mt-1 block text-emerald-700/90 dark:text-emerald-300/90">
                  Revisá precio de compra y stock abajo antes de guardar.
                </span>
              </p>
            </div>
          ) : null}
        </div>

        <div className={cn("grid gap-4", catalogStyle ? "md:grid-cols-2" : "md:grid-cols-3")}>
          {!catalogStyle ? (
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
          ) : (
            <input type="hidden" name="sold_by_weight" value="off" />
          )}

          <div className="grid gap-2">
            <Label htmlFor="category">{catalogStyle ? "Categoría principal" : "Categoría"}</Label>
            <Input id="category" name="category" value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} />
          </div>

          {!catalogStyle ? (
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
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="image_file">Foto del producto</Label>
          <Input id="image_file" name="image_file" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageChange} />
          <p className="text-[11px] text-muted-foreground">Subí una imagen JPG, PNG o WEBP. Recomendado: hasta 2 MB.</p>
          {imagePreviewUrl ? (
            <div className="mt-1 flex items-center gap-3 rounded-xl border border-[var(--pos-border)] p-3">
              <div className="h-20 w-20 overflow-hidden rounded-xl border bg-[var(--pos-surface-2)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreviewUrl} alt="Vista previa del producto" className="h-full w-full object-cover" />
              </div>
              <div className="text-sm text-muted-foreground">
                {defaults?.image_url ? "Si elegís otra imagen, reemplaza la actual." : "Vista previa de la foto a guardar."}
              </div>
            </div>
          ) : null}
        </div>

        {isFashion ? (
          defaults?.id ? (
            <>
              <input type="hidden" name="variant_group" value={defaults.variant_group ?? ""} />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="size">Talle</Label>
                  <Input id="size" name="size" value={sizeInput} onChange={(e) => setSizeInput(e.target.value)} placeholder="Ej: S, M, 38" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="color">Color</Label>
                  <input type="hidden" name="color" value={colorInput} />
                  <div className="grid gap-3 rounded-xl border border-[var(--pos-border)] p-3">
                    <div className="flex flex-wrap gap-2">
                      {FASHION_COLOR_OPTIONS.map((option) => {
                        const active = isColorSelected(option.name);
                        return (
                          <button
                            key={option.name}
                            type="button"
                            onClick={() => toggleFashionColor(option.name)}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition",
                              active
                                ? "border-[var(--pos-accent)] bg-[var(--pos-accent)]/10 text-foreground"
                                : "border-[var(--pos-border)] bg-[var(--pos-surface-2)] text-muted-foreground hover:border-[var(--pos-accent)]/40"
                            )}
                          >
                            <span
                              className="size-4 rounded-full border border-black/10"
                              style={{ backgroundColor: option.swatch }}
                              aria-hidden="true"
                            />
                            {option.name}
                          </button>
                        );
                      })}
                    </div>
                    <Input
                      id="color"
                      value={colorInput}
                      onChange={(e) => setColorInput(e.target.value)}
                      placeholder="O escribí un color personalizado"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <input type="hidden" name="variant_group" value={defaults?.variant_group ?? ""} />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="sizes_input">Talles</Label>
                  <Input
                    id="sizes_input"
                    name="sizes_input"
                    value={sizesInput}
                    onChange={(e) => setSizesInput(e.target.value)}
                    placeholder="Ej: S, M, L, XL"
                  />
                  <p className="text-[11px] text-muted-foreground">Separalos con coma. Si lo dejás vacío, crea una sola variante.</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="custom_colors_input">Colores</Label>
                  <input type="hidden" id="colors_input" name="colors_input" value={colorsInput} />
                  <div className="grid gap-3 rounded-xl border border-[var(--pos-border)] p-3">
                    <div className="flex flex-wrap gap-2">
                      {FASHION_COLOR_OPTIONS.map((option) => {
                        const active = isColorSelected(option.name);
                        return (
                          <button
                            key={option.name}
                            type="button"
                            onClick={() => toggleFashionColor(option.name)}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition",
                              active
                                ? "border-[var(--pos-accent)] bg-[var(--pos-accent)]/10 text-foreground"
                                : "border-[var(--pos-border)] bg-[var(--pos-surface-2)] text-muted-foreground hover:border-[var(--pos-accent)]/40"
                            )}
                          >
                            <span
                              className="size-4 rounded-full border border-black/10"
                              style={{ backgroundColor: option.swatch }}
                              aria-hidden="true"
                            />
                            {option.name}
                          </button>
                        );
                      })}
                    </div>
                    <Input
                      id="custom_colors_input"
                      value={customColorsInput}
                      onChange={(e) => handleCustomColorsChange(e.target.value)}
                      placeholder="Sumar otros colores: Lila, Mostaza, Plateado"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Elegí colores rápidos o agregá otros manualmente. El sistema arma todas las combinaciones entre talles y colores.
                  </p>
                </div>
              </div>
            </>
          )
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="cost">{isFashion ? "Costo de compra" : "Precio compra"}</Label>
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

        {!catalogStyle ? (
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
              <input id="active" name="active" type="checkbox" defaultChecked={defaults?.active ?? true} className="size-4" />
              <Label htmlFor="active">Activo</Label>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <input id="active" name="active" type="checkbox" defaultChecked={defaults?.active ?? true} className="size-4" />
            <Label htmlFor="active">Activo</Label>
          </div>
        )}

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
              <Label htmlFor="stock">{catalogStyle ? "Stock inicial" : "Stock (unidades)"}</Label>
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
              <Label htmlFor="low_stock_threshold">{catalogStyle ? "Stock mínimo" : "Stock mínimo (unidades)"}</Label>
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
          if (defaults?.id && typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
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
