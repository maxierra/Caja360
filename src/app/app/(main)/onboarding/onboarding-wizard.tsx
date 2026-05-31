"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, PartyPopper } from "lucide-react";
import { toast } from "sonner";

import { completeBusinessOnboarding } from "@/app/app/(main)/onboarding/actions";
import { OnboardingIntroModal } from "@/app/app/(main)/onboarding/onboarding-intro-modal";
import { landingCtaPrimary } from "@/components/landing/landing-cta-classes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  businessName: string;
  productCount: number;
  cashOpen: boolean;
  paidSaleCount: number;
  showCelebration: boolean;
  celebrateFlash: boolean;
};

export function OnboardingWizard({
  businessName,
  showCelebration,
  celebrateFlash,
}: Props) {
  const router = useRouter();
  const [finishing, setFinishing] = React.useState(false);

  const onFinishOnboarding = React.useCallback(async () => {
    setFinishing(true);
    try {
      const result = await completeBusinessOnboarding();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("¡Listo! Ya podés usar el sistema con tranquilidad.");
      router.push("/app");
      router.refresh();
    } finally {
      setFinishing(false);
    }
  }, [router]);

  if (showCelebration) {
    return (
      <div className="relative mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-lg flex-col justify-center px-4 py-10">
        {celebrateFlash ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_20%,rgba(52,211,153,0.35),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(167,139,250,0.2),transparent_50%)]"
          />
        ) : null}
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45 }}>
          <Card className="overflow-hidden border-emerald-200/80 bg-gradient-to-b from-card to-emerald-500/5 shadow-xl shadow-emerald-500/10">
            <CardHeader className="space-y-3 pb-2 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600">
                <PartyPopper className="size-9" aria-hidden />
              </div>
              <CardTitle className="font-serif text-2xl tracking-tight md:text-3xl">¡Primera venta registrada!</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                Ya cobraste en <span className="font-semibold text-foreground">{businessName}</span>. Tu negocio quedó
                operativo en el sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pb-8 pt-2">
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  Podés seguir vendiendo desde Punto de venta cuando quieras.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  Revisá inventario, caja e informes desde el menú lateral.
                </li>
              </ul>
              <Button
                type="button"
                disabled={finishing}
                className={cn("h-12 w-full rounded-xl text-base font-semibold", landingCtaPrimary)}
                onClick={() => void onFinishOnboarding()}
              >
                <span>{finishing ? "Guardando…" : "Ir al panel"}</span>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return <OnboardingIntroModal businessName={businessName} />;
}
