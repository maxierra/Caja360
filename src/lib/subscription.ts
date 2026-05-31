import { parseDbTimestamptzMs } from "@/lib/parse-db-timestamp";

export type SubscriptionRow = {
  status: "trialing" | "active" | "past_due" | "canceled";
  current_period_start: string | null;
  current_period_end: string | null;
  plan_id: string;
};

/**
 * Acceso a la app (POS, productos, etc.) según suscripción del negocio.
 * - active: siempre OK (asumimos período pagado gestionado por webhook).
 * - trialing: OK solo si current_period_end > ahora (comparación en UTC; ver parse-db-timestamp).
 * - Sin fila: compatibilidad con negocios viejos → permitir (podés endurecer después).
 */
export function businessHasAppAccess(sub: SubscriptionRow | null): boolean {
  if (!sub) return true;

  if (sub.status === "active") {
    if (!sub.current_period_end) return true;
    const end = parseDbTimestamptzMs(sub.current_period_end);
    if (end == null) return true;
    return Date.now() < end;
  }

  if (sub.status === "trialing") {
    if (!sub.current_period_end) return true;
    const end = parseDbTimestamptzMs(sub.current_period_end);
    if (end == null) return true;
    return Date.now() < end;
  }

  return false;
}

export function subscriptionPlanLabel(sub: SubscriptionRow | null): string {
  if (!sub) return "Sin plan";
  if (sub.status === "active") return "Activo";
  if (sub.status === "trialing") return "Prueba";
  if (sub.status === "past_due") return "Pago pendiente";
  return "Inactivo";
}
