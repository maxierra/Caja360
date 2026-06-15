/** Registro público gratuito. Por defecto deshabilitado (solo compra desde landing). */
export function isPublicSignupEnabled(): boolean {
  return process.env.PUBLIC_SIGNUP_ENABLED === "true";
}
