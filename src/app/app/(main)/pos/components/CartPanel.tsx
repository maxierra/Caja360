"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ScanLine, Trash2 } from "lucide-react";

import type { CartItem } from "@/app/app/(main)/pos/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  items: CartItem[];
  total: number;
  contextLabel?: string | null;
  pending: boolean;
  onInc: (item: CartItem) => void;
  onDec: (item: CartItem) => void;
  onSetQty: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
  onOpenPayment: () => void;
  onFocusScanner: () => void;
  lastAddedProductId?: string | null;
  guidePanelRef?: React.RefObject<HTMLDivElement | null>;
  guideCobrarRef?: React.RefObject<HTMLDivElement | null>;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round0(n: number) {
  return Math.round(n);
}

export function CartPanel({
  items,
  total,
  contextLabel,
  pending,
  onInc,
  onDec,
  onSetQty,
  onRemove,
  onOpenPayment,
  onFocusScanner,
  lastAddedProductId,
  guidePanelRef,
  guideCobrarRef,
}: Props) {
  const [gramsDraftById, setGramsDraftById] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    setGramsDraftById((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const it of items) {
        if (!it.sold_by_weight) continue;
        if (next[it.product_id] === undefined) {
          next[it.product_id] = String(round0(it.quantity * 1000));
          changed = true;
        }
      }
      for (const id of Object.keys(next)) {
        if (!items.some((x) => x.product_id === id && x.sold_by_weight)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items]);

  const commitGrams = React.useCallback(
    (productId: string) => {
      const raw = gramsDraftById[productId] ?? "";
      const grams = Number(String(raw).trim());
      if (!Number.isFinite(grams)) return;
      const kg = grams / 1000;
      onSetQty(productId, kg);
    },
    [gramsDraftById, onSetQty]
  );

  const revertGrams = React.useCallback(
    (item: CartItem) => {
      setGramsDraftById((prev) => ({ ...prev, [item.product_id]: String(round0(item.quantity * 1000)) }));
    },
    []
  );

  return (
    <div ref={guidePanelRef} className="flex h-full flex-col">
      {/* Header: Total centralizado y destacado */}
      <div className="border-b border-[var(--pos-border)] bg-gradient-to-b from-emerald-50 to-white p-4 dark:from-emerald-950/20 dark:to-transparent">
        <div className="text-center">
          <div className="text-[11px] font-medium uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Total a cobrar
          </div>
          {contextLabel ? <div className="mt-1 text-xs font-medium text-muted-foreground">{contextLabel}</div> : null}
          <div className="font-numeric text-4xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={String(total)}
                initial={{ y: 10, opacity: 0, filter: "blur(4px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                exit={{ y: -10, opacity: 0, filter: "blur(4px)" }}
                transition={{ duration: 0.18 }}
                className="inline-block"
              >
                ${total}
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{items.length} {items.length === 1 ? "producto" : "productos"}</div>
        </div>
      </div>

      {/* Lista de items */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 pr-4">
        {items.length === 0 ? (
          <div className="flex min-h-[min(42dvh,320px)] flex-col items-center justify-center gap-3 p-6 text-center lg:min-h-0">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ScanLine className="size-8" strokeWidth={1.75} />
            </div>
            <div className="text-base font-semibold tracking-tight">Tu carrito</div>
            <div className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              <span className="block lg:hidden">
                Tocá <strong>Escanear</strong>: leés un código, te mostramos el producto y elegís si seguís
                escaneando o cerrás el lector. Más unidades del mismo ítem: botón{" "}
                <strong className="text-foreground">+</strong> en la línea.
              </span>
              <span className="hidden lg:block">Escaneá un código o tocá un producto en la lista.</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            {items.map((item) => {
              const highlight = lastAddedProductId === item.product_id;
              const lineTotal = round2(item.quantity * item.unit_price);
              return (
                <div
                  key={item.product_id}
                  className={cn(
                    "rounded-xl border border-[var(--pos-border)] bg-[var(--pos-surface-2)] px-2.5 py-2 transition-shadow",
                    highlight
                      ? "border-emerald-300 shadow-md shadow-emerald-100 dark:border-emerald-700 dark:shadow-emerald-900/30"
                      : ""
                  )}
                >
                  {/* Fila 1: nombre + precio línea + basura */}
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold">{item.name}</div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          ${item.unit_price}{item.sold_by_weight ? "/kg" : " c/u"}
                        </span>
                        <span className="whitespace-nowrap text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          ${lineTotal}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(item.product_id)}
                      className="ml-1 flex size-7 shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100 hover:text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>

                  {/* Fila 2: controles de cantidad */}
                  <div className="mt-1.5 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 px-0.5 lg:hidden">
                      <span className="text-[10px] font-medium text-muted-foreground">Cantidad</span>
                      <span className="text-[10px] text-muted-foreground">Más del mismo: +</span>
                    </div>
                    <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Quitar una unidad"
                      title="Quitar una unidad"
                      onClick={() => onDec(item)}
                      className="flex size-9 shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40 lg:size-8"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <div className="relative">
                      <Input
                        id={`qty-input-${item.product_id}`}
                        value={
                          item.sold_by_weight
                            ? (gramsDraftById[item.product_id] || String(round0(item.quantity * 1000)))
                            : item.quantity
                        }
                        onChange={(e) => {
                          if (!item.sold_by_weight) {
                            onSetQty(item.product_id, Number(e.target.value) || 0);
                            return;
                          }
                          setGramsDraftById((prev) => ({ ...prev, [item.product_id]: e.target.value }));
                        }}
                        onBlur={() => {
                          if (!item.sold_by_weight) return;
                          commitGrams(item.product_id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (item.sold_by_weight) commitGrams(item.product_id);
                            (e.currentTarget as HTMLInputElement).blur();
                            onFocusScanner();
                            return;
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            if (item.sold_by_weight) revertGrams(item);
                            (e.currentTarget as HTMLInputElement).blur();
                            onFocusScanner();
                          }
                        }}
                        type="number"
                        step={item.sold_by_weight ? 10 : 1}
                        inputMode={item.sold_by_weight ? "decimal" : "numeric"}
                        className={cn(
                          "h-8 rounded-md bg-[var(--pos-surface)] text-center text-xs font-medium",
                          "border border-[var(--pos-border)]",
                          item.sold_by_weight ? "w-20 pr-6" : "w-14"
                        )}
                      />
                      {item.sold_by_weight ? (
                        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] font-medium text-muted-foreground">
                          g
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      aria-label="Agregar una unidad del mismo producto"
                      title="Agregar una unidad"
                      onClick={() => onInc(item)}
                      className="flex size-9 shrink-0 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-900/40 lg:size-8"
                    >
                      <Plus className="size-4" strokeWidth={2.5} />
                    </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer: Botón Cobrar */}
      <div className="border-t border-[var(--pos-border)] p-4">
        <span ref={guideCobrarRef} className="block rounded-2xl">
          <Button
            type="button"
            className={cn(
              "relative h-14 w-full rounded-2xl text-lg font-bold",
              "bg-emerald-600 text-white hover:bg-emerald-700",
              "shadow-lg shadow-emerald-200 dark:shadow-emerald-900/40",
              "disabled:bg-zinc-300 disabled:shadow-none dark:disabled:bg-zinc-700"
            )}
            disabled={pending || items.length === 0}
            onClick={onOpenPayment}
          >
            <span className="absolute inset-0 overflow-hidden rounded-2xl">
              <span
                className={cn(
                  "absolute -left-1/2 top-0 h-full w-1/2",
                  "bg-gradient-to-r from-transparent via-white/20 to-transparent",
                  "[transform:skewX(-20deg)]",
                  items.length > 0 ? "animate-[posShimmer_1.8s_ease-in-out_infinite]" : ""
                )}
              />
            </span>
            <span className="relative flex items-center justify-center gap-2">
              Cobrar ${total}
            </span>
          </Button>
        </span>
      </div>
    </div>
  );
}
