"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createMonitoredAction } from "@/lib/action-wrapper";
import { normalizeBusinessType } from "@/lib/business-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function updateBusinessInfoImpl(formData: FormData) {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;

  if (!businessId) {
    return { error: "No hay negocio activo" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const business_type = normalizeBusinessType(String(formData.get("business_type") ?? ""));
  const address = String(formData.get("address") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const cuit = String(formData.get("cuit") ?? "").trim();
  const ticket_header = String(formData.get("ticket_header") ?? "").trim();
  const ticket_footer = String(formData.get("ticket_footer") ?? "").trim();
  const gastronomy_counter_enabled = formData.get("gastronomy_counter_enabled") === "on";
  const gastronomy_delivery_enabled = formData.get("gastronomy_delivery_enabled") === "on";
  const gastronomy_tables_enabled = formData.get("gastronomy_tables_enabled") === "on";
  const tables_count = Number(String(formData.get("tables_count") ?? "0").trim() || "0");
  const tables_names = String(formData.get("tables_names") ?? "").trim();

  if (!name) {
    return { error: "El nombre del negocio es obligatorio" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("businesses")
    .update({
      name,
      business_type,
      gastronomy_counter_enabled,
      gastronomy_delivery_enabled,
      gastronomy_tables_enabled,
      address: address || null,
      phone: phone || null,
      cuit: cuit || null,
      ticket_header: ticket_header || null,
      ticket_footer: ticket_footer || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId);

  if (error) {
    return { error: error.message };
  }

  if (business_type === "gastronomy") {
    let nextTableNames = tables_names
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);

    const targetCount =
      Number.isFinite(tables_count) && tables_count >= 0
        ? Math.min(Math.floor(tables_count), 200)
        : nextTableNames.length;

    if (gastronomy_tables_enabled) {
      if (nextTableNames.length === 0 && targetCount > 0) {
        nextTableNames = Array.from({ length: targetCount }, (_, index) => `Mesa ${index + 1}`);
      } else if (targetCount > nextTableNames.length) {
        for (let index = nextTableNames.length + 1; index <= targetCount; index += 1) {
          nextTableNames.push(`Mesa ${index}`);
        }
      } else if (targetCount < nextTableNames.length) {
        nextTableNames = nextTableNames.slice(0, targetCount);
      }
    }

    if (!gastronomy_tables_enabled) {
      nextTableNames = [];
    }

    const { error: deleteTablesError } = await supabase.from("business_tables").delete().eq("business_id", businessId);
    if (deleteTablesError) {
      return { error: deleteTablesError.message };
    }

    if (nextTableNames.length > 0) {
      const { error: insertTablesError } = await supabase.from("business_tables").insert(
        nextTableNames.map((tableName) => ({
          business_id: businessId,
          name: tableName,
          active: true,
        }))
      );

      if (insertTablesError) {
        return { error: insertTablesError.message };
      }
    }
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/pos");
  revalidatePath("/app");
  return { success: true };
}

export async function assertSettingsOwner(businessId: string) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData.user?.id;
  if (!uid) {
    throw new Error("not_authenticated");
  }

  const { data, error } = await supabase
    .from("memberships")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", uid)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data || String((data as any).role) !== "owner") {
    throw new Error("not_authorized");
  }
}

async function getAuthUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("not_authenticated");
  return uid;
}

async function listBusinessUsersImpl() {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;
  if (!businessId) {
    return { error: "No hay negocio activo" } as const;
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return { error: "Sesión expirada" } as const;
  }

  const currentUserId = authData.user.id;

  const { data: memberships, error: mErr } = await supabase
    .from("memberships")
    .select("user_id, role, permissions, deleted_at, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (mErr) {
    return { error: mErr.message } as const;
  }

  const ids = (memberships ?? []).map((m: any) => String(m.user_id));
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar")
    .in("id", ids);

  if (pErr) {
    return { error: pErr.message } as const;
  }

  const pMap = new Map((profiles ?? []).map((p: any) => [String(p.id), p]));

  return {
    currentUserId,
    users: (memberships ?? []).map((m: any) => {
      const p = pMap.get(String(m.user_id));
      return {
        user_id: String(m.user_id),
        role: String(m.role ?? "member"),
        permissions: (m as any).permissions ?? {},
        deleted_at: (m as any).deleted_at ?? null,
        email: p?.email ?? null,
        full_name: p?.full_name ?? null,
        avatar: (p as any)?.avatar ?? null,
      };
    }),
  } as const;
}

async function upsertMyProfileImpl() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) {
    return { error: "Sesión expirada" } as const;
  }

  const email = user.email ?? null;
  const full_name = (user.user_metadata as any)?.full_name ?? null;

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    email,
    full_name,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return { error: error.message } as const;
  }

  return { success: true } as const;
}

