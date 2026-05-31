"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Plus, ScanBarcode, ScanLine, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { ONBOARDING_GUIDE_QUERY, ONBOARDING_GUIDE_TOTAL_STEPS } from "@/app/app/(main)/onboarding/onboarding-guide-constants";
import { OnboardingSpotlight } from "@/app/app/(main)/onboarding/onboarding-spotlight";
import { parseScaleBarcode } from "@/app/app/(main)/pos/utils/scale-barcode";
import { createProduct, deleteProduct, updateProduct } from "@/app/app/(main)/products/actions";
import { ProductCreateMobileWizard } from "@/app/app/(main)/products/product-create-mobile-wizard";
import { ProductForm } from "@/app/app/(main)/products/product-form";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsMobilePos } from "@/hooks/use-is-mobile-pos";
import { cn } from "@/lib/utils";

type ProductRow = {
  id: string;
  name: string;
  barcode: string | null;
  scale_code: string | null;
  category: string | null;
  price: string | number;
  cost: string | number;
  sold_by_weight: boolean;
  stock: number;
  stock_decimal: string | number;
  low_stock_threshold: number;
  low_stock_threshold_decimal: string | number;
  expires_at: string | null;
  active: boolean;
};

type Props = {
  products: ProductRow[];
  canEditPrice?: boolean;
  canEditStock?: boolean;
  /** Recorrido inicial: resaltar «Nuevo producto» y llevar a Caja al guardar. */
  guideProductStep?: boolean;
};

type CreateGuidePhase = "barcode" | "name" | "cost" | "price" | "stock" | "lowStock" | "submit";
type CreateGuideConfirm = {
  cost: boolean;
  price: boolean;
  stock: boolean;
  lowStock: boolean;
};

function resolveProductCreateOnboardingGuide(confirm: CreateGuideConfirm): {
  target: Element | null;
  phase: CreateGuidePhase;
} {
  if (typeof document === "undefined") return { target: null, phase: "barcode" };

  const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
  if (!dialog) return { target: null, phase: "barcode" };

  const q = (sel: string) => dialog.querySelector(sel);

  const barcodeEl = q("#barcode") as HTMLInputElement | null;
  const barcode = barcodeEl?.value?.trim() ?? "";
  if (barcode.length < 6) return { target: barcodeEl ?? dialog, phase: "barcode" };

  const nameEl = q("#name") as HTMLInputElement | null;
  const name = nameEl?.value?.trim() ?? "";
  if (name.length < 2) return { target: nameEl ?? dialog, phase: "name" };

  const costEl = q("#cost") as HTMLInputElement | null;
  const cost = parseFloat(String(costEl?.value ?? ""));
  if (!Number.isFinite(cost) || cost <= 0 || !confirm.cost) return { target: costEl ?? dialog, phase: "cost" };

  const priceEl = q("#price") as HTMLInputElement | null;
  const price = parseFloat(String(priceEl?.value ?? ""));
  if (!Number.isFinite(price) || price <= 0 || !confirm.price) return { target: priceEl ?? dialog, phase: "price" };

  const soldByWeight = (q('input[name="sold_by_weight"]') as HTMLInputElement)?.value === "on";
  const stockSel = soldByWeight ? "#stock_decimal" : "#stock";
  const stockEl = q(stockSel) as HTMLInputElement | null;
  const stock = parseFloat(String(stockEl?.value ?? ""));
  if (!Number.isFinite(stock) || stock <= 0 || !confirm.stock) return { target: stockEl ?? dialog, phase: "stock" };

  const lowStockSel = soldByWeight ? "#low_stock_threshold_decimal" : "#low_stock_threshold";
  const lowStockEl = q(lowStockSel) as HTMLInputElement | null;
  const lowStock = parseFloat(String(lowStockEl?.value ?? ""));
  if (!Number.isFinite(lowStock) || lowStock <= 0 || !confirm.lowStock) {
    return { target: lowStockEl ?? dialog, phase: "lowStock" };
  }

  const submitBtn = dialog.querySelector('form button[type="submit"]') as HTMLButtonElement | null;
  return { target: submitBtn ?? dialog, phase: "submit" };
}

