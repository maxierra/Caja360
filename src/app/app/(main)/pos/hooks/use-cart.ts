"use client";

import * as React from "react";

export type CartItem = {
  product_id: string;
  name: string;
  sold_by_weight: boolean;
  unit_price: number;
  quantity: number;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const WEIGHT_STEP_KG = 0.05;

export function useCart() {
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [lastAddedProductId, setLastAddedProductId] = React.useState<string | null>(null);

  const total = React.useMemo(() => {
    return round2(items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0));
  }, [items]);

  const add = React.useCallback((p: {
    id: string;
    name: string;
    sold_by_weight: boolean;
    price: number;
  }, opts?: { quantity?: number }) => {
    setItems((prev) => {
      const existing = prev.find((x) => x.product_id === p.id);
      const step = p.sold_by_weight ? WEIGHT_STEP_KG : 1;
      const qty = opts?.quantity ?? step;
      if (!existing) {
        return [
          ...prev,
          {
            product_id: p.id,
            name: p.name,
            sold_by_weight: p.sold_by_weight,
            unit_price: p.price,
            quantity: qty,
          },
        ];
      }
      return prev.map((x) => (x.product_id === p.id ? { ...x, quantity: round2(x.quantity + qty) } : x));
    });
    setLastAddedProductId(p.id);
  }, []);

  const setQty = React.useCallback((productId: string, qty: number) => {
    const clean = round2(qty);
    setItems((prev) => prev.map((x) => (x.product_id === productId ? { ...x, quantity: clean } : x)).filter((x) => x.quantity > 0));
  }, []);

  const inc = React.useCallback((item: CartItem) => {
    const step = item.sold_by_weight ? WEIGHT_STEP_KG : 1;
    setQty(item.product_id, item.quantity + step);
  }, [setQty]);

  const dec = React.useCallback((item: CartItem) => {
    const step = item.sold_by_weight ? WEIGHT_STEP_KG : 1;
    setQty(item.product_id, item.quantity - step);
  }, [setQty]);

  const remove = React.useCallback((productId: string) => {
    setItems((prev) => prev.filter((x) => x.product_id !== productId));
  }, []);

  const clear = React.useCallback(() => {
    setItems([]);
  }, []);

  const replace = React.useCallback((nextItems: CartItem[]) => {
    setItems(nextItems);
  }, []);

  const consumeLastAdded = React.useCallback(() => {
    setLastAddedProductId(null);
  }, []);

  return {
    items,
    total,
    lastAddedProductId,
    add,
    setQty,
    inc,
    dec,
    remove,
    clear,
    replace,
    consumeLastAdded,
  };
}