async function createBusinessUserImpl(formData: FormData) {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;
  if (!businessId) {
    return { error: "No hay negocio activo" } as const;
  }

  try {
    await assertSettingsOwner(businessId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "not_authorized" } as const;
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "member").trim() || "member";
  const avatar = String(formData.get("avatar") ?? "").trim();
  const permissionsRaw = String(formData.get("permissions") ?? "{}").trim();
  let permissions: any = {};
  try {
    permissions = permissionsRaw ? JSON.parse(permissionsRaw) : {};
  } catch {
    permissions = {};
  }

  if (!email) return { error: "Email requerido" } as const;
  if (!password || password.length < 6) return { error: "Contraseña mínima 6 caracteres" } as const;

  const admin = createAdminClient();

  // Si el email ya existe en Auth, reusar ese usuario (reactivar membership)
  let uid: string | null = null;
  const { data: created, error: uErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: full_name ? { full_name } : undefined,
  });

  if (created?.user?.id) {
    uid = created.user.id;
  } else {
    const msg = String(uErr?.message ?? "");
    if (/already|registered|exists/i.test(msg)) {
      const { data: list, error: lErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (lErr) return { error: lErr.message } as const;
      const found = (list.users ?? []).find((u: any) => String(u.email ?? "").toLowerCase() === email);
      if (!found?.id) return { error: "El email ya existe pero no se pudo recuperar el usuario" } as const;
      uid = String(found.id);

      // Actualizar contraseña si se quiere "recrear" el usuario
      const { error: updErr } = await admin.auth.admin.updateUserById(uid, { password });
      if (updErr) return { error: updErr.message } as const;
    } else {
      return { error: uErr?.message ?? "No se pudo crear el usuario" } as const;
    }
  }

  if (!uid) return { error: "No se pudo determinar el usuario" } as const;

  const { error: profErr } = await admin.from("profiles").upsert({
    id: uid,
    email,
    full_name: full_name || null,
    avatar: avatar || null,
    updated_at: new Date().toISOString(),
  });

  if (profErr) {
    return { error: profErr.message } as const;
  }

  const { error: memErr } = await admin.from("memberships").upsert(
    {
      business_id: businessId,
      user_id: uid,
      role,
      permissions,
      deleted_at: null,
      deleted_by: null,
    },
    { onConflict: "business_id,user_id" }
  );

  if (memErr) {
    return { error: memErr.message } as const;
  }

  revalidatePath("/app/settings");
  return { success: true } as const;
}

async function restoreBusinessUserImpl(formData: FormData) {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;
  if (!businessId) {
    return { error: "No hay negocio activo" } as const;
  }

  try {
    await assertSettingsOwner(businessId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "not_authorized" } as const;
  }

  const user_id = String(formData.get("user_id") ?? "").trim();
  if (!user_id) return { error: "user_id requerido" } as const;

  const admin = createAdminClient();
  const { error } = await admin
    .from("memberships")
    .update({ deleted_at: null, deleted_by: null })
    .eq("business_id", businessId)
    .eq("user_id", user_id);

  if (error) return { error: error.message } as const;
  revalidatePath("/app/settings");
  return { success: true } as const;
}

