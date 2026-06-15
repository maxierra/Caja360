"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createMonitoredAction } from "@/lib/action-wrapper";
import { normalizeBusinessType } from "@/lib/business-types";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomePromoAfterFirstBusiness } from "@/lib/welcome-promo-email";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function uniqueSlug(base: string) {
  const safe = slugify(base) || "negocio";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${safe}-${suffix}`;
}

async function createBusinessImpl(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const requestedSlug = slugify(String(formData.get("slug") ?? "") || name);
  const businessType = normalizeBusinessType(String(formData.get("business_type") ?? ""));

  const demoEnabled = process.env.DEMO_AUTH_ENABLED === "1";
  const hasSupabaseEnv =
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().length > 0 &&
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim().length > 0;

  if (!name) {
    redirect("/app/setup?error=Nombre requerido");
  }

  if (demoEnabled && !hasSupabaseEnv) {
    const businessId = process.env.DEMO_BUSINESS_ID ?? requestedSlug ?? "demo";
    const cookieStore = await cookies();
    cookieStore.set("active_business_id", businessId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    redirect("/app/products?ob=product");
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    redirect(`/auth/login?error=${encodeURIComponent("Sesión expirada. Ingresá nuevamente para crear tu negocio.")}&redirect=${encodeURIComponent("/app/setup")}`);
  }

  let chosenSlug = requestedSlug;
  let data: unknown = null;
  let error: { message: string } | null = null;

  ({ data, error } = await supabase.rpc("create_business_with_owner", {
    p_name: name,
    p_slug: chosenSlug,
  }));

  if (error?.message?.includes("businesses_slug_key")) {
    chosenSlug = uniqueSlug(requestedSlug || name);
    ({ data, error } = await supabase.rpc("create_business_with_owner", {
      p_name: name,
      p_slug: chosenSlug,
    }));
  }

  if (error?.message?.toLowerCase().includes("not_authenticated")) {
    redirect(`/auth/login?error=${encodeURIComponent("Tu sesión no es válida. Volvé a iniciar sesión.")}&redirect=${encodeURIComponent("/app/setup")}`);
  }

  if (error) {
    redirect(`/app/setup?error=${encodeURIComponent(error.message)}`);
  }

  const businessId = data as string;

  const { error: businessUpdateError } = await supabase
    .from("businesses")
    .update({
      business_type: businessType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId);

  if (businessUpdateError) {
    redirect(`/app/setup?error=${encodeURIComponent(businessUpdateError.message)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set("active_business_id", businessId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  const uid = authData.user.id;
  if (uid) {
    void sendWelcomePromoAfterFirstBusiness({
      userId: uid,
      businessId,
      businessName: name,
    });
  }

  redirect("/app/products?ob=product");
}

export const createBusiness = createMonitoredAction(createBusinessImpl, "setup/createBusiness");
