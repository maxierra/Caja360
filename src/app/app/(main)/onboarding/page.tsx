import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/app/app/(main)/onboarding/onboarding-wizard";
import { isMissingOnboardingColumnError } from "@/lib/onboarding-column";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams?: Promise<{ celebrate?: string }>;
};

export default async function OnboardingPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const celebrateParam = sp.celebrate === "1";

  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;
  if (!businessId) {
    redirect("/app/setup");
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!supabaseUrl || !supabaseKey) {
    redirect("/app");
  }

  const supabase = await createClient();

  const { data: biz, error: bizError } = await supabase
    .from("businesses")
    .select("name, onboarding_completed_at")
    .eq("id", businessId)
    .single();

  if (isMissingOnboardingColumnError(bizError)) {
    redirect("/app");
  }

  const onboardingCompletedAt = (biz as { onboarding_completed_at?: string | null } | null)?.onboarding_completed_at;
  if (onboardingCompletedAt) {
    redirect("/app");
  }

  const businessName = (biz as { name?: string } | null)?.name ?? "tu negocio";

  const [{ count: productCount }, { count: saleCount }, cashRow] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "paid"),
    supabase
      .from("cash_registers")
      .select("closed_at")
      .eq("business_id", businessId)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const cashOpen = !!cashRow.data && !(cashRow.data as { closed_at?: string | null }).closed_at;
  const paidSaleCount = saleCount ?? 0;
  const productsTotal = productCount ?? 0;

  const showCelebration = paidSaleCount >= 1;

  if (!showCelebration) {
    if (productsTotal === 0) {
      redirect("/app/products?ob=product");
    }
    if (!cashOpen) {
      redirect("/app/cash?ob=cash");
    }
    redirect("/app/pos?ob=pos");
  }

  return (
    <OnboardingWizard
      businessName={businessName}
      productCount={productsTotal}
      cashOpen={cashOpen}
      paidSaleCount={paidSaleCount}
      showCelebration={showCelebration}
      celebrateFlash={celebrateParam && paidSaleCount >= 1}
    />
  );
}
