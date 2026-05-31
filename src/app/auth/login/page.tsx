import Link from "next/link";
import { BarChart3, Lock, Mail, ShieldCheck, Store } from "lucide-react";

import { signIn } from "@/app/auth/actions";
import {
  AuthEyebrow,
  AuthFormBody,
  AuthFormFooter,
  AuthFormHeader,
  AuthFormSurface,
  AuthMarketingPanel,
  AuthPrimaryButton,
  AuthTextLink,
  authAlertError,
  authAlertSuccess,
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
  searchParams?: Promise<{ error?: string; success?: string; redirect?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};

  return (
    <div className={authPageBackgroundClass}>
      <AuthSiteHeader secondaryHref="/auth/register" secondaryLabel="Crear cuenta" />
      <main className="mx-auto flex w-full max-w-7xl flex-1 items-center px-4 py-8 md:py-12">
        <div className="grid w-full gap-10 lg:grid-cols-2 lg:items-stretch lg:gap-12">
          <AuthMarketingPanel
            headline="Gestioná tu comercio con velocidad y claridad."
            description="Ventas, caja, inventario e informes en una plataforma pensada para el día a día en el mostrador."
            features={[
              { icon: ShieldCheck, text: "Acceso seguro y recuperación de contraseña." },
              { icon: BarChart3, text: "Métricas en vivo para decidir mejor." },
            ]}
          />

          <div className="flex items-center justify-center lg:justify-end">
            <AuthFormSurface>
              <AuthFormHeader
                eyebrow={
                  <AuthEyebrow>
                    <Store className="size-3.5 text-sky-600" />
                    Acceso profesional
                  </AuthEyebrow>
                }
                title="Ingresar"
                description="Accedé a tu punto de venta."
              >
                {sp.error ? authAlertError(sp.error) : null}
                {sp.success === "password_updated" ? (
                  authAlertSuccess("Contraseña actualizada. Ingresá con tu nueva contraseña.")
                ) : null}
              </AuthFormHeader>

              <AuthFormBody>
                <form action={signIn} className="grid gap-5">
                  <input type="hidden" name="redirect" value={sp.redirect ?? ""} />
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
                        autoComplete="current-password"
                        className={cn(authInputClassName)}
                        placeholder="Tu contraseña"
                      />
                    </div>
                  </div>
                  <AuthPrimaryButton>Entrar</AuthPrimaryButton>
                </form>
              </AuthFormBody>

              <AuthFormFooter>
                <AuthTextLink href="/auth/reset">Olvidé mi contraseña</AuthTextLink>
                <p className="text-sm text-slate-600">
                  ¿No tenés cuenta?{" "}
                  <Link
                    href="/auth/register"
                    className="font-semibold text-sky-800 underline-offset-4 hover:text-sky-950 hover:underline"
                  >
                    Crear cuenta
                  </Link>
                </p>
              </AuthFormFooter>
            </AuthFormSurface>
          </div>
        </div>
      </main>
    </div>
  );
}
