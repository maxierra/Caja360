"use client";

import * as React from "react";
import "./etiquetas-print.css";
import { toast } from "sonner";
import { Printer, ScanLine } from "lucide-react";

import { findProductByScan, type ProductLabelRow } from "@/app/app/(main)/etiquetas/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function moneyAr(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

function clampQty(value: number) {
  return Math.min(200, Math.max(1, Math.floor(value) || 1));
}

function toPrice(value: number | string) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function barcodeValue(p: ProductLabelRow) {
  const v = (p.barcode ?? "").trim() || (p.sku ?? "").trim();
  if (v.length > 0) return v;
  return p.id.replace(/-/g, "").slice(0, 12);
}

type SelectionMap = Record<string, { qty: number }>;

type PrintLabelItem = { product: ProductLabelRow; qty: number };

export function EtiquetasClient({
  businessName,
  products,
}: {
  businessName: string;
  products: ProductLabelRow[];
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const printRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const qtyInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const [scan, setScan] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [product, setProduct] = React.useState<ProductLabelRow | null>(null);
  const [copies, setCopies] = React.useState(1);
  const [selection, setSelection] = React.useState<SelectionMap>({});
  const [tableQuery, setTableQuery] = React.useState("");
  const [printSlots, setPrintSlots] = React.useState<ProductLabelRow[] | null>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredProducts = React.useMemo(() => {
    const q = tableQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const hay = `${p.name} ${p.sku ?? ""} ${p.barcode ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, tableQuery]);

  const selectedCount = Object.keys(selection).length;
  const totalSelectedLabels = React.useMemo(
    () => Object.values(selection).reduce((sum, entry) => sum + clampQty(entry.qty), 0),
    [selection]
  );

  const selectProductInTable = React.useCallback((p: ProductLabelRow, focusQty = false) => {
    setSelection((prev) => ({ ...prev, [p.id]: { qty: prev[p.id]?.qty ?? 1 } }));
    if (focusQty) {
      requestAnimationFrame(() => {
        const row = document.getElementById(`label-row-${p.id}`);
        row?.scrollIntoView({ behavior: "smooth", block: "center" });
        const qtyInput = qtyInputRefs.current[p.id];
        if (qtyInput) {
          qtyInput.focus();
          qtyInput.select();
        }
      });
    }
  }, []);

  const lookup = React.useCallback(async () => {
    const q = scan.trim();
    if (!q) {
      toast.error("Ingresá un código o escaneá el producto");
      return;
    }
    setLoading(true);
    try {
      const p = await findProductByScan(q);
      if (!p) {
        setProduct(null);
        toast.error("No encontramos un producto con ese código.");
        return;
      }
      setProduct(p);
      selectProductInTable(p, true);
      toast.success("Producto encontrado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [scan, selectProductInTable]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void lookup();
      }
    },
    [lookup]
  );

  const buildPrintSlots = React.useCallback((items: PrintLabelItem[]) => {
    const slots: ProductLabelRow[] = [];
    for (const { product: p, qty } of items) {
      const n = clampQty(qty);
      for (let i = 0; i < n; i += 1) slots.push(p);
    }
    return slots;
  }, []);

  React.useEffect(() => {
    if (!printSlots || printSlots.length === 0) return;

    let cancelled = false;
    void (async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      if (cancelled) return;

      const root = printRef.current;
      if (!root) {
        setPrintSlots(null);
        return;
      }

      const svgs = root.querySelectorAll<SVGSVGElement>("[data-barcode-slot]");
      if (svgs.length === 0) {
        setPrintSlots(null);
        return;
      }

      const JsBarcode = (await import("jsbarcode")).default;
      svgs.forEach((svg, i) => {
        const slotProduct = printSlots[i];
        if (!slotProduct) return;
        const code = barcodeValue(slotProduct);
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        try {
          JsBarcode(svg, code, {
            format: "CODE128",
            width: 1.15,
            height: 36,
            displayValue: true,
            fontSize: 10,
            margin: 4,
          });
        } catch {
          /* código no compatible con CODE128 */
        }
      });

      const done = () => {
        window.removeEventListener("afterprint", done);
        setPrintSlots(null);
      };
      window.addEventListener("afterprint", done);
      window.print();
    })();

    return () => {
      cancelled = true;
    };
  }, [printSlots]);

  const startPrint = React.useCallback(
    (items: PrintLabelItem[]) => {
      const slots = buildPrintSlots(items);
      if (slots.length === 0) return;
      setPrintSlots(slots);
    },
    [buildPrintSlots]
  );

  const runPrintSingle = React.useCallback(() => {
    if (!product) return;
    startPrint([{ product, qty: copies }]);
  }, [copies, product, startPrint]);

  const runPrintBatch = React.useCallback(() => {
    const items: PrintLabelItem[] = [];
    for (const [id, entry] of Object.entries(selection)) {
      const p = products.find((row) => row.id === id);
      if (!p) continue;
      items.push({ product: p, qty: entry.qty });
    }
    if (items.length === 0) {
      toast.error("Seleccioná al menos un producto");
      return;
    }
    startPrint(items);
  }, [products, selection, startPrint]);

  const toggleRow = React.useCallback((id: string, checked: boolean) => {
    if (checked) {
      setSelection((prev) => ({ ...prev, [id]: { qty: prev[id]?.qty ?? 1 } }));
      return;
    }
    setSelection((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const setRowQty = React.useCallback((id: string, raw: string) => {
    const qty = clampQty(Number(raw));
    setSelection((prev) => ({ ...prev, [id]: { qty } }));
  }, []);

  const selectAllFiltered = React.useCallback(() => {
    setSelection((prev) => {
      const next = { ...prev };
      for (const p of filteredProducts) {
        next[p.id] = { qty: prev[p.id]?.qty ?? 1 };
      }
      return next;
    });
  }, [filteredProducts]);

  const deselectAllFiltered = React.useCallback(() => {
    setSelection((prev) => {
      const next = { ...prev };
      for (const p of filteredProducts) {
        delete next[p.id];
      }
      return next;
    });
  }, [filteredProducts]);

  const bc = product ? barcodeValue(product) : "";

  const downloadPng = React.useCallback(async () => {
    if (!product) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = 600;
    const height = 400;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#555555";
    ctx.font = "bold 18px Arial";
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    ctx.fillText(businessName.toUpperCase(), width / 2, 18);

    ctx.fillStyle = "#000000";
    ctx.font = "bold 22px Arial";
    const maxWidth = width - 60;
    const words = product.name.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const test = current ? current + " " + w : w;
      const m = ctx.measureText(test);
      if (m.width > maxWidth && current) {
        lines.push(current);
        current = w;
        if (lines.length === 1) break;
      } else {
        current = test;
      }
    }
    if (lines.length < 2 && current) {
      lines.push(current);
    }
    let textY = 50;
    for (const line of lines) {
      ctx.fillText(line, width / 2, textY);
      textY += 26;
    }

    ctx.textAlign = "center";
    ctx.font = "bold 34px Arial";
    ctx.fillStyle = "#000000";
    ctx.fillText(moneyAr(toPrice(product.price)), width / 2, 130);

    const code = barcodeValue(product);
    const JsBarcode = (await import("jsbarcode")).default;
    const barcodeCanvas = document.createElement("canvas");
    try {
      JsBarcode(barcodeCanvas, code, {
        format: "CODE128",
        width: 2,
        height: 90,
        displayValue: true,
        fontSize: 18,
        margin: 8,
      });
      const bx = (width - barcodeCanvas.width) / 2;
      const by = height - barcodeCanvas.height - 40;
      ctx.drawImage(barcodeCanvas, bx, by);
    } catch {
      // ignore barcode errors
    }

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `etiqueta-${product.id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [businessName, product]);

  return (
    <>
      <div className="etiquetas-ui mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Etiquetas de góndola</h1>
          <p className="text-sm text-muted-foreground">
            Escaneá o escribí el código de barras / SKU, o seleccioná productos de la lista para imprimir en lote.
          </p>
        </div>

        <Card className="overflow-hidden border-primary/20">
          <CardHeader className="border-b bg-primary/5">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ScanLine className="size-5" />
              Buscar producto
            </CardTitle>
            <CardDescription>
              El lector USB suele escribir el código y pulsar Enter; también podés pegar el código manualmente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="scan">Código de barras o SKU</Label>
                <Input
                  id="scan"
                  ref={inputRef}
                  value={scan}
                  onChange={(e) => setScan(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Escaneá aquí…"
                  autoComplete="off"
                  className="font-mono text-base"
                />
              </div>
              <Button type="button" onClick={() => void lookup()} disabled={loading}>
                {loading ? "Buscando…" : "Buscar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {product ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vista previa</CardTitle>
                <CardDescription>Así se verá la etiqueta.</CardDescription>
              </CardHeader>
              <CardContent>
                <ShelfLabelPreview businessName={businessName} product={product} code={bc} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Imprimir</CardTitle>
                <CardDescription>Cantidad de etiquetas iguales para la góndola (máx. 200).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="copies">Copias</Label>
                  <Input
                    id="copies"
                    type="number"
                    min={1}
                    max={200}
                    value={copies}
                    onChange={(e) => setCopies(Number(e.target.value) || 1)}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" className="w-full gap-2 sm:w-auto" onClick={runPrintSingle}>
                    <Printer className="size-4" />
                    Imprimir etiquetas
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 sm:w-auto"
                    onClick={() => void downloadPng()}
                  >
                    Descargar como imagen
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Se abre el diálogo de impresión del sistema; podés guardar como PDF. Las etiquetas están optimizadas para papel
                  continuo o hoja A4.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <Card className="mt-8 overflow-hidden">
          <CardHeader className="border-b bg-[var(--pos-surface-2)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">Productos</CardTitle>
                <CardDescription>
                  Seleccioná los productos y la cantidad de etiquetas por ítem.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>
                  Seleccionar todos
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={deselectAllFiltered}>
                  Deseleccionar todos
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="table-query">Filtrar por nombre o código</Label>
              <Input
                id="table-query"
                value={tableQuery}
                onChange={(e) => setTableQuery(e.target.value)}
                placeholder="Nombre, SKU, código de barras…"
                className="h-10 rounded-xl"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Mostrando {filteredProducts.length} de {products.length} productos
              {selectedCount > 0 ? ` · ${selectedCount} seleccionados (${totalSelectedLabels} etiquetas)` : null}
            </p>

            <div className="overflow-hidden rounded-2xl border bg-card">
              <div className="overflow-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-[var(--pos-surface-2)] text-muted-foreground">
                    <tr className="border-b">
                      <th className="w-12 px-4 py-3 text-left font-medium">
                        <span className="sr-only">Seleccionar</span>
                      </th>
                      <th className="px-4 py-3 text-left font-medium">Producto</th>
                      <th className="px-4 py-3 text-left font-medium">Código</th>
                      <th className="px-4 py-3 text-left font-medium">Precio</th>
                      <th className="px-4 py-3 text-left font-medium">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                          {products.length === 0
                            ? "No hay productos activos para mostrar."
                            : "No hay productos con ese filtro."}
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const checked = Boolean(selection[p.id]);
                        const qty = selection[p.id]?.qty ?? 1;
                        const codeLabel = (p.barcode ?? "").trim() || (p.sku ?? "").trim() || "—";

                        return (
                          <tr
                            key={p.id}
                            id={`label-row-${p.id}`}
                            className={cn(
                              "border-b last:border-b-0",
                              checked && "bg-primary/5"
                            )}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleRow(p.id, e.target.checked)}
                                className="size-4 rounded border-input"
                                aria-label={`Seleccionar ${p.name}`}
                              />
                            </td>
                            <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{codeLabel}</td>
                            <td className="px-4 py-3 tabular-nums">{moneyAr(toPrice(p.price))}</td>
                            <td className="px-4 py-3">
                              <Input
                                ref={(el) => {
                                  qtyInputRefs.current[p.id] = el;
                                }}
                                type="number"
                                min={1}
                                max={200}
                                value={qty}
                                disabled={!checked}
                                onChange={(e) => setRowQty(p.id, e.target.value)}
                                className="h-9 w-24 rounded-xl"
                                aria-label={`Cantidad de etiquetas para ${p.name}`}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Máx. 200 etiquetas por producto. La impresión en lote abre un solo trabajo con todas las etiquetas.
              </p>
              <Button
                type="button"
                className="gap-2"
                disabled={selectedCount === 0}
                onClick={runPrintBatch}
              >
                <Printer className="size-4" />
                Imprimir seleccionadas ({selectedCount})
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {printSlots && printSlots.length > 0 ? (
        <div
          ref={printRef}
          className="etiquetas-print-area fixed left-[-9999px] top-0 z-[-1] w-[min(100vw,820px)] bg-white p-4"
          aria-hidden
        >
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(82mm, 1fr))" }}
          >
            {printSlots.map((slotProduct, i) => (
              <div
                key={`${slotProduct.id}-${i}`}
                className="flex h-[42mm] w-[82mm] flex-col justify-between border border-neutral-400 bg-white p-3 text-black print:break-inside-avoid"
              >
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-neutral-600">{businessName}</p>
                  <p className="line-clamp-2 text-sm font-bold leading-tight">{slotProduct.name}</p>
                </div>
                <p className="text-2xl font-semibold tabular-nums text-neutral-900">
                  {moneyAr(toPrice(slotProduct.price))}
                </p>
                <svg data-barcode-slot className="mx-auto max-h-[40mm] w-full" />
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <canvas ref={canvasRef} className="hidden" aria-hidden />
    </>
  );
}

function ShelfLabelPreview({
  businessName,
  product,
  code,
}: {
  businessName: string;
  product: ProductLabelRow;
  code: string;
}) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let cancelled = false;
    void (async () => {
      const JsBarcode = (await import("jsbarcode")).default;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      if (cancelled) return;
      try {
        JsBarcode(svg, code, {
          format: "CODE128",
          width: 1.15,
          height: 36,
          displayValue: true,
          fontSize: 10,
          margin: 4,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, product.id]);

  return (
    <div className="mx-auto flex h-[42mm] w-full max-w-[82mm] flex-col justify-between border-2 border-neutral-800 bg-white p-3 text-black shadow-sm">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-neutral-600">{businessName}</p>
        <p className="line-clamp-2 text-sm font-bold leading-tight">{product.name}</p>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-neutral-900">{moneyAr(toPrice(product.price))}</p>
      <svg ref={svgRef} className="mx-auto max-h-[40mm] w-full" />
    </div>
  );
}
