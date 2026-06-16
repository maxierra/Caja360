"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Package, Search } from "lucide-react";

import { lookupHardwareOrderByEmail } from "@/app/pedido/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function extractTrackingToken(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;

  try {
    const url = new URL(input);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("pedido");
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  } catch {
    // not a URL
  }

  const token = input.replace(/^\/+|\/+$/g, "");
  if (/^[0-9a-f-]{36}$/i.test(token)) return token;
  return null;
}

export default function PedidoLookupPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [linkValue, setLinkValue] = React.useState("");
  const [showLinkFallback, setShowLinkFallback] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await lookupHardwareOrderByEmail(email);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.push(`/pedido/${res.token}`);
    });
  };

  const submitLink = (e: React.FormEvent) => {
    e.preventDefault();
    const token = extractTrackingToken(linkValue);
    if (!token) {
      setError("El enlace no es válido. Probá con tu email de compra arriba.");
      return;
    }
    setError(null);
    router.push(`/pedido/${token}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/90 via-zinc-50 to-emerald-50/70">
      <header className="border-b border-sky-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg px-4 py-4">
          <Link href="/" className="text-sm font-semibold text-slate-900">
            ← Inicio
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <Package className="size-8 text-sky-700" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">Seguí tu envío</h1>
              <p className="text-sm text-slate-600">Combos con hardware a domicilio</p>
            </div>
          </div>

          <ol className="mt-5 space-y-2 text-sm text-slate-600">
            <li>
              <span className="font-medium text-slate-800">1.</span> Ingresá el email con el que
              compraste.
            </li>
            <li>
              <span className="font-medium text-slate-800">2.</span> Vas a ver si estamos preparando el
              paquete o si ya salió.
            </li>
            <li>
              <span className="font-medium text-slate-800">3.</span> Cuando lo despachemos, ahí aparece el
              número de Correo Argentino para rastrearlo.
            </li>
          </ol>

          <form onSubmit={submitEmail} className="mt-6 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email-input">Email de la compra</Label>
              <Input
                id="email-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
              />
            </div>
            {error && !showLinkFallback ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Search className="mr-2 size-4" />
              )}
              Ver estado de mi envío
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setShowLinkFallback((v) => !v)}
              className="text-xs font-medium text-sky-800 underline"
            >
              {showLinkFallback ? "Ocultar" : "¿Tenés el enlace del mail? Pegalo acá"}
            </button>
            {showLinkFallback ? (
              <form onSubmit={submitLink} className="mt-3 space-y-2">
                <Input
                  placeholder="https://…/pedido/…"
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                />
                {error && showLinkFallback ? <p className="text-sm text-red-600">{error}</p> : null}
                <Button type="submit" variant="outline" size="sm">
                  Abrir con enlace
                </Button>
              </form>
            ) : null}
          </div>

          <p className="mt-6 flex items-start gap-2 text-xs text-slate-500">
            <Mail className="mt-0.5 size-3.5 shrink-0" />
            <span>
              ¿Compraste solo software? No hay envío físico; las credenciales del POS llegan por email al
              confirmar el pago.
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}
