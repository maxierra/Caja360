import Link from "next/link";
import { notFound } from "next/navigation";

import { ComprarForm } from "@/app/comprar/comprar-form";
import { LANDING_STORE_SKUS } from "@/lib/store-catalog";
import { getStoreProductBySku } from "@/lib/store-products";

type Props = {
  params: Promise<{ sku: string }>;
};

const ALLOWED = new Set<string>(LANDING_STORE_SKUS);

export default async function ComprarSkuPage({ params }: Props) {
  const { sku } = await params;
  if (!ALLOWED.has(sku)) notFound();
  const product = await getStoreProductBySku(sku);
  if (!product) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/90 via-zinc-50 to-emerald-50/70">
      <header className="border-b border-sky-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-sm font-semibold text-slate-900">
            ← Volver al inicio
          </Link>
          <Link href="/auth/login" className="text-sm font-medium text-sky-800 hover:underline">
            Ingresar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Completá tu compra</h1>
        <p className="mt-2 text-sm text-slate-600">
          Pagás con Mercado Pago y recibís el acceso al sistema por email al instante.
        </p>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ComprarForm product={product} />
        </div>
      </main>
    </div>
  );
}
