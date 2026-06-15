/**
 * Fase 3 — Responsable Inscripto (stub).
 * Factura A/B, desglose IVA por línea, datos fiscales de clientes, NC A/B.
 */

export const PHASE3_RI_FEATURES = [
  "Factura A y B con alícuotas IVA por producto",
  "Condición IVA del receptor y CUIT en clientes",
  "Notas de Crédito A/B",
  "Libro IVA digital (Fase 4)",
] as const;

export function assertMonotributoOnly(taxCondition: string): void {
  if (taxCondition === "ri") {
    throw new Error(
      `Responsable Inscripto disponible en Fase 3: ${PHASE3_RI_FEATURES.slice(0, 3).join("; ")}.`
    );
  }
}
