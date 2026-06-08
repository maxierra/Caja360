"use server";

import { revalidatePath } from "next/cache";

import { createMonitoredAction } from "@/lib/action-wrapper";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformAdminSessionEmail } from "@/lib/platform-admin-session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function billingDays(): number {
  const d = Number(
    process.env.MANUAL_SUBSCRIPTION_PERIOD_DAYS ?? process.env.MERCADOPAGO_BILLING_PERIOD_DAYS ?? 30
  );
  return Number.isFinite(d) && d > 0 ? Math.floor(d) : 30;
}

export type AdminActivateResult =
  | { error: "forbidden" | "invalid_uuid" | "not_found" | "config"; message?: string }
  | { ok: true; current_period_end: string };

export type AdminGrantFreeAccessResult =
  | { error: "forbidden" | "invalid_uuid" | "not_found" | "config"; message?: string }
  | { ok: true };

async function adminActivateSubscriptionImpl(businessId: string): Promise<AdminActivateResult> {
  const adminEmail = await getPlatformAdminSessionEmail();
  if (!adminEmail) return { error: "forbidden" };

  const id = businessId.trim();
  if (!UUID_RE.test(id)) return { error: "invalid_uuid" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "config", message: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." };
  }

  const { data: biz, error: bErr } = await admin.from("businesses").select("id").eq("id", id).maybeSingle();
  if (bErr) return { error: "config", message: bErr.message };
  if (!biz) return { error: "not_found" };

  const days = billingDays();
  const now = new Date();
  const end = new Date(now.getTime());
  end.setUTCDate(end.getUTCDate() + days);

  const payload = {
    status: "active" as const,
    current_period_start: now.toISOString(),
    current_period_end: end.toISOString(),
    provider: "manual_transfer",
    updated_at: now.toISOString(),
  };

  const { data: existing } = await admin.from("subscriptions").select("id").eq("business_id", id).maybeSingle();

  let subId: string;

  if (existing?.id) {
    const { data: upd, error: uErr } = await admin
      .from("subscriptions")
      .update(payload)
      .eq("business_id", id)
      .select("id")
      .single();
    if (uErr || !upd) return { error: "config", message: uErr?.message ?? "No se pudo actualizar la suscripción." };
    subId = upd.id;
  } else {
    const { data: ins, error: iErr } = await admin
      .from("subscriptions")
      .insert({
        business_id: id,
        plan_id: "standard",
        ...payload,
      })
      .select("id")
      .single();
    if (iErr || !ins) return { error: "config", message: iErr?.message ?? "No se pudo crear la suscripción." };
    subId = ins.id;
  }

  const amount = Number.parseFloat(process.env.MERCADOPAGO_PLAN_MONTHLY_AMOUNT ?? "0");
  const currency = (process.env.MERCADOPAGO_PLAN_CURRENCY ?? "ARS").trim().toUpperCase() || "ARS";
  const paymentRow = {
    business_id: id,
    subscription_id: subId,
    provider: "manual_transfer",
    provider_payment_id: `admin_manual_${Date.now()}`,
    amount: Number.isFinite(amount) ? amount : 0,
    currency,
    status: "approved",
    raw: { source: "admin_panel", admin_email: adminEmail, activated_at: now.toISOString() },
  };

  const { error: pErr } = await admin.from("payments").insert(paymentRow);
  if (pErr && process.env.NODE_ENV === "development") {
    console.warn("[adminActivateSubscription] payments insert:", pErr.message);
  }

  revalidatePath("/app/admin");
  revalidatePath("/app/subscription");
  revalidatePath("/app");

  return { ok: true, current_period_end: end.toISOString() };
}

async function adminGrantFreeAccessImpl(businessId: string): Promise<AdminGrantFreeAccessResult> {
  const adminEmail = await getPlatformAdminSessionEmail();
  if (!adminEmail) return { error: "forbidden" };

  const id = businessId.trim();
  if (!UUID_RE.test(id)) return { error: "invalid_uuid" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "config", message: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." };
  }

  const { data: biz, error: bErr } = await admin.from("businesses").select("id").eq("id", id).maybeSingle();
  if (bErr) return { error: "config", message: bErr.message };
  if (!biz) return { error: "not_found" };

  const now = new Date().toISOString();
  const payload = {
    status: "active" as const,
    current_period_start: now,
    current_period_end: null,
    provider: "free_admin",
    updated_at: now,
  };

  const { data: existing } = await admin.from("subscriptions").select("id").eq("business_id", id).maybeSingle();

  if (existing?.id) {
    const { error: uErr } = await admin
      .from("subscriptions")
      .update(payload)
      .eq("business_id", id);
    if (uErr) return { error: "config", message: uErr.message };
  } else {
    const { error: iErr } = await admin.from("subscriptions").insert({
      business_id: id,
      plan_id: "standard",
      ...payload,
    });
    if (iErr) return { error: "config", message: iErr.message };
  }

  revalidatePath("/app/admin");
  revalidatePath("/app/subscription");
  revalidatePath("/app");

  return { ok: true };
}

