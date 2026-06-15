"use client";

import * as React from "react";

import { ProductCard } from "@/app/app/(main)/pos/components/ProductCard";
import { ProductTableRow } from "@/app/app/(main)/pos/components/ProductTableRow";
import type { PosProduct } from "@/app/app/(main)/pos/hooks/use-products";

type Props = {
  products: PosProduct[];
  onAdd: (p: PosProduct) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  mode?: "table" | "catalog";
  lastAddedProductId?: string | null;
  onConsumeLastAdded?: () => void;
};

export function ProductGrid({
  products,
  onAdd,
  onLoadMore,
  hasMore,
  mode = "table",
  lastAddedProductId,
  onConsumeLastAdded,
}: Props) {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          onLoadMore();
        }
      },
      { root: null, threshold: 0.1 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, onLoadMore]);

  React.useEffect(() => {
    if (!lastAddedProductId) return;
    const t = window.setTimeout(() => {
      onConsumeLastAdded?.();
    }, 250);
    return () => window.clearTimeout(t);
  }, [lastAddedProductId, onConsumeLastAdded]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface)]">
      {mode === "catalog" ? (
        <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
          {products.map((p) => {
            const highlight = lastAddedProductId === p.id;
            const stockValue = p.sold_by_weight ? p.stock_decimal : p.stock;
            const stockState = stockValue <= 0 ? "out" : stockValue < 5 ? "low" : "ok";
            const disabled = stockValue <= 0;
            return (
              <ProductCard
                key={p.id}
                name={p.name}
                imageUrl={p.image_url}
                price={p.price}
                stockLabel={p.sold_by_weight ? `${p.stock_decimal} kg` : `${p.stock} u.`}
                stockState={stockState}
                disabled={disabled}
                highlight={highlight}
                onClick={() => onAdd(p)}
              />
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[var(--pos-surface-2)]/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2.5 pl-4 pr-3 font-medium">Producto</th>
                <th className="px-3 py-2.5 font-medium">Stock</th>
                <th className="px-3 py-2.5 text-right font-medium">Precio</th>
                <th className="py-2.5 pl-3 pr-4 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const highlight = lastAddedProductId === p.id;
                const stockValue = p.sold_by_weight ? p.stock_decimal : p.stock;
                const stockState = stockValue <= 0 ? "out" : stockValue < 5 ? "low" : "ok";
                const disabled = stockValue <= 0;
                return (
                  <ProductTableRow
                    key={p.id}
                    name={p.name}
                    price={p.price}
                    barcode={p.barcode}
                    stockLabel={p.sold_by_weight ? `${p.stock_decimal} kg` : `${p.stock}`}
                    stockState={stockState}
                    disabled={disabled}
                    highlight={highlight}
                    onClick={() => onAdd(p)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasMore ? (
        <div ref={sentinelRef} className="flex items-center justify-center py-4 text-xs text-muted-foreground">
          Cargando más productos...
        </div>
      ) : null}
    </div>
  );
}
