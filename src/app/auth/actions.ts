"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createMonitoredAction } from "@/lib/action-wrapper";
import { notifyAdminUserSignup } from "@/lib/admin-alerts-send";
import { isPublicSignupEnabled } from "@/lib/public-signup";
import { getAppBaseUrl } from "@/lib/app-base-url";
import { firstAllowedMemberPath } from "@/lib/employee-permissions";
import { createClient } from "@/lib/supabase/server";

function getRedirectPath(redirectTo: string | null | undefined) {
  if (!redirectTo) return "/app";
  if (!redirectTo.startsWith("/")) return "/app";
  return redirectTo;
}

async function syncActiveBusinessCookie(supabase: Awaited<ReturnType<typeof createClient>>, cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const userResp = await supabase.auth.getUser();
  const userId = userResp.data.user?.id;
  if (!userId) {
    cookieStore.set("active_business_id", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return;
  }

  const currentBusinessId = cookieStore.get("active_business_id")?.value;
  if (currentBusinessId) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("business_id")
      .eq("user_id", userId)
      .eq("business_id", currentBusinessId)
      .is("deleted_at", null)
      .maybeSingle();

    if (membership?.business_id) {
      return;
    }
  }

  const { data: memberships } = await supabase
    .from("memberships")
    .select("business_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  const firstBusinessId = memberships?.[0]?.business_id;
  if (firstBusinessId) {
    cookieStore.set("active_business_id", String(firstBusinessId), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return;
  }

  cookieStore.set("active_business_id", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

async function signInImpl(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "");

  const demoEnabled = ["1", "true"].includes((process.env.DEMO_AUTH_ENABLED ?? "").trim().toLowerCase());
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  const hasSupabaseEnv = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

  if (demoEnabled && !hasSupabaseEnv) {
    const demoEmail = process.env.DEMO_AUTH_EMAIL ?? "demo@demo.com";
    const demoPassword = process.env.DEMO_AUTH_PASSWORD ?? "demo";
    const demoBusinessId = process.env.DEMO_BUSINESS_ID ?? "demo";

    if (email === demoEmail && password === demoPassword) {
      const cookieStore = await cookies();

      cookieStore.set("demo_auth", "1", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      cookieStore.set("demo_user_email", email, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });

      if (!cookieStore.get("active_business_id")?.value) {
        cookieStore.set("active_business_id", demoBusinessId, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        });
      }

      redirect(getRedirectPath(redirectTo));
    }

    redirect(`/auth/login?error=${encodeURIComponent("Credenciales inválidas")}&redirect=${encodeURIComponent(redirectTo)}`);
  }

  if (!hasSupabaseEnv) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    redirect(
      `/auth/login?error=${encodeURIComponent(`Falta configurar Supabase (${missing.join(", ")})`)}&redirect=${encodeURIComponent(redirectTo)}`
    );
  }

  const supabase = await createClient();
  const { error, data: authData } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}&redirect=${encodeURIComponent(redirectTo)}`);
  }

  const user = authData.user;
  const userId = user?.id;

  if (!userId) {
    redirect(`/auth/login?error=${encodeURIComponent("Error de autenticación")}&redirect=${encodeURIComponent(redirectTo)}`);
  }

  const cookieStore = await cookies();

  const [{ data: memberships }, { data: businessMembership }] = await Promise.all([
    supabase.from("memberships").select("business_id").eq("user_id", userId).is("deleted_at", null),
    cookieStore.get("active_business_id")?.value
      ? supabase.from("memberships").select("role, permissions").eq("user_id", userId).eq("business_id", cookieStore.get("active_business_id")?.value).is("deleted_at", null).maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  const activeMembership = (memberships ?? [])[0];
  if (!activeMembership?.business_id) {
    // Sin negocio (DB vacía, pruebas desde cero o membresías borradas): onboarding, no es "desactivado".
    cookieStore.set("active_business_id", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    redirect("/app/setup");
  }

  const savedBusinessId = cookieStore.get("active_business_id")?.value;
  if (!savedBusinessId || !(memberships ?? []).some(m => m.business_id === savedBusinessId)) {
    cookieStore.set("active_business_id", activeMembership.business_id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  const nextPath = getRedirectPath(redirectTo);
  if (nextPath === "/app" && businessMembership) {
    const role = String(businessMembership.role ?? "member");
    const p = (businessMembership.permissions ?? {}) as Record<string, unknown>;
    
    if (role !== "owner" && !(p.dashboard ?? false)) {
      const first = firstAllowedMemberPath(p as Record<string, unknown>);
      redirect(first ?? "/auth/login");
    }
  }

  redirect(nextPath);
}

async function signUpImpl(formData: FormData) {
  if (!isPublicSignupEnabled()) {
    redirect(`/auth/register?error=${encodeURIComponent("El registro gratuito está cerrado. Comprá el software desde la página principal.")}`);
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const hasSupabaseEnv =
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().length > 0 &&
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim().length > 0;

  if (!hasSupabaseEnv) {
    redirect(`/auth/register?error=${encodeURIComponent("Falta configurar Supabase")}`);
  }

  const supabase = await createClient();
  const baseUrl = getAppBaseUrl();
  const redirectUrl = `${baseUrl}/auth/callback?next=${encodeURIComponent("/app/setup")}`;
  console.log("[auth] signUp redirect URL:", redirectUrl);
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) {
    redirect(`/auth/register?error=${encodeURIComponent(error.message)}`);
  }

  const registeredEmail = data.user?.email?.trim();
  if (registeredEmail) {
    void notifyAdminUserSignup(registeredEmail);
  }

  const confirmed = data.user?.email_confirmed_at != null;
  if (!confirmed) {
    if (data.session) {
      await supabase.auth.signOut();
    }
    redirect(`/auth/register?check_email=1&email=${encodeURIComponent(email)}`);
  }

  const cookieStore = await cookies();
  await syncActiveBusinessCookie(supabase, cookieStore);
  redirect("/app/setup");
}

async function requestPasswordResetImpl(formData: FormData) {
  const email = String(formData.get("email") ?? "");

  const hasSupabaseEnv =
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().length > 0 &&
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim().length > 0;

  if (!hasSupabaseEnv) {
    redirect(`/auth/reset?error=${encodeURIComponent("Falta configurar Supabase")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAppBaseUrl()}/auth/callback?type=recovery`,
  });

  if (error) {
    redirect(`/auth/reset?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/auth/reset?success=1");
}

