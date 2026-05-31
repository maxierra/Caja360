"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  email: string | null;
};

export function RegisterCheckEmailModal({ open, email }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onClose = () => {
      router.replace("/auth/register");
    };
    el.addEventListener("close", onClose);
    return () => el.removeEventListener("close", onClose);
  }, [router]);

  function dismiss() {
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-sky-100 bg-white p-0 text-slate-900 shadow-2xl shadow-sky-200/50 ring-1 ring-violet-50 open:backdrop:bg-slate-900/40 [&::backdrop]:bg-slate-900/40"
    >
      <div className="border-b border-slate-100 bg-gradient-to-br from-white via-sky-50/40 to-violet-50/30 p-6 md:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 shadow-sm">
          <Mail className="size-7 text-sky-600" aria-hidden />
        </div>
        <h2 className="mt-5 text-center text-xl font-bold tracking-tight text-slate-900 md:text-2xl">Revisá tu correo</h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
          Te enviamos un enlace para <strong className="font-semibold text-slate-900">confirmar tu cuenta</strong>. Hasta que no lo
          abras, no vas a poder entrar al panel (así evitamos confusiones con el acceso).
        </p>
        {email ? (
          <p className="mt-4 rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2 text-center text-sm text-sky-950">
            Enviado a <span className="font-semibold">{email}</span>
          </p>
        ) : null}
        <p className="mt-3 text-center text-xs text-slate-500">Si no lo ves, revisá spam o promociones.</p>
      </div>
      <div className="flex flex-col gap-3 bg-white p-6 md:flex-row md:justify-center md:px-8 md:pb-8">
        <button
          type="button"
          onClick={dismiss}
          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          Listo, voy al mail
        </button>
        <Link
          href="/auth/login"
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-sky-700 px-4 text-sm font-semibold text-white shadow-md shadow-sky-300/40 transition-colors hover:bg-sky-800"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    </dialog>
  );
}
