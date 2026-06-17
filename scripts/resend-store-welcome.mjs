/**
 * Reenvía mail de credenciales para un pedido store (nueva contraseña).
 * Uso: node --env-file=.env scripts/resend-store-welcome.mjs cliente@email.com
 */
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function resendFromAddress() {
  let raw = (process.env.RESEND_FROM ?? "").trim();
  if (
    raw.length >= 2 &&
    ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
  ) {
    raw = raw.slice(1, -1).trim();
  }
  return raw || "POS <onboarding@resend.dev>";
}

function appBaseUrl() {
  return (
    (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_BASE_URL ?? "https://caja360.seenode.app")
      .trim()
      .replace(/\/+$/, "") || "https://caja360.seenode.app"
  );
}

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email.includes("@")) {
  console.error("Uso: node --env-file=.env scripts/resend-store-welcome.mjs email@cliente.com");
  process.exit(1);
}

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const resendKey = (process.env.RESEND_API_KEY ?? "").trim();

if (!url || !serviceKey || !resendKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o RESEND_API_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: order, error: orderErr } = await admin
  .from("store_orders")
  .select("*")
  .eq("email", email)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (orderErr || !order) {
  console.error("Pedido no encontrado para", email, orderErr?.message);
  process.exit(1);
}

if (!order.provisioned_user_id) {
  console.error("El pedido no está provisionado (provisioned_user_id vacío)");
  process.exit(1);
}

const password = crypto.randomBytes(18).toString("base64url");
const { error: userErr } = await admin.auth.admin.updateUserById(order.provisioned_user_id, {
  password,
});

if (userErr) {
  console.error("No se pudo actualizar contraseña:", userErr.message);
  process.exit(1);
}

const base = appBaseUrl();
const lines = [
  `Hola ${order.customer_name},`,
  "",
  "¡Gracias por tu compra! Tu cuenta ya está activa.",
  "",
  `Negocio: ${order.business_name}`,
  `Email de acceso: ${email}`,
  `Contraseña temporal: ${password}`,
  "",
  `Ingresá acá: ${base}/auth/login`,
  "",
  "Por seguridad, cambiá tu contraseña después del primer ingreso.",
  "",
  "— Equipo POS",
].join("\n");

const resend = new Resend(resendKey);
const result = await resend.emails.send({
  from: resendFromAddress(),
  to: [email],
  subject: "Tu acceso al POS ya está listo",
  text: lines,
});

if (result.error) {
  console.error("Resend falló:", result.error);
  process.exit(1);
}

const now = new Date().toISOString();
await admin.from("store_orders").update({ welcome_email_sent_at: now, updated_at: now }).eq("id", order.id);

console.log("OK — mail reenviado a", email, "id:", result.data?.id);