async function updatePasswordImpl(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  const hasSupabaseEnv =
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().length > 0 &&
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim().length > 0;

  if (!hasSupabaseEnv) {
    redirect(`/auth/update-password?error=${encodeURIComponent("Falta configurar Supabase")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/auth/update-password?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect("/auth/login?success=password_updated");
}

async function signOutImpl() {
  const demoEnabled = ["1", "true"].includes((process.env.DEMO_AUTH_ENABLED ?? "").trim().toLowerCase());
  const hasSupabaseEnv =
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().length > 0 &&
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim().length > 0;

  if (demoEnabled && !hasSupabaseEnv) {
    const cookieStore = await cookies();
    cookieStore.set("demo_auth", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    cookieStore.set("demo_user_email", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    cookieStore.set("active_business_id", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  } else {
    if (!hasSupabaseEnv) {
      redirect("/auth/login");
    }
    const cookieStore = await cookies();
    const businessId = cookieStore.get("active_business_id")?.value;
    const supabase = await createClient();
    if (businessId) {
      const { error: endErr } = await supabase.rpc("record_session_end", { p_business_id: businessId });
      if (endErr && process.env.NODE_ENV === "development") {
        console.warn("[signOut] record_session_end:", endErr.message);
      }
    }
    await supabase.auth.signOut();
    cookieStore.set("active_business_id", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  }
  redirect("/auth/login");
}

export const signIn = createMonitoredAction(signInImpl, "auth/signIn");
export const signUp = createMonitoredAction(signUpImpl, "auth/signUp");
export const requestPasswordReset = createMonitoredAction(requestPasswordResetImpl, "auth/requestPasswordReset");
export const updatePassword = createMonitoredAction(updatePasswordImpl, "auth/updatePassword");
export const signOut = createMonitoredAction(signOutImpl, "auth/signOut");
