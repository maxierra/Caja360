function stripOuterQuotes(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

/** Remitente para mails transaccionales (alertas admin, bienvenida, reportes). */
export function resendFromAddress(): string {
  const raw = stripOuterQuotes(process.env.RESEND_FROM ?? "");
  if (raw) return raw;
  return "POS <onboarding@resend.dev>";
}

export type SendEmailResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendTransactionalEmail(
  to: string,
  subject: string,
  text: string
): Promise<SendEmailResult> {
  const key = (process.env.RESEND_API_KEY ?? "").trim();
  if (!key) {
    const msg = "RESEND_API_KEY no configurada";
    console.warn("[resend]", msg);
    return { ok: false, error: msg };
  }
  const { Resend } = await import("resend");
  const resend = new Resend(key);
  const result = await resend.emails.send({
    from: resendFromAddress(),
    to: [to],
    subject,
    text,
  });
  if (result.error) {
    const err = result.error as { message?: string; name?: string };
    const msg = err.message ?? String(result.error);
    console.error("[resend] No se pudo enviar a", to, "→", msg);
    if (msg.includes("testing emails") || msg.includes("verify a domain")) {
      console.warn(
        "[resend] Verificá el dominio en https://resend.com/domains y RESEND_FROM con ese dominio."
      );
    }
    return { ok: false, error: msg };
  }
  const id = result.data?.id ?? "";
  console.info("[resend] Enviado a", to, "id:", id, "from:", resendFromAddress());
  return { ok: true, id };
}
