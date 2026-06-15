"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  name: string;
  imageUrl?: string | null;
  price: number;
  stockLabel: string;
  stockState: "ok" | "low" | "out";
  disabled?: boolean;
  onClick: () => void;
  highlight?: boolean;
};

const stockClass: Record<Props["stockState"], string> = {
  ok: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
  low: "border-amber-500/20 bg-amber-500/10 text-amber-600",
  out: "border-destructive/20 bg-destructive/10 text-destructive",
};

export function ProductCard({ name, imageUrl, price, stockLabel, stockState, disabled, onClick, highlight }: Props) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      animate={highlight ? { scale: [1, 1.02, 1] } : { scale: 1 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-[28px] border text-left",
        "border-[var(--pos-border)] bg-[var(--pos-surface)]",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-24px_rgba(15,23,42,0.35)]",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--pos-glow)]",
        disabled ? "opacity-60" : "hover:border-[var(--pos-accent)]/45",
        highlight ? "shadow-pos-glow ring-2 ring-[var(--pos-accent)]/25" : ""
      )}
    >
      <div className="min-w-0">
        <div className="relative overflow-hidden bg-[var(--pos-surface-2)]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={name}
              className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">Sin imagen</div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/12 to-transparent" />
          <div className="absolute left-3 top-3">
            <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold", stockClass[stockState])}>
              {disabled ? "Sin stock" : stockLabel}
            </span>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="min-w-0">
            <div className="line-clamp-2 min-h-[2.75rem] text-[15px] font-semibold leading-5 tracking-tight text-foreground">
              {name}
            </div>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Precio</div>
              <div className="font-numeric text-3xl font-semibold tracking-tight text-foreground">${price}</div>
            </div>
            <div className="text-[11px] text-muted-foreground">Click / Enter</div>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--pos-border)] p-4 pt-3">
        <div
          className={cn(
            "flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-all",
            disabled
              ? "border border-[var(--pos-border)] bg-[var(--pos-surface-2)] text-muted-foreground"
              : "bg-foreground text-background group-hover:bg-[var(--pos-accent)] group-hover:text-white"
          )}
        >
          <ShoppingCart className="size-4" />
          {disabled ? "Sin stock" : "Agregar al carrito"}
        </div>
      </div>
    </motion.button>
  );
}
