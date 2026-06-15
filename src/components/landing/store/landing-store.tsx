"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageIcon, Minus, Plus, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";

import { LandingContactFooter } from "@/components/landing/LandingContactFooter";
import { landingCtaPrimary } from "@/components/landing/landing-cta-classes";
import { formatStorePrice } from "@/lib/store-products";
import type { SerializedCatalogProduct } from "@/lib/store-catalog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type CartLine = {
  sku: string;
  quantity: number;
};

type Props = {
  products: SerializedCatalogProduct[];
};

function ProductImage({
  product,
  className,
  priority,
  variant = "card",
}: {
  product: SerializedCatalogProduct;
  className?: string;
  priority?: boolean;
  variant?: "card" | "modal";
}) {
  if (product.imageSrc) {
    return (
      <Image
        src={product.imageSrc}
        alt={product.name}
        fill
        className={cn(
          variant === "modal" ? "object-contain object-center p-2" : "object-contain object-center p-3",
          className
        )}
        sizes={variant === "modal" ? "640px" : "(max-width: 640px) 100vw, 400px"}
        priority={priority}
        placeholder={product.imageBlur ? "blur" : "empty"}
        blurDataURL={product.imageBlur}
      />
    );
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400">
      <ImageIcon className="size-12" aria-hidden />
      <span className="text-xs">Foto próximamente</span>
    </div>
  );
}