export type AdminDeactivateResult =
  | { error: "forbidden" | "invalid_uuid" | "not_found" | "config"; message?: string }
  | { ok: true };

export type AdminResetUserPasswordResult =
  | { error: "forbidden" | "invalid_input" | "not_found" | "config"; message?: string }
  | { ok: true; email: string };

/**
 * Corta el acceso al POS (middleware + layout). No borra datos del negocio.
 * Estado `canceled` + provider `admin_suspended` para distinguir en el panel.
 */
async function adminDeactivateSubscriptionImpl(businessId: string): Promise<AdminDeactivateResult> {
  const adminEmail = await getPlatformAdminSessionEmail();
  if (!adminEmail) return { error: "forbidden" };

  const id = businessId.trim();
  if (!UUID_RE.test(id)) return { error: "invalid_uuid" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "config", message: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." };
  }

  const { data: biz, error: bErr } = await admin.from("businesses").select("id").eq("id", id).maybeSingle();
  if (bErr) return { error: "config", message: bErr.message };
  if (!biz) return { error: "not_found" };

  const { data: existing } = await admin.from("subscriptions").select("id").eq("business_id", id).maybeSingle();
  if (!existing?.id) {
    return { error: "not_found", message: "Este negocio no tiene fila de suscripción." };
  }

  const now = new Date().toISOString();
  const { error: uErr } = await admin
    .from("subscriptions")
    .update({
      status: "canceled",
      current_period_start: now,
      current_period_end: now,
      provider: "admin_suspended",
      updated_at: now,
    })
    .eq("business_id", id);

  if (uErr) return { error: "config", message: uErr.message };

  revalidatePath("/app/admin");
  revalidatePath("/app/subscription");
  revalidatePath("/app");

  return { ok: true };
}

async function findUserIdByIdentifier(
  admin: ReturnType<typeof createAdminClient>,
  identifier: string
): Promise<{ id: string; email: string } | null> {
  const raw = identifier.trim().toLowerCase();
  if (!raw) return null;

  if (UUID_RE.test(raw)) {
    const { data, error } = await admin.auth.admin.getUserById(raw);
    if (error || !data.user?.id || !data.user.email) return null;
    return { id: data.user.id, email: data.user.email };
  }

  let page = 1;
  const perPage = 200;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const users = data.users ?? [];
    const match = users.find((user) => String(user.email ?? "").trim().toLowerCase() === raw);
    if (match?.id && match.email) {
      return { id: match.id, email: match.email };
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function adminResetUserPasswordImpl(
  identifier: string,
  password: string
): Promise<AdminResetUserPasswordResult> {
  const adminEmail = await getPlatformAdminSessionEmail();
  if (!adminEmail) return { error: "forbidden" };

  const cleanIdentifier = identifier.trim();
  const cleanPassword = password.trim();

  if (!cleanIdentifier) {
    return { error: "invalid_input", message: "Ingresá email o User ID." };
  }
  if (cleanPassword.length < 8) {
    return { error: "invalid_input", message: "La contraseña debe tener al menos 8 caracteres." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "config", message: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." };
  }

  let authUser: { id: string; email: string } | null = null;
  try {
    authUser = await findUserIdByIdentifier(admin, cleanIdentifier);
  } catch (error) {
    return {
      error: "config",
      message: error instanceof Error ? error.message : "No se pudo buscar el usuario en Auth.",
    };
  }

  if (!authUser) {
    return { error: "not_found", message: "No se encontró el usuario en Supabase Auth." };
  }

  const { error } = await admin.auth.admin.updateUserById(authUser.id, {
    password: cleanPassword,
  });

  if (error) {
    return { error: "config", message: error.message };
  }

  return { ok: true, email: authUser.email };
}

export const adminActivateSubscription = createMonitoredAction(
  adminActivateSubscriptionImpl,
  "admin/activateSubscription",
);
export const adminGrantFreeAccess = createMonitoredAction(
  adminGrantFreeAccessImpl,
  "admin/grantFreeAccess",
);
export const adminDeactivateSubscription = createMonitoredAction(
  adminDeactivateSubscriptionImpl,
  "admin/deactivateSubscription",
);
export const adminResetUserPassword = createMonitoredAction(
  adminResetUserPasswordImpl,
  "admin/resetUserPassword",
);
