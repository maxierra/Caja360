import Link from "next/link";

import { ComprarExitoClient } from "@/app/comprar/exito/comprar-exito-client";

type Props = {
  searchParams?: Promise<{ order?: string; mp?: string }>;
};

export default async function ComprarExitoPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const orderId = typeof sp.order === "string" ? sp.order : null;
  const mpStatus = typeof sp.mp === "string" ? sp.mp : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/90 via-zinc-50 to-emerald-50/70">
      <header className="border-b border-sky-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl px-4 py-4">
          <Link href="/" className="text-sm font-semibold text-slate-900">
            ← Inicio
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-16">
        <ComprarExitoClient orderId={orderId} mpStatus={mpStatus} />
      </main>
    </div>
  );
}
