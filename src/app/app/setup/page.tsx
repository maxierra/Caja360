import { redirect } from "next/navigation";

import { createBusiness } from "@/app/app/setup/actions";
import { SetupForm } from "@/app/app/setup/setup-form";
import { SetupIntroGate } from "@/app/app/setup/setup-intro-gate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams?: Promise<{ error?: string; form?: string }>;
};

export default async function SetupPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const showForm = sp.form === "1" || Boolean(sp.error);

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (authData.user) {
    const { data: memberships } = await supabase
      .from("memberships")
      .select("business_id")
      .eq("user_id", authData.user.id)
      .is("deleted_at", null)
      .limit(1);
    if (memberships && memberships.length > 0) {
      redirect("/app/products?ob=product");
    }
  }

  return (
    <SetupIntroGate showForm={showForm}>
      <div className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-14">
        <Card className="w-full border-[var(--pos-border)] bg-[var(--pos-surface)] shadow-sm">
          <CardHeader>
            <CardTitle>Crear tu negocio</CardTitle>
            <CardDescription>
              Este contexto define el tenant. Todos los datos se aislarán por business.
            </CardDescription>
            {sp.error ? (
              <div className="text-sm text-destructive">{sp.error}</div>
            ) : null}
          </CardHeader>
          <CardContent>
            <SetupForm action={createBusiness} />
          </CardContent>
        </Card>
      </div>
    </SetupIntroGate>
  );
}
