"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Mail } from "lucide-react";

import { getStoreOrderStatus } from "@/app/comprar/actions";

type Props = {
  orderId: string | null;
  mpStatus: string | null;
};

export function ComprarExitoClient({ orderId, mpStatus }: Props) {
  const [state, setState] = React.useState<{
    provisioned: boolean;
    email: string | null;
    status: string;
  } | null>(null);

  React.useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      const res = await getStoreOrderStatus(orderId);
      if (cancelled || !res) return;
      setState({
        provisioned: res.provisioned,
        email: res.email,
        status: res.status,
      });
      if (!res.provisioned && attempts < 30) {
        setTimeout(poll, 2000);
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const provisioned = state?.provisioned;
  const failed = mpStatus === "failure";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      {failed ? (
        <>
          <div className="text-lg font-bold text-red-700">El pago no se completó</div>
          <p className="mt-2 text-sm text-slate-600">Podés volver a intentar desde la landing.</p>
          <Link
            href="/"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-sky-700 px-6 text-sm font-semibold text-white"
          >
            Volver al inicio
          </Link>
        </>
      ) : provisioned ? (
        <>
          <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">¡Cuenta activada!</h1>
          <p className="mt-2 text-sm text-slate-600">
            Enviamos tus credenciales a{" "}
            <strong>{state?.email ?? "tu email"}</strong>. Revisá también la carpeta de spam.
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-sky-700 px-6 text-sm font-semibold text-white"
          >
            Ingresar al sistema
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="mx-auto size-10 animate-spin text-sky-600" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">Procesando tu pago…</h1>
          <p className="mt-2 text-sm text-slate-600">
            Estamos activando tu cuenta. En unos segundos recibirás un email con tu contraseña.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500">
            <Mail className="size-3.5" />
            No cierres esta página
          </div>
        </>
      )}
    </div>
  );
}