function ProductDetailModal({
  product,
  open,
  onClose,
  onAddToCart,
}: {
  product: SerializedCatalogProduct | null;
  open: boolean;
  onClose: () => void;
  onAddToCart: (sku: string) => void;
}) {
  if (!open || !product) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-detail-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(94vh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-4xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 id="product-detail-title" className="pr-8 text-lg font-semibold leading-snug text-slate-900">
            {product.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto sm:grid sm:grid-cols-2 sm:overflow-hidden">
          <div className="relative aspect-[3/4] w-full shrink-0 border-b border-slate-100 bg-white sm:aspect-auto sm:min-h-[min(72vh,640px)] sm:border-b-0 sm:border-r">
            <ProductImage product={product} priority variant="modal" />
          </div>

          <div className="space-y-4 p-5 sm:overflow-y-auto">
            <div>
              <p className="text-2xl font-bold text-red-600">{formatStorePrice(product.priceArs)}</p>
              <p className="mt-1 text-xs font-medium text-sky-700">Pago único · licencia de por vida</p>
            </div>

            <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4">
              <h3 className="text-sm font-bold text-sky-900">{product.purposeTitle}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{product.purposeText}</p>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Beneficios que obtenés</h3>
              <p className="mt-1 text-sm text-slate-600">{product.longDescription}</p>
              <ul className="mt-3 space-y-2.5">
                {product.benefits.map((benefit) => (
                  <li key={benefit.title} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                    <p className="flex gap-2 text-sm font-semibold text-slate-900">
                      <span className="text-emerald-600" aria-hidden>
                        ✓
                      </span>
                      {benefit.title}
                    </p>
                    <p className="mt-1 pl-5 text-sm leading-relaxed text-slate-600">{benefit.description}</p>
                  </li>
                ))}
              </ul>
            </div>

            {product.includesHardware ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                <span className="font-semibold">Envío gratis</span> a todo el país. El software se activa al pagar — no
                esperás el hardware para empezar.
              </p>
            ) : (
              <p className="rounded-lg bg-slate-100 px-3 py-2.5 text-sm text-slate-700">
                Solo software: usalo en tu PC, notebook o tablet. Recibís usuario y clave por email al pagar.
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 p-4">
          <Button type="button" variant="outline" className="flex-1" onClick={() => onAddToCart(product.sku)}>
            Agregar al carrito
          </Button>
          <Link
            href={`/comprar/${product.sku}`}
            className={cn(landingCtaPrimary, "inline-flex flex-1 items-center justify-center rounded-md text-sm font-bold")}
          >
            Comprar ahora
          </Link>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({
  open,
  onClose,
  lines,
  products,
  onUpdateQty,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  products: SerializedCatalogProduct[];
  onUpdateQty: (sku: string, qty: number) => void;
  onRemove: (sku: string) => void;
}) {
  const router = useRouter();

  const items = lines
    .map((line) => {
      const p = products.find((x) => x.sku === line.sku);
      if (!p) return null;
      return { ...line, product: p };
    })
    .filter(Boolean) as Array<CartLine & { product: SerializedCatalogProduct }>;

  const total = items.reduce((s, i) => s + i.product.priceArs * i.quantity, 0);

  if (!open) return null;

  const checkout = () => {
    if (items.length === 0) return;
    if (items.length > 1) {
      toast.message("Por ahora pagá un producto a la vez", {
        description: "Te llevamos al checkout del primero del carrito.",
      });
    }
    router.push(`/comprar/${items[0].product.sku}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Carrito"
      >
        <div className="flex items-center justify-between border-b px-4 py-4">
          <h2 className="text-lg font-semibold">Carrito ({items.length})</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-slate-100" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">Tu carrito está vacío.</p>
          ) : (
            <ul className="space-y-4">
              {items.map(({ sku, quantity, product }) => (
                <li key={sku} className="flex gap-3 rounded-xl border border-slate-100 p-3">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-slate-50">
                    <ProductImage product={product} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 line-clamp-2">{product.name}</p>
                    <p className="mt-1 text-sm font-semibold text-sky-800">{formatStorePrice(product.priceArs)}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-200 p-1"
                        onClick={() => onUpdateQty(sku, quantity - 1)}
                        aria-label="Menos"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm">{quantity}</span>
                      <button
                        type="button"
                        className="rounded border border-slate-200 p-1"
                        onClick={() => onUpdateQty(sku, quantity + 1)}
                        aria-label="Más"
                      >
                        <Plus className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="ml-auto text-xs text-red-600 hover:underline"
                        onClick={() => onRemove(sku)}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t p-4">
          <div className="mb-4 flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatStorePrice(total)}</span>
          </div>
          <Button type="button" className="w-full" size="lg" disabled={items.length === 0} onClick={checkout}>
            Ir a pagar
          </Button>
          <p className="mt-2 text-center text-[11px] text-slate-500">Pago seguro con Mercado Pago</p>
        </div>
      </div>
    </div>
  );
}

export function LandingStore({ products }: Props) {
  const [cartOpen, setCartOpen] = React.useState(false);
  const [detailSku, setDetailSku] = React.useState<string | null>(null);
  const [lines, setLines] = React.useState<CartLine[]>([]);

  const detailProduct = products.find((p) => p.sku === detailSku) ?? null;
  const cartCount = lines.reduce((s, l) => s + l.quantity, 0);

  const addToCart = (sku: string) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.sku === sku);
      if (existing) {
        return prev.map((l) => (l.sku === sku ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { sku, quantity: 1 }];
    });
    setDetailSku(null);
    setCartOpen(true);
    toast.success("Agregado al carrito");
  };

  const updateQty = (sku: string, qty: number) => {
    if (qty < 1) {
      setLines((prev) => prev.filter((l) => l.sku !== sku));
      return;
    }
    setLines((prev) => prev.map((l) => (l.sku === sku ? { ...l, quantity: qty } : l)));
  };

  const removeLine = (sku: string) => {
    setLines((prev) => prev.filter((l) => l.sku !== sku));
  };

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-base font-bold tracking-tight text-slate-900">TIENDA360</p>
            <p className="text-xs text-slate-500">Sistema de gestión · POS</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50"
              aria-label={`Carrito, ${cartCount} productos`}
            >
              <ShoppingCart className="size-5" />
              {cartCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-sky-700 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              ) : null}
            </button>
            <Link
              href="/auth/login"
              className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium sm:inline-flex"
            >
              Ingresar
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <section className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Elegí cómo querés vender</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            Solo el software o el combo con lector e impresora. Tocá «Ver qué incluye» para conocer todos los beneficios.
          </p>
        </section>

        <section id="tienda" className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-2">
          {products.map((product, index) => (
            <article
              key={product.sku}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-sky-200 hover:shadow-lg"
            >
              <button
                type="button"
                className="relative aspect-[3/4] w-full bg-white text-left"
                onClick={() => setDetailSku(product.sku)}
                aria-label={`Ver detalle de ${product.name}`}
              >
                <ProductImage product={product} priority={index === 0} variant="card" />
                {product.badge ? (
                  <span className="absolute left-3 top-3 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                    {product.badge}
                  </span>
                ) : null}
              </button>
              <div className="flex flex-1 flex-col border-t border-slate-100 p-4">
                <button type="button" className="text-left" onClick={() => setDetailSku(product.sku)}>
                  <h2 className="text-lg font-bold text-slate-900 group-hover:text-sky-800">{product.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">{product.shortDescription}</p>
                </button>
                <p className="mt-3 text-2xl font-bold text-red-600">{formatStorePrice(product.priceArs)}</p>
                <p className="text-[11px] text-slate-500">Pago único</p>
                <div className="mt-4 flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setDetailSku(product.sku)}>
                    Ver qué incluye
                  </Button>
                  <Button type="button" className="flex-1" onClick={() => addToCart(product.sku)}>
                    Agregar
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </section>

        <div className="mt-12">
          <LandingContactFooter />
        </div>
      </main>

      <ProductDetailModal
        product={detailProduct}
        open={detailSku !== null}
        onClose={() => setDetailSku(null)}
        onAddToCart={addToCart}
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lines={lines}
        products={products}
        onUpdateQty={updateQty}
        onRemove={removeLine}
      />
    </div>
  );
}
