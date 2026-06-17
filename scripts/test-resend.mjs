/**
 * Prueba envío Resend. Uso: node --env-file=.env scripts/test-resend.mjs [email]
 */
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

const to = (process.argv[2] ?? "agustina.scoppa@gmail.com").trim();
const key = (process.env.RESEND_API_KEY ?? "").trim();
const from = resendFromAddress();

if (!key) {
  console.error("Falta RESEND_API_KEY en .env");
  process.exit(1);
}

console.log("From:", from);
console.log("To:", to);

const resend = new Resend(key);
const result = await resend.emails.send({
  from,
  to: [to],
  subject: "Test POS — Tu acceso al POS ya está listo",
  text: "Si recibís esto, Resend y el dominio están OK para mails post-compra.",
});

console.log(JSON.stringify(result, null, 2));
process.exit(result.error ? 1 : 0);
