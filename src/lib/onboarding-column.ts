type ErrorLike = { message?: string | null } | null | undefined;

export function isMissingOnboardingColumnError(error: ErrorLike | string | unknown): boolean {
  const message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in (error as Record<string, unknown>)
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  if (!message) return false;
  return /onboarding_completed_at/i.test(message) && /(column|schema cache|does not exist|not found)/i.test(message);
}