async function updateBusinessUserImpl(formData: FormData) {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;
  if (!businessId) {
    return { error: "No hay negocio activo" } as const;
  }

  try {
    await assertSettingsOwner(businessId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "not_authorized" } as const;
  }

  const user_id = String(formData.get("user_id") ?? "").trim();
  const role = String(formData.get("role") ?? "member").trim() || "member";
  const full_name = String(formData.get("full_name") ?? "").trim();
  const avatar = String(formData.get("avatar") ?? "").trim();
  const permissionsRaw = String(formData.get("permissions") ?? "{}").trim();
  let permissions: any = {};
  try {
    permissions = permissionsRaw ? JSON.parse(permissionsRaw) : {};
  } catch {
    permissions = {};
  }

  if (!user_id) return { error: "user_id requerido" } as const;

  // Nunca permitir que se quite el rol owner al último owner del negocio.
  if (role !== "owner") {
    const supabase = await createClient();
    const { data: current, error: curErr } = await supabase
      .from("memberships")
      .select("role")
      .eq("business_id", businessId)
      .eq("user_id", user_id)
      .maybeSingle();

    if (curErr) return { error: curErr.message } as const;

    if (String((current as any)?.role) === "owner") {
      const { count, error: cntErr } = await supabase
        .from("memberships")
        .select("user_id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("role", "owner");

      if (cntErr) return { error: cntErr.message } as const;
      const owners = Number(count ?? 0);
      if (owners <= 1) {
        return { error: "No podés quitar el rol de dueño al último owner del comercio" } as const;
      }
    }
  }

  const admin = createAdminClient();

  const { error: memErr } = await admin
    .from("memberships")
    .update({ role, permissions })
    .eq("business_id", businessId)
    .eq("user_id", user_id);

  if (memErr) return { error: memErr.message } as const;

  const { error: profErr } = await admin.from("profiles").upsert({
    id: user_id,
    full_name: full_name || null,
    avatar: avatar || null,
    updated_at: new Date().toISOString(),
  });

  if (profErr) return { error: profErr.message } as const;

  revalidatePath("/app/settings");
  return { success: true } as const;
}

async function removeBusinessUserImpl(formData: FormData) {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;
  if (!businessId) {
    return { error: "No hay negocio activo" } as const;
  }

  try {
    await assertSettingsOwner(businessId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "not_authorized" } as const;
  }

  const user_id = String(formData.get("user_id") ?? "").trim();
  const delete_auth = String(formData.get("delete_auth") ?? "0") === "1";
  if (!user_id) return { error: "user_id requerido" } as const;

  // El owner nunca debe poder borrarse a sí mismo.
  try {
    const me = await getAuthUserId();
    if (me === user_id) {
      return { error: "El dueño no puede borrarse a sí mismo" } as const;
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "not_authenticated" } as const;
  }

  // No permitir eliminar al último owner.
  const supabase = await createClient();
  const { data: target, error: tErr } = await supabase
    .from("memberships")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", user_id)
    .maybeSingle();

  if (tErr) return { error: tErr.message } as const;

  if (String((target as any)?.role) === "owner") {
    const { count, error: cntErr } = await supabase
      .from("memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("role", "owner");

    if (cntErr) return { error: cntErr.message } as const;
    const owners = Number(count ?? 0);
    if (owners <= 1) {
      return { error: "No podés eliminar al dueño del comercio" } as const;
    }
  }

  const admin = createAdminClient();

  // Soft-delete: marcar como eliminado en el comercio
  const me = await getAuthUserId();
  const { error: delErr } = await admin
    .from("memberships")
    .update({ deleted_at: new Date().toISOString(), deleted_by: me })
    .eq("business_id", businessId)
    .eq("user_id", user_id);

  if (delErr) return { error: delErr.message } as const;

  if (delete_auth) {
    const { error: authErr } = await admin.auth.admin.deleteUser(user_id);
    if (authErr) return { error: authErr.message } as const;
  }

  revalidatePath("/app/settings");
  return { success: true } as const;
}

async function updateReportDailyImpl(formData: FormData) {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;

  console.log("[settings] updateReportDaily called, businessId:", businessId);

  if (!businessId) {
    return { error: "No hay negocio activo" };
  }

  const enabled = formData.get("enabled") === "true";
  const email = String(formData.get("email") ?? "").trim();
  const time = String(formData.get("time") ?? "08:00:00");

  console.log("[settings] Saving - enabled:", enabled, "email:", email, "time:", time);

  if (enabled && !email) {
    return { error: "Debes ingresar un email para recibir el reporte" };
  }

  if (enabled && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "El email no es válido" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("businesses")
    .update({
      report_daily_enabled: enabled,
      report_daily_email: enabled ? email : null,
      report_daily_time: enabled ? time : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId);

  if (error) {
    console.log("[settings] Error saving:", error);
    return { error: error.message };
  }

  console.log("[settings] Saved successfully!");
  revalidatePath("/app/settings");
  return { success: true };
}

export const updateBusinessInfo = createMonitoredAction(updateBusinessInfoImpl, "settings/updateBusinessInfo");
export const updateReportDaily = createMonitoredAction(updateReportDailyImpl, "settings/updateReportDaily");
export const listBusinessUsers = createMonitoredAction(listBusinessUsersImpl, "settings/listBusinessUsers");
export const upsertMyProfile = createMonitoredAction(upsertMyProfileImpl, "settings/upsertMyProfile");
export const createBusinessUser = createMonitoredAction(createBusinessUserImpl, "settings/createBusinessUser");
export const restoreBusinessUser = createMonitoredAction(restoreBusinessUserImpl, "settings/restoreBusinessUser");
export const updateBusinessUser = createMonitoredAction(updateBusinessUserImpl, "settings/updateBusinessUser");
export const removeBusinessUser = createMonitoredAction(removeBusinessUserImpl, "settings/removeBusinessUser");

async function sendDailyReportNowImpl() {
  const cookieStore = await cookies();
  const businessId = cookieStore.get("active_business_id")?.value;

  if (!businessId) {
    return { error: "No hay negocio activo" };
  }

  const admin = createAdminClient();

  const { data: business, error: bizError } = await admin
    .from("businesses")
    .select("id, name, report_daily_enabled, report_daily_email")
    .eq("id", businessId)
    .single();

  if (bizError || !business) {
    return { error: "Negocio no encontrado" };
  }

  if (!business.report_daily_enabled || !business.report_daily_email) {
    return { error: "El reporte diario no está configurado. Activá y guardá primero." };
  }

  const { generateDailyReport, sendDailyReportEmail } = await import("@/lib/daily-report");

  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(dateParts.find((p) => p.type === "year")?.value);
  const month = Number(dateParts.find((p) => p.type === "month")?.value);
  const day = Number(dateParts.find((p) => p.type === "day")?.value);
  const argentinaTodayUtc = new Date(Date.UTC(year, month - 1, day));
  const dateStr = argentinaTodayUtc.toISOString().split("T")[0];

  try {
    const report = await generateDailyReport(businessId, dateStr);
    const result = await sendDailyReportEmail(business.report_daily_email, report);

    if (result.error) {
      return { error: "Error al enviar: " + result.error.message };
    }

    return { success: true, emailId: result.data?.id };
  } catch (error) {
    return { error: "Error: " + String(error) };
  }
}

export const sendDailyReportNow = createMonitoredAction(sendDailyReportNowImpl, "settings/sendDailyReportNow");
