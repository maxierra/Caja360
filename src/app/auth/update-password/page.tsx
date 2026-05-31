import { KeyRound, Lock } from "lucide-react";

import { updatePassword } from "@/app/auth/actions";
import {
  AuthEyebrow,
  AuthFormBody,
  AuthFormFooter,
  AuthFormHeader,
  AuthFormSurface,
  AuthPrimaryButton,
  AuthTextLink,
  authAlertError,
  authInputClassName,
  authInputIconClassName,
  authLabelClassName,
  authPageBackgroundClass,
} from "@/components/auth/auth-shared";
import { AuthSiteHeader } from "@/components/auth/auth-site-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function UpdatePasswordPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};

  return (
    <div className={authPageBackgroundClass}>
      <AuthSiteHeader secondaryHref="/" secondaryLabel="Inicio" />
      <main className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 py-10 md:py-16">
        <AuthFormSurface className="max-w-md">
          <AuthFormHeader
            eyebrow={
              <AuthEyebrow>
                <KeyRound className="size-3.5 text-sky-600" />
                Nueva contraseña
              </AuthEyebrow>
            }
            title="Actualizar contraseña"
            description="Elegí una contraseña nueva para tu cuenta."
          >
            {sp.error ? authAlertError(sp.error) : null}
          </AuthFormHeader>

          <AuthFormBody>
            <form action={updatePassword} className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="password" className={authLabelClassName}>
                  Nueva contraseña
                </Label>
                <div className="relative">
                  <Lock className={authInputIconClassName} />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    className={cn(authInputClassName)}
                    placeholder="Mínimo recomendado: 8 caracteres"
                  />
                </div>
              </div>
              <AuthPrimaryButton>Guardar contraseña</AuthPrimaryButton>
            </form>
          </AuthFormBody>

          <AuthFormFooter>
            <p className="text-sm text-slate-600">
              Si llegaste desde un enlace de recuperación, al guardar se actualizará tu acceso.
            </p>
            <AuthTextLink href="/auth/login">Ir a iniciar sesión</AuthTextLink>
          </AuthFormFooter>
        </AuthFormSurface>
      </main>
    </div>
  );
}
