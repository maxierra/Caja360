/** Query param para el recorrido guiado (solo con onboarding incompleto). */
export const ONBOARDING_GUIDE_QUERY = "ob" as const;

/** Pantalla actual del flujo guiado (query string). La creación del comercio ocurre antes, en /app/setup. */
export type OnboardingGuideStep = "product" | "cash" | "pos";

export function parseOnboardingGuideStep(value: string | undefined): OnboardingGuideStep | null {
  if (value === "product" || value === "cash" || value === "pos") return value;
  return null;
}

/** Pasos del recorrido completo (incluye comercio ya creado al llegar al modal intro). */
export type OnboardingGuideTimelineStepId = "business" | OnboardingGuideStep;

export const ONBOARDING_GUIDE_TIMELINE: Array<{ id: OnboardingGuideTimelineStepId; label: string }> = [
  { id: "business", label: "Comercio" },
  { id: "product", label: "Producto" },
  { id: "cash", label: "Caja" },
  { id: "pos", label: "Venta" },
];

/** Para OnboardingSpotlight: mismo orden que ONBOARDING_GUIDE_TIMELINE (pasos 1…n). */
export const ONBOARDING_GUIDE_TOTAL_STEPS = ONBOARDING_GUIDE_TIMELINE.length;

/** Alias retrocompatible: algunos entornos aún importan `ONBOARDING_GUIDE_STEPS`. */
export const ONBOARDING_GUIDE_STEPS = ONBOARDING_GUIDE_TIMELINE;
