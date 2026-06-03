"use client";

import * as React from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { adminResetUserPassword } from "@/app/admin/(dashboard)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function generateTemporaryPassword(length = 14) {
  const adjectives = ["Rapido", "Seguro", "Nuevo", "Cliente", "Ingreso", "Acceso"];
  const nouns = ["Caja", "Local", "Ventas", "Tienda", "Panel", "Cuenta"];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const password = `${adjective}${noun}${digits}`;
  return password.slice(0, Math.max(10, length));
}

export function AdminPasswordResetTool() {
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const onGeneratePassword = () => {
    const nextPassword = generateTemporaryPassword();
    setPassword(nextPassword);
    navigator.clipboard?.writeText(nextPassword).catch(() => {});
    toast.success("Contraseña generada", {
      description: "Se copió al portapapeles si el navegador lo permitió.",
    });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanIdentifier = identifier.trim();
    const cleanPassword = password.trim();
    if (!cleanIdentifier) {
      toast.error("Ingresá email o User ID.");
      return;
    }
    if (cleanPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    const ok = window.confirm(
      `¿Restablecer la contraseña de ${cleanIdentifier}?\n\nLa nueva contraseña será:\n${cleanPassword}`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const res = await adminResetUserPassword(cleanIdentifier, cleanPassword);
      if ("error" in res && res.error) {
        toast.error(res.message ?? "No se pudo restablecer la contraseña.");
        return;
      }
      toast.success("Contraseña actualizada", {
        description: `Usuario: ${res.email}`,
      });
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-[var(--pos-border)] bg-[var(--pos-surface)] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
          <KeyRound className="size-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Restablecer contraseña</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Usá email o User ID de Supabase Auth y definí una contraseña provisoria desde el panel admin.
          </p>
        </div>
      </div>

      <form className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_auto_auto]" onSubmit={onSubmit}>
        <div className="grid gap-1.5">
          <Label htmlFor="admin-reset-identifier">Email o User ID</Label>
          <Input
            id="admin-reset-identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="elrapido_02@hotmail.com o UUID"
            autoComplete="off"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="admin-reset-password">Nueva contraseña</Label>
          <Input
            id="admin-reset-password"
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Temporal segura"
            autoComplete="off"
          />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="outline" className="w-full md:w-auto" onClick={onGeneratePassword} disabled={loading}>
            Generar contraseña
          </Button>
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full md:w-auto" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            Restablecer
          </Button>
        </div>
      </form>
    </div>
  );
}
