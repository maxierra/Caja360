import Link from "next/link";
import { BarChart3, Lock, Mail, ShieldCheck, Store } from "lucide-react";

import { signUp } from "@/app/auth/actions";
import {
  AuthEyebrow,
  AuthFormBody,
  AuthFormFooter,
  AuthFormHeader,
  AuthFormSurface,
  AuthMarketingPanel,
  AuthPrimaryButton,
  authAlertError,
  authInputClassName,
  authInputIconClassName,
  authLabelClassName,
  authPageBackgroundClass,
} from "@/components/auth/auth-shared";
import { RegisterCheckEmailModal } from "@/components/auth/register-check-email-modal";
import { AuthSiteHeader } from "@/components/auth/auth-site-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  searchParams?: Promise<{ error?: string; check_email?: string; email?: string }>;
};

export default async function RegisterPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const showCheckEmail = sp.check_email === "1";
  const checkEmailAddress =
    typeof sp.email === "string" && sp.email.trim().length > 0 ? sp.email.trim() : null;

  return (
    <div className={authPageBackgroundClass}>
      <AuthSiteHeader secondaryHref="/auth/login" secondaryLabel="Ingresar" />
      <main className="mx-auto flex w-full max-w-7xl flex-1 items-center px-4 py-8 md:py-12">
        <div className="grid w-full gap-10 lg:grid-cols-2 lg:items-stretch lg:gap-12">
          <AuthMarketingPanel
            headline="Empezá hoy con una cuenta lista para vender."
            description="Configurá tu comercio, cargá productos y controlá ventas, caja e inventario desde el primer día."
            features={[
              { icon: ShieldCheck, text: "Entorno seguro para tu negocio." },
              { icon: BarChart3, text: "Informes claros para tomar decisiones." },
            ]}
          />

          <div className="flex items-center justify-center lg:justify-end">
            <AuthFormSurface>
              <AuthFormHeader
                eyebrow={
                  <AuthEyebrow>
                    <Store className="size-3.5 text-sky-600" />
                    Alta de cuenta
                  </AuthEyebrow>
                }
                title="Crear cuenta"
                description="Registrate y probá el POS en minutos."
              >
                {sp.error ? authAlertError(sp.error) : null}
              </AuthFormHeader>

              <AuthFormBody>
                <form action={signUp} className="grid gap-5">
                  <div className="grid gap-2">
                    <Label htmlFor="email" className={authLabelClassName}>
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className={authInputIconClassName} />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        className={cn(authInputClassName)}
                        placeholder="dueño@minegocio.com"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password" className={authLabelClassName}>
                      Contraseña
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
                        placeholder="Una contraseña segura"
                      />
                    </div>
                  </div>
                  <AuthPrimaryButton>Crear cuenta</AuthPrimaryButton>
                </form>
              </AuthFormBody>

              <AuthFormFooter>
                <p className="text-sm text-slate-600">
                  ¿Ya tenés cuenta?{" "}
                  <Link
                    href="/auth/login"
                    className="font-semibold text-sky-800 underline-offset-4 hover:text-sky-950 hover:underline"
                  >
                    Ingresar
                  </Link>
                </p>
              </AuthFormFooter>
            </AuthFormSurface>
          </div>
        </div>
      </main>

      <RegisterCheckEmailModal open={showCheckEmail} email={checkEmailAddress} />
    </div>
  );
}
