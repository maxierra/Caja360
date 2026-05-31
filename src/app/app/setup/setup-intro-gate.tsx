"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { SetupPreBusinessIntro } from "@/app/app/setup/setup-pre-business-intro";

type Props = {
  /** Si true, el usuario ya pasó el intro o hay que mostrar el formulario directo (ej. error). */
  showForm: boolean;
  children: React.ReactNode;
};

export function SetupIntroGate({ showForm, children }: Props) {
  const router = useRouter();

  const onContinue = React.useCallback(() => {
    router.replace("/app/setup?form=1");
  }, [router]);

  if (!showForm) {
    return <SetupPreBusinessIntro onContinue={onContinue} />;
  }

  return <>{children}</>;
}