function productCreateGuideHints(phase: CreateGuidePhase): { title: string; description: React.ReactNode } {
  switch (phase) {
    case "barcode":
      return {
        title: "Escaneá el producto",
        description: (
          <>
            Escaneá o escribí el <span className="font-semibold text-foreground">código de barras</span>. Si existe en la
            base, se autocompletan los datos.
          </>
        ),
      };
    case "name":
      return {
        title: "Revisá el nombre sugerido",
        description: (
          <>
            Confirmá el <span className="font-semibold text-foreground">nombre</span> (si no vino completo, ajustalo).
          </>
        ),
      };
    case "cost":
      return {
        title: "Ajustá precio de compra",
        description: (
          <>
            Revisá el <span className="font-semibold text-foreground">precio de compra</span> para que el margen quede
            correcto.
          </>
        ),
      };
    case "price":
      return {
        title: "Ajustá precio de venta",
        description: (
          <>
            Confirmá el <span className="font-semibold text-foreground">precio de venta</span> sugerido y corregilo si hace
            falta.
          </>
        ),
      };
    case "stock":
      return {
        title: "Cargá cantidad inicial",
        description: (
          <>
            Indicá cuánto <span className="font-semibold text-foreground">stock inicial</span> entra (unidades o kg).
          </>
        ),
      };
    case "lowStock":
      return {
        title: "Definí stock mínimo",
        description: (
          <>
            Marcá el <span className="font-semibold text-foreground">stock mínimo</span> para alertas de reposición.
          </>
        ),
      };
    default:
      return {
        title: "Guardá el producto",
        description: (
          <>
            Tocá <span className="font-semibold text-foreground">«Guardar producto»</span> para crearlo y seguir con la
            caja.
          </>
        ),
      };
  }
}

function formatStock(p: ProductRow) {
  return p.sold_by_weight
    ? `Stock: ${p.stock_decimal} | Mín: ${p.low_stock_threshold_decimal}`
    : `Stock: ${p.stock} | Mín: ${p.low_stock_threshold}`;
}

function normCode(s: string) {
  return String(s ?? "").replace(/\s+/g, "").trim().toLowerCase();
}

function findProductByScannedCode(products: ProductRow[], raw: string): ProductRow | undefined {
  const stable = normCode(raw);
  if (!stable) return undefined;

  const exact = products.find((p) => normCode(p.barcode ?? "") === stable);
  if (exact) return exact;

  const parsed = parseScaleBarcode(stable.replace(/\s+/g, ""));
  if (parsed) {
    const sc = (parsed.scaleCode ?? "").toLowerCase();
    return products.find((p) => (p.scale_code ?? "").toLowerCase() === sc);
  }

  return undefined;
}

