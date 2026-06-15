"use client";

import * as React from "react";
import {
  Save,
  ShoppingCart,
  CreditCard,
  NotebookPen,
  Minus,
  Plus,
  Search,
  ArrowLeft,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { CartItem } from "@/app/app/(main)/pos/hooks/use-cart";
import type { PosProduct } from "@/app/app/(main)/pos/hooks/use-products";

function formatPrice(n: number): string {
  return `$${n.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

const WEIGHT_STEP = 0.05;

export type TableOrderViewProps = {
  tableName: string;
  items: CartItem[];
  categories: string[];
  products: PosProduct[];
  allProducts: PosProduct[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  serviceStatus: string;
  serviceNotes: string;
  onAddProduct: (product: PosProduct) => void;
  onRemoveProduct: (productId: string) => void;
  onSetQty?: (productId: string, qty: number) => void;
  onSave: () => void;
  onBack: () => void;
  onOpenNotes: () => void;
  onOpenPayment: () => void;
  pending: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
};

export function TableOrderView({
  tableName,
  items,
  categories,
  products,
  allProducts,
  selectedCategory,
  onSelectCategory,
  serviceStatus,
  serviceNotes,
  onAddProduct,
  onRemoveProduct,
  onSetQty,
  onSave,
  onBack,
  onOpenNotes,
  onOpenPayment,
  pending,
  hasMore,
  onLoadMore,
}: TableOrderViewProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const total = React.useMemo(
    () => items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0),
    [items]
  );

  const quantityById = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.product_id, item.quantity);
    }
    return map;
  }, [items]);

  const filteredProducts = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    // Search across ALL products (ignoring category filter and pagination)
    return allProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, allProducts, searchQuery]);

  React.useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { root: null, threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, onLoadMore]);

  const isServed = serviceStatus === "served";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── MODAL HEADER ──────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 active:bg-slate-100"
          >
            <ArrowLeft className="size-3.5" />
            Salón
          </button>
          <span className="text-base font-extrabold tracking-tight text-slate-900">
            {tableName}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenNotes}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
              serviceNotes.trim()
                ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            )}
          >
            <NotebookPen className="size-3.5" />
            <span className="hidden sm:inline">
              {serviceNotes.trim() ? "Ver nota" : "Notas"}
            </span>
          </button>

          {isServed && (
            <button
              type="button"
              onClick={onOpenPayment}
              disabled={pending || items.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-violet-600 bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              <CreditCard className="size-3.5" />
              Cobrar
            </button>
          )}
        </div>
      </div>

      {/* ── TWO-PANEL BODY ────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
        {/* ── LEFT PANEL: product browser (~60%) ──────────────────────────── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-slate-200 bg-white sm:border-b-0 sm:border-r sm:border-slate-200">
          {/* Search */}
          <div className="shrink-0 border-b border-slate-100 px-3 pt-3 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-0"
              />
            </div>
          </div>

          {/* Category pills */}
          <div className="shrink-0 border-b border-slate-100 px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat, idx) => {
                const active = selectedCategory === cat;
                const COLORS = [
                  { base: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100", active: "border-violet-700 bg-violet-700 text-white" },
                  { base: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100", active: "border-sky-700 bg-sky-700 text-white" },
                  { base: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100", active: "border-emerald-700 bg-emerald-700 text-white" },
                  { base: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100", active: "border-amber-600 bg-amber-600 text-white" },
                  { base: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100", active: "border-rose-700 bg-rose-700 text-white" },
                  { base: "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100", active: "border-orange-600 bg-orange-600 text-white" },
                  { base: "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100", active: "border-teal-700 bg-teal-700 text-white" },
                  { base: "border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100", active: "border-pink-700 bg-pink-700 text-white" },
                  { base: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100", active: "border-indigo-700 bg-indigo-700 text-white" },
                  { base: "border-lime-200 bg-lime-50 text-lime-700 hover:bg-lime-100", active: "border-lime-700 bg-lime-700 text-white" },
                ];
                const color = cat === "all" ? { base: "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200", active: "border-slate-800 bg-slate-800 text-white" } : COLORS[(idx - 1 + COLORS.length) % COLORS.length];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => onSelectCategory(cat)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold transition",
                      active ? color.active : color.base
                    )}
                  >
                    {cat === "all" ? "Todos" : cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
                <span className="text-3xl">🍽️</span>
                <p className="text-sm font-semibold text-slate-400">
                  {searchQuery
                    ? "Sin resultados para tu búsqueda"
                    : "No hay productos en esta categoría"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 [&>*]:min-w-0">
                {filteredProducts.map((p) => {
                  const qty = quantityById.get(p.id) ?? 0;
                  return (
                    <ProductTile
                      key={p.id}
                      product={p}
                      quantity={qty}
                      onAdd={onAddProduct}
                      onRemove={onRemoveProduct}
                      onSetQty={onSetQty}
                    />
                  );
                })}
              </div>
            )}

            {hasMore && (
              <div
                ref={sentinelRef}
                className="flex items-center justify-center py-4 text-xs text-slate-400"
              >
                Cargando más…
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: order summary (~40%) ───────────────────────────── */}
        <div className="flex h-56 shrink-0 flex-col border-t border-slate-200 bg-slate-50 sm:h-auto sm:w-72 sm:border-t-0 sm:border-l lg:w-80">
          {/* Panel header */}
          <div className="shrink-0 border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-extrabold text-slate-800">
              Pedido — {tableName}
            </h2>
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <ShoppingCart className="size-8 text-slate-300" />
                <p className="text-xs font-semibold text-slate-400">
                  Aún no agregaste productos
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 px-3 py-2">
                {items.map((item) => (
                  <CartRow
                    key={item.product_id}
                    item={item}
                    onRemove={onRemoveProduct}
                    onSetQty={onSetQty}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Bottom: total + save */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500">Total</span>
              <span className="text-lg font-extrabold text-slate-900">
                {formatPrice(total)}
              </span>
            </div>
            <button
              type="button"
              onClick={onSave}
              disabled={pending || items.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="size-4" />
              Guardar pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PRODUCT TILE ─────────────────────────────────────────────────────────────

type ProductTileProps = {
  product: PosProduct;
  quantity: number;
  onAdd: (p: PosProduct) => void;
  onRemove: (productId: string) => void;
  onSetQty?: (productId: string, qty: number) => void;
};

function ProductTile({
  product,
  quantity,
  onAdd,
  onRemove,
  onSetQty,
}: ProductTileProps) {
  const hasQty = quantity > 0;
  const name = product.name;
  const step = product.sold_by_weight ? WEIGHT_STEP : 1;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAdd(product);
  };

  const handleDec = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newQty = Math.round((quantity - step + Number.EPSILON) * 100) / 100;
    if (newQty <= 0) {
      onRemove(product.id);
    } else if (onSetQty) {
      onSetQty(product.id, newQty);
    } else {
      onRemove(product.id);
    }
  };

  const handleInc = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAdd(product);
  };

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white transition-all duration-150",
        hasQty
          ? "border-emerald-400 shadow-sm shadow-emerald-100"
          : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
      )}
    >
      {/* Image / placeholder */}
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image_url}
          alt={name}
          className="h-36 w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
          <span className="select-none text-2xl font-bold text-slate-400">
            {name[0]?.toUpperCase() ?? "?"}
          </span>
        </div>
      )}

      {/* Quantity badge */}
      {hasQty && (
        <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-sm">
          {quantity}
        </span>
      )}

      {/* Card body */}
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-tight text-slate-800">
          {name}
        </p>
        <p className="mt-1 text-sm font-bold text-emerald-700">
          {formatPrice(product.price)}
        </p>

        {/* Action area */}
        <div className="mt-3">
          {!hasQty ? (
            <button
              type="button"
              onClick={handleAdd}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-95"
            >
              <Plus className="size-4" />
              Agregar
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-lg bg-slate-100 px-1 py-0.5">
              <button
                type="button"
                onClick={handleDec}
                className="flex size-6 items-center justify-center rounded-md bg-red-50 text-red-600 transition hover:bg-red-100"
                aria-label={`Reducir ${name}`}
              >
                <Minus className="size-3" />
              </button>
              <span className="min-w-[1.5rem] text-center text-xs font-bold text-slate-800">
                {quantity}
              </span>
              <button
                type="button"
                onClick={handleInc}
                className="flex size-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                aria-label={`Agregar más ${name}`}
              >
                <Plus className="size-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CART ROW ─────────────────────────────────────────────────────────────────

type CartRowProps = {
  item: CartItem;
  onRemove: (productId: string) => void;
  onSetQty?: (productId: string, qty: number) => void;
};

function CartRow({ item, onRemove, onSetQty }: CartRowProps) {
  const step = item.sold_by_weight ? WEIGHT_STEP : 1;

  const handleDec = () => {
    const newQty = Math.round((item.quantity - step + Number.EPSILON) * 100) / 100;
    if (newQty <= 0) {
      onRemove(item.product_id);
    } else if (onSetQty) {
      onSetQty(item.product_id, newQty);
    }
  };

  const handleInc = () => {
    if (onSetQty) {
      const newQty = Math.round((item.quantity + step + Number.EPSILON) * 100) / 100;
      onSetQty(item.product_id, newQty);
    }
  };

  return (
    <li className="flex items-center gap-2 py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-semibold text-slate-800">
          {item.name}
        </span>
        <span className="text-[11px] text-slate-400">
          {formatPrice(item.unit_price)} c/u
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleDec}
          className="flex size-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-red-300 hover:text-red-600"
          aria-label="Reducir"
        >
          <Minus className="size-2.5" />
        </button>
        <span className="w-5 text-center text-xs font-bold text-slate-800">
          {item.quantity}
        </span>
        <button
          type="button"
          onClick={handleInc}
          className="flex size-5 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:text-emerald-600"
          aria-label="Agregar"
        >
          <Plus className="size-2.5" />
        </button>
      </div>

      <span className="w-16 text-right text-xs font-bold text-slate-900">
        {formatPrice(item.quantity * item.unit_price)}
      </span>
    </li>
  );
}
