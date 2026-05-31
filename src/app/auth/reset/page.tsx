import { BarChart3, Mail, ShieldCheck, Store } from "lucide-react";

import { requestPasswordReset } from "@/app/auth/actions";
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
  searchParams?: Promise<{ error?: string; success?: string }>;
};

export default async function ResetPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};

  return (
    <div className={authPageBackgroundClass}>
      <AuthSiteHeader secondaryHref="/auth/login" secondaryLabel="Ingresar" />
      <main className="mx-auto flex w-full max-w-7xl flex-1 items-center px-4 py-8 md:py-12">
        <div className="grid w-full gap-10 lg:grid-cols-2 lg:items-stretch lg:gap-12">
          <AuthMarketingPanel
            headline="Recuperá acceso en minutos."
            description="Te enviamos un enlace seguro para restablecer tu contraseña y volver al sistema."
            features={[
              { icon: ShieldCheck, text: "Proceso seguro de recuperación." },
              { icon: BarChart3, text: "Volvé rápido a operar tu negocio." },
            ]}
          />

          <div className="flex items-center justify-center lg:justify-end">
            <AuthFormSurface>
              <AuthFormHeader
                eyebrow={
                  <AuthEyebrow>
                    <Store className="size-3.5 text-sky-600" />
                    Recuperar acceso
                  </AuthEyebrow>
                }
                title="Reset de contraseña"
                description="Te enviamos un enlace a tu correo."
              >
                {sp.error ? authAlertError(sp.error) : null}
                {sp.success ? authAlertSuccess("Listo. Revisá tu correo (y la carpeta de spam).") : null}
              </AuthFormHeader>

              <AuthFormBody>
                <form action={requestPasswordReset} className="grid gap-5">
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
                  <AuthPrimaryButton>Enviar enlace</AuthPrimaryButton>
                </form>
              </AuthFormBody>

              <AuthFormFooter>
                <AuthTextLink href="/auth/login">Volver al inicio de sesión</AuthTextLink>
              </AuthFormFooter>
            </AuthFormSurface>
          </div>
        </div>
      </main>
    </div>
  );
}