export function ProductsClient({
  products,
  canEditPrice = true,
  canEditStock = true,
  guideProductStep = false,
}: Props) {
  const router = useRouter();
  const isMobileAssist = useIsMobilePos();
  const [openCreate, setOpenCreate] = React.useState(false);
  const [editProduct, setEditProduct] = React.useState<ProductRow | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [scannerSearchOpen, setScannerSearchOpen] = React.useState(false);

  const newProductHighlightRef = React.useRef<HTMLSpanElement>(null);
  const formGuideTargetRef = React.useRef<Element | null>(null);
  const [formGuideTick, setFormGuideTick] = React.useState(0);
  const [createGuideConfirm, setCreateGuideConfirm] = React.useState<CreateGuideConfirm>({
    cost: false,
    price: false,
    stock: false,
    lowStock: false,
  });

  const [nameQuery, setNameQuery] = React.useState("");
  const [barcodeQuery, setBarcodeQuery] = React.useState("");
  const barcodeSearchRef = React.useRef<HTMLInputElement>(null);

  const filtered = React.useMemo(() => {
    const nq = nameQuery.trim().toLowerCase();
    const bq = normCode(barcodeQuery);

    return products.filter((p) => {
      if (nq && !p.name.toLowerCase().includes(nq)) return false;
      if (bq) {
        const b = normCode(p.barcode ?? "");
        const sc = normCode(p.scale_code ?? "");
        if (!b.includes(bq) && !sc.includes(bq)) return false;
      }
      return true;
    });
  }, [products, nameQuery, barcodeQuery]);

  const hasActiveFilters = Boolean(nameQuery.trim() || normCode(barcodeQuery));

  const onCreate = React.useCallback(
    async (formData: FormData) => {
      startTransition(() => {
        (async () => {
          try {
            await createProduct(formData);
            toast.success("Producto creado");
            setOpenCreate(false);
            if (guideProductStep) {
              router.push(`/app/cash?${ONBOARDING_GUIDE_QUERY}=cash`);
              return;
            }
            router.refresh();
          } catch (err) {
            toast.error("No se pudo crear", {
              description: err instanceof Error ? err.message : "Error",
            });
          }
        })();
      });
    },
    [guideProductStep, router]
  );

  const onUpdate = React.useCallback(
    async (formData: FormData) => {
      startTransition(() => {
        (async () => {
          try {
            await updateProduct(formData);
            toast.success("Producto actualizado");
            setEditProduct(null);
            router.refresh();
          } catch (err) {
            toast.error("No se pudo guardar", {
              description: err instanceof Error ? err.message : "Error",
            });
          }
        })();
      });
    },
    [router]
  );

  const onDelete = React.useCallback(
    async (id: string) => {
      const ok = window.confirm("¿Borrar este producto? Esta acción no se puede deshacer.");
      if (!ok) return;

      startTransition(() => {
        (async () => {
          try {
            const fd = new FormData();
            fd.set("id", id);
            await deleteProduct(fd);
            toast.success("Producto borrado");
            if (editProduct?.id === id) setEditProduct(null);
            router.refresh();
          } catch (err) {
            toast.error("No se pudo borrar", {
              description: err instanceof Error ? err.message : "Error",
            });
          }
        })();
      });
    },
    [router, editProduct?.id]
  );

  const openEdit = React.useCallback((p: ProductRow) => {
    setOpenCreate(false);
    setEditProduct(p);
  }, []);

  const handleBarcodeKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const raw = barcodeSearchRef.current?.value ?? barcodeQuery;
      const found = findProductByScannedCode(products, raw);
      if (found) {
        openEdit(found);
        setBarcodeQuery("");
      } else {
        toast.error("No hay producto con ese código", {
          description: "Verificá el código o cargalo en el producto.",
        });
      }
    },
    [barcodeQuery, products, openEdit]
  );

  const showProductSpotlight = guideProductStep && !openCreate;

  React.useEffect(() => {
    if (!openCreate) {
      setCreateGuideConfirm({ cost: false, price: false, stock: false, lowStock: false });
      return;
    }
    if (isMobileAssist || !guideProductStep) return;
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!dialog) return;

    const markIfValid = (id: string) => {
      const el = dialog.querySelector(`#${id}`) as HTMLInputElement | null;
      const n = parseFloat(String(el?.value ?? ""));
      return Number.isFinite(n) && n > 0;
    };

    const onFocusOut = (ev: Event) => {
      const t = ev.target as HTMLElement | null;
      if (!(t instanceof HTMLInputElement)) return;

      if (t.id === "price") {
        if (markIfValid("price")) setCreateGuideConfirm((prev) => ({ ...prev, price: true }));
        return;
      }
      if (t.id === "cost") {
        if (markIfValid("cost")) setCreateGuideConfirm((prev) => ({ ...prev, cost: true }));
        return;
      }
      if (t.id === "stock" || t.id === "stock_decimal") {
        if (markIfValid(t.id)) setCreateGuideConfirm((prev) => ({ ...prev, stock: true }));
        return;
      }
      if (t.id === "low_stock_threshold" || t.id === "low_stock_threshold_decimal") {
        if (markIfValid(t.id)) setCreateGuideConfirm((prev) => ({ ...prev, lowStock: true }));
      }
    };

    dialog.addEventListener("focusout", onFocusOut, true);
    return () => dialog.removeEventListener("focusout", onFocusOut, true);
  }, [openCreate, isMobileAssist, guideProductStep]);

  React.useEffect(() => {
    if (!guideProductStep || !openCreate || isMobileAssist) return undefined;
    const id = window.setInterval(() => setFormGuideTick((x) => x + 1), 180);
    return () => clearInterval(id);
  }, [guideProductStep, openCreate, isMobileAssist]);

  React.useLayoutEffect(() => {
    if (!guideProductStep || !openCreate || isMobileAssist) {
      formGuideTargetRef.current = null;
      return;
    }
    formGuideTargetRef.current = resolveProductCreateOnboardingGuide(createGuideConfirm).target;
  }, [guideProductStep, openCreate, formGuideTick, isMobileAssist, createGuideConfirm]);

  const createGuidePhase = React.useMemo(() => {
    if (!guideProductStep || !openCreate || isMobileAssist) return null;
    return resolveProductCreateOnboardingGuide(createGuideConfirm).phase;
  }, [guideProductStep, openCreate, formGuideTick, isMobileAssist, createGuideConfirm]);

  const showCreateFormSpotlight = Boolean(guideProductStep && openCreate && !isMobileAssist);
  const createFormGuideCopy = productCreateGuideHints(createGuidePhase ?? "name");

  React.useEffect(() => {
    if (!guideProductStep || !openCreate || isMobileAssist) return undefined;
    const idsByPhase: Record<CreateGuidePhase, string[]> = {
      barcode: ["barcode"],
      name: ["name"],
      cost: ["cost"],
      price: ["price"],
      stock: ["stock", "stock_decimal"],
      lowStock: ["low_stock_threshold", "low_stock_threshold_decimal"],
      submit: [],
    };
    const t = window.setTimeout(() => {
      const phase = createGuidePhase ?? "barcode";
      const ids = idsByPhase[phase];
      for (const id of ids) {
        const el = document.getElementById(id) as HTMLElement | null;
        if (!el) continue;
        el.focus({ preventScroll: true });
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }, 260);
    return () => window.clearTimeout(t);
  }, [guideProductStep, openCreate, isMobileAssist, createGuidePhase]);

  React.useEffect(() => {
    if (!showProductSpotlight) return undefined;
    const rafId = window.requestAnimationFrame(() => {
      const wrap = newProductHighlightRef.current;
      if (!wrap) return;
      wrap.scrollIntoView({ block: "center", behavior: "smooth" });
      wrap.querySelector("button")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [showProductSpotlight]);

  return (
    <div className="relative mt-6">
      <OnboardingSpotlight
        active={showProductSpotlight}
        targetRef={newProductHighlightRef}
        stackBase={88}
        dimBackground={false}
        stepIndex={2}
        totalSteps={ONBOARDING_GUIDE_TOTAL_STEPS}
        title="Tu primer producto"
        description={
          <>
            <span className="font-semibold text-foreground">Tocá el botón verde «Nuevo producto»</span> arriba a la
            derecha: es lo único que se ve nítido y titila. El resto queda borroso a propósito.
          </>
        }
      />

      <OnboardingSpotlight
        active={showCreateFormSpotlight}
        targetRef={formGuideTargetRef}
        stackBase={96}
        dimBackground={false}
        remeasureSignal={formGuideTick}
        stepIndex={2}
        totalSteps={ONBOARDING_GUIDE_TOTAL_STEPS}
        title={createFormGuideCopy.title}
        description={createFormGuideCopy.description}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          {hasActiveFilters
            ? `Mostrando ${filtered.length} de ${products.length} productos`
            : `${products.length} productos`}
        </div>
        <span
          ref={newProductHighlightRef}
          className={cn(
            "inline-flex flex-col items-end gap-2 sm:items-center",
            showProductSpotlight && "relative z-[92]"
          )}
        >
          {showProductSpotlight ? (
            <span className="pointer-events-none rounded-full bg-emerald-600 px-3 py-1.5 text-center text-[11px] font-bold uppercase leading-none tracking-wide text-white shadow-lg shadow-emerald-900/30 ring-2 ring-white/80 ring-offset-2 ring-offset-transparent animate-pulse">
              Paso 1 · Tocá acá
            </span>
          ) : null}
          <Button
            type="button"
            onClick={() => {
              setEditProduct(null);
              setOpenCreate(true);
            }}
            className={cn(
              "gap-2 rounded-2xl font-semibold",
              showProductSpotlight
                ? "animate-onboarding-product-pulse relative min-h-12 min-w-[min(100vw-2rem,280px)] border-2 border-white/90 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-8 text-base font-bold text-white hover:brightness-110 hover:saturate-110 md:min-w-[260px]"
                : "h-10"
            )}
          >
            <Plus className={cn("size-4", showProductSpotlight && "size-5")} />
            Nuevo producto
          </Button>
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="product-search-name" className="text-xs text-muted-foreground">
            Buscar por nombre
          </Label>
          <Input
            id="product-search-name"
            type="search"
            placeholder="Ej: oreo, leche…"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            className="h-10 rounded-xl"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="product-search-barcode" className="text-xs text-muted-foreground">
            Código de barras
          </Label>
          <div className="relative">
            <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={barcodeSearchRef}
              id="product-search-barcode"
              type="text"
              inputMode="numeric"
              placeholder="Filtrar o escanear y Enter"
              value={barcodeQuery}
              onChange={(e) => setBarcodeQuery(e.target.value)}
              onKeyDown={handleBarcodeKeyDown}
              className="h-10 rounded-xl pl-9"
              autoComplete="off"
            />
          </div>
          <p className="hidden text-[11px] text-muted-foreground lg:block">
            Enfocá este campo y escaneá: al terminar (Enter) se abre la edición.
          </p>
        </div>
      </div>

      {isMobileAssist ? (
        <div className="mt-3 lg:hidden">
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full gap-2 rounded-xl border-emerald-600/40 bg-[var(--pos-surface)] font-semibold"
            onClick={() => setScannerSearchOpen(true)}
          >
            <ScanLine className="size-5" />
            Escanear para buscar y editar
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Lee el código de un producto ya cargado y se abre el formulario para ajustar stock y precios.
          </p>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
        <div className="overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-[var(--pos-surface-2)] text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium">Producto</th>
                <th className="px-4 py-3 text-left font-medium">Stock</th>
                <th className="px-4 py-3 text-left font-medium">Precio</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    {products.length === 0
                      ? "No hay productos cargados."
                      : "Ningún producto coincide con la búsqueda."}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[p.barcode ? `EAN: ${p.barcode}` : null, p.expires_at ? `Vence: ${p.expires_at}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatStock(p)}</td>
                    <td className="px-4 py-3 font-numeric">${p.price}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-lg border px-2 py-1 text-[11px] font-medium",
                          p.active
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-[var(--pos-border)] bg-[var(--pos-surface-2)] text-muted-foreground"
                        )}
                      >
                        {p.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 gap-2 rounded-xl border-[var(--pos-border)] bg-[var(--pos-surface)] text-xs hover:bg-[var(--pos-surface-2)]"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="size-3.5" />
                          Editar
                        </Button>
                        <Button type="button" variant="outline" size="icon" onClick={() => onDelete(p.id)}>
                          <Trash2 className="size-4" />
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
        {openCreate ? (
          <motion.div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4 max-lg:p-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpenCreate(false);
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-create-title"
          >
            <motion.div
              className={cn(
                "flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--pos-border)] bg-card shadow-xl",
                "max-lg:fixed max-lg:inset-0 max-lg:h-[100dvh] max-lg:max-h-none max-lg:max-w-none max-lg:rounded-none max-lg:border-0"
              )}
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex shrink-0 items-center justify-between border-b px-5 py-4 max-lg:pt-[max(1rem,env(safe-area-inset-top))]">
                <div>
                  <div id="modal-create-title" className="text-base font-semibold tracking-tight max-lg:text-lg">
                    Nuevo producto
                  </div>
                  <div className="text-xs text-muted-foreground max-lg:hidden">
                    Cargá datos, precio y stock.
                  </div>
                  <div className="text-[11px] text-muted-foreground lg:hidden">
                    Asistente paso a paso: código, datos, precios y stock.
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setOpenCreate(false)}>
                  <X className="size-4" />
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <div className={cn(pending ? "pointer-events-none opacity-80" : "")}>
                  {isMobileAssist ? (
                    <ProductCreateMobileWizard
                      action={onCreate}
                      canEditPrice={canEditPrice}
                      canEditStock={canEditStock}
                    />
                  ) : (
                    <ProductForm
                      title=""
                      description={undefined}
                      container={false}
                      action={onCreate}
                      canEditPrice={canEditPrice}
                      canEditStock={canEditStock}
                      submitPulse={showCreateFormSpotlight && createGuidePhase === "submit"}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {editProduct ? (
          <motion.div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4 max-lg:p-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setEditProduct(null);
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-edit-title"
          >
            <motion.div
              className={cn(
                "flex max-h-[min(90vh,920px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--pos-border)] bg-card shadow-xl",
                "max-lg:fixed max-lg:inset-0 max-lg:h-[100dvh] max-lg:max-h-none max-lg:max-w-none max-lg:rounded-none max-lg:border-0"
              )}
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex shrink-0 items-center justify-between border-b px-5 py-4 max-lg:pt-[max(1rem,env(safe-area-inset-top))]">
                <div>
                  <div id="modal-edit-title" className="text-base font-semibold tracking-tight max-lg:text-lg">
                    Editar producto
                  </div>
                  <div className="text-xs text-muted-foreground max-lg:hidden">
                    Actualizá precios, stock y código.
                  </div>
                  <div className="text-[11px] text-muted-foreground lg:hidden">
                    Podés escanear para cambiar el código o ajustar stock.
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setEditProduct(null)}>
                  <X className="size-4" />
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <div className={cn(pending ? "pointer-events-none opacity-80" : "")}>
                  <ProductForm
                    key={editProduct.id}
                    title={editProduct.name}
                    description="El precio de venta se recalcula en base a costo y margen."
                    container={false}
                    defaults={{
                      id: editProduct.id,
                      name: editProduct.name,
                      barcode: editProduct.barcode,
                      scale_code: editProduct.scale_code,
                      category: editProduct.category,
                      cost: Number(editProduct.cost),
                      price: Number(editProduct.price),
                      expires_at: editProduct.expires_at,
                      sold_by_weight: editProduct.sold_by_weight,
                      stock: Number(editProduct.stock),
                      stock_decimal: Number(editProduct.stock_decimal),
                      low_stock_threshold: Number(editProduct.low_stock_threshold),
                      low_stock_threshold_decimal: Number(editProduct.low_stock_threshold_decimal),
                      active: editProduct.active,
                    }}
                    action={onUpdate}
                    canEditPrice={canEditPrice}
                    canEditStock={canEditStock}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <BarcodeScanner
        open={scannerSearchOpen}
        continuous={false}
        steppedAfterSuccess={false}
        onClose={() => setScannerSearchOpen(false)}
        onDecoded={(raw) => {
          const code = raw.replace(/\s+/g, "").trim();
          if (!code) return false;
          const found = findProductByScannedCode(products, code);
          if (found) {
            openEdit(found);
            setBarcodeQuery("");
            toast.success("Producto encontrado", { description: found.name, duration: 1200 });
            return true;
          }
          toast.error("No hay producto con ese código", {
            description: "Creá uno nuevo con «Nuevo producto» o revisá el código.",
          });
          return false;
        }}
      />
    </div>
  );
}
