import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3099),
  apiKey: process.env.FISCAL_API_KEY ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
};

export function assertConfig() {
  if (!config.apiKey) throw new Error("FISCAL_API_KEY is required");
  if (!config.supabaseUrl) throw new Error("SUPABASE_URL is required");
  if (!config.supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
}

export type FiscalEnvironment = "homolog" | "prod";

export function normalizeCuit(cuit: string): string {
  return cuit.replace(/\D/g, "");
}

export function storagePrefix(businessId: string, environment: FiscalEnvironment) {
  return `${businessId}/${environment}`;
}
