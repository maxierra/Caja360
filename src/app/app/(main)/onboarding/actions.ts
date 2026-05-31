"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createMonitoredAction } from "@/lib/action-wrapper";
import { isMissingOnboardingColumnError } from "@/lib/onboarding-column";
import { createClient } from "@/lib/supabase/server";

async function completeBusinessOnboardingImpl() {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;
  if (!businessId) {
    return { ok: false as const, error: "No hay negocio activo." };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) {
    return { ok: false as const, error: "Sesión inválida." };
  }

  const { data: mem } = await supabase
    .from("memberships")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", uid)
    .is("deleted_at", null)
    .maybeSingle();

  if (String((mem as { role?: string } | null)?.role) !== "owner") {
    return { ok: false as const, error: "Solo el dueño puede cerrar el recorrido inicial." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("businesses")
    .update({ onboarding_completed_at: now, updated_at: now })
    .eq("id", businessId);

  if (error) {
    if (isMissingOnboardingColumnError(error)) {
      return { ok: true as const };
    }
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/app");
  revalidatePath("/app/onboarding");
  return { ok: true as const };
}

export const completeBusinessOnboarding = createMonitoredAction(
  completeBusinessOnboardingImpl,
  "onboarding/completeBusinessOnboarding"
);

async function shouldCelebrateOnboardingAfterSaleImpl(): Promise<boolean> {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;
  if (!businessId) return false;

  const supabase = await createClient();
  const { data: biz, error: bizError } = await supabase
    .from("businesses")
    .select("onboarding_completed_at")
    .eq("id", businessId)
    .maybeSingle();

  if (isMissingOnboardingColumnError(bizError)) {
    return false;
  }

  if ((biz as { onboarding_completed_at?: string | null } | null)?.onboarding_completed_at) {
    return false;
  }

  const { count, error } = await supabase
    .from("sales")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "paid");

  if (error) return false;
  return (count ?? 0) >= 1;
}

export const shouldCelebrateOnboardingAfterSale = createMonitoredAction(
  shouldCelebrateOnboardingAfterSaleImpl,
  "onboarding/shouldCelebrateOnboardingAfterSale"
);
