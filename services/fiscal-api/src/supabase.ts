import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export const supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const FISCAL_CERTS_BUCKET = "fiscal-certs";
