/**
 * Compara la DB remota (test/prod) con lo que el código del proyecto usa.
 *
 * Uso:
 *   1. En Supabase → Project Settings → Database → Connection string (URI)
 *   2. Agregá a .env:  DATABASE_URL=postgresql://postgres.[ref]:[password]@...
 *   3. npm run db:audit
 *
 * Alternativa sin DATABASE_URL: pegá scripts/audit-db-schema.sql en SQL Editor.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const EXPECTED_TABLES = [
  "businesses",
  "memberships",
  "profiles",
  "products",
  "sales",
  "sale_items",
  "cash_registers",
  "cash_movements",
  "fixed_expenses",
  "subscriptions",
  "payments",
  "platform_settings",
  "business_tables",
  "service_orders",
  "service_order_items",
  "business_payment_methods",
  "business_customers",
  "customer_account_payments",
  "business_activity_events",
  "promotion_rules",
  "promotion_rule_products",
  "business_suppliers",
  "supplier_orders",
  "supplier_order_items",
  "business_mercadopago_access",
  "mercado_pago_pos_pending_sales",
  "business_fiscal_config",
  "fiscal_points_of_sale",
  "fiscal_certificates",
  "fiscal_vouchers",
  "fiscal_pending_consolidation",
  "store_products",
  "store_orders",
  "preload_products",
  "subscription_promo_codes",
  "download_events",
];

const EXPECTED_FUNCTIONS = [
  "create_business_with_owner",
  "create_business_paid_owner",
  "ensure_subscription_trial_for_business",
  "create_sale_with_items",
  "void_sale",
  "open_cash_register",
  "close_cash_register",
  "auto_close_stale_cash_registers",
  "create_cash_movement",
  "ensure_business_payment_methods",
  "customer_balance",
  "record_customer_account_payment",
  "business_member_emails",
  "record_session_activity",
  "record_session_end",
  "ensure_sale_activity_event",
  "ensure_sale_void_activity_event",
  "business_mercadopago_qr_ready",
  "mercadopago_pos_complete_pending",
  "get_mercadopago_pos_checkout_status",
  "cancel_mercadopago_pos_checkout",
  "get_auth_user_id_by_email",
  "admin_product_load_totals",
];

/** Migraciones locales (excluye stubs/obsoletas). */
const SKIP_MIGRATIONS = new Set([
  "20250324120000_subscription_trial_on_new_business.sql",
  "20260617150000_preload_products.sql",
  "20260617160000_preload_products_prod_schema.sql",
]);

const FEATURE_HINTS = {
  business_payment_methods: "20260328120000_business_payment_methods.sql",
  business_customers: "20260330120000_cuenta_corriente_clientes.sql",
  customer_account_payments: "20260330120000_cuenta_corriente_clientes.sql",
  business_activity_events: "20260331120000_business_activity_log.sql",
  promotion_rules: "20260401100000_promotion_rules.sql (+ 011100, 011200, 071830)",
  promotion_rule_products: "20260401110000_promotion_rule_products_and_schedule.sql",
  business_mercadopago_access: "20260329120000_business_mercadopago_pos.sql",
  mercado_pago_pos_pending_sales: "20260329160000_mercado_pago_pos_pending_webhook.sql",
  business_fiscal_config: "20260614120000_fiscal_monotributo.sql",
  store_products: "20260615120000_store_orders.sql",
  store_orders: "20260615120000_store_orders.sql",
  preload_products: "20260617170000 o 20260617180000_preload_products",
  business_suppliers: "20260331100000_suppliers_orders.sql",
  subscription_promo_codes: "20260409120000_subscription_promo_codes.sql",
  download_events: "20260413193000_download_events.sql",
};

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function listLocalMigrations() {
  const dir = path.join(root, "supabase", "migrations");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && !SKIP_MIGRATIONS.has(f))
    .sort();
}

async function main() {
  loadEnvFile();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("\n❌ Falta DATABASE_URL en .env");
    console.error("   Supabase → Settings → Database → Connection string (URI)");
    console.error("   O ejecutá scripts/audit-db-schema.sql en el SQL Editor.\n");
    process.exit(1);
  }

  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error("\n❌ Instalá dependencias: npm install\n");
    process.exit(1);
  }

  const client = new pg.default.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tablesRes = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
    order by 1
  `);
  const existingTables = new Set(tablesRes.rows.map((r) => r.table_name));

  const fnRes = await client.query(`
    select p.proname as name, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
    order by 1
  `);
  const existingFns = new Map(fnRes.rows.map((r) => [r.name, r.args]));

  let appliedMigrations = [];
  try {
    const migRes = await client.query(
      "select version, name from supabase_migrations.schema_migrations order by version"
    );
    appliedMigrations = migRes.rows;
  } catch {
    // CLI nunca usado en este proyecto
  }

  await client.end();

  const missingTables = EXPECTED_TABLES.filter((t) => !existingTables.has(t));
  const missingFns = EXPECTED_FUNCTIONS.filter((f) => !existingFns.has(f));

  const saleFnArgs = existingFns.get("create_sale_with_items") ?? "";
  const saleFnOk = saleFnArgs.includes("p_customer_id");

  const localMigrations = listLocalMigrations();
  const appliedVersions = new Set(appliedMigrations.map((m) => m.version));
  const pendingCli = localMigrations.filter((f) => !appliedVersions.has(f.slice(0, 14)));

  console.log("\n=== Auditoría DB vs proyecto ===\n");

  if (missingTables.length === 0) {
    console.log("✅ Tablas esperadas: todas presentes");
  } else {
    console.log(`❌ Tablas faltantes (${missingTables.length}):`);
    for (const t of missingTables) {
      const hint = FEATURE_HINTS[t] ? `  → ${FEATURE_HINTS[t]}` : "";
      console.log(`   - ${t}${hint}`);
    }
  }

  console.log("");
  if (missingFns.length === 0) {
    console.log("✅ Funciones RPC esperadas: todas presentes");
  } else {
    console.log(`❌ Funciones faltantes (${missingFns.length}):`);
    for (const f of missingFns) console.log(`   - ${f}()`);
  }

  console.log("");
  if (!existingFns.has("create_sale_with_items")) {
    console.log("❌ create_sale_with_items: no existe → 20260617130000_pos_checkout_rpc.sql");
  } else if (!saleFnOk) {
    console.log(`⚠️  create_sale_with_items: versión vieja (${saleFnArgs})`);
    console.log("   → correr 20260617130000 o cadena promociones/cuenta corriente");
  } else {
    console.log("✅ create_sale_with_items: versión actual (con p_customer_id)");
  }

  console.log("\n--- Migraciones Supabase CLI ---");
  if (appliedMigrations.length === 0) {
    console.log("ℹ️  No hay historial CLI (aplicaste SQL a mano). Podés usar:");
    console.log("   npx supabase link --project-ref <ref>");
    console.log("   npx supabase db push");
    console.log("   (o seguir con SQL Editor + este audit)");
  } else {
    console.log(`Aplicadas por CLI: ${appliedMigrations.length}`);
    if (pendingCli.length > 0) {
      console.log(`Pendientes (${pendingCli.length}):`);
      pendingCli.slice(0, 15).forEach((f) => console.log(`   - ${f}`));
      if (pendingCli.length > 15) console.log(`   ... y ${pendingCli.length - 15} más`);
    } else {
      console.log("✅ Todas las migraciones locales están en el historial CLI");
    }
  }

  console.log("\n--- Atajo ---");
  console.log("SQL Editor: scripts/audit-db-schema.sql");
  console.log("CLI push:   npx supabase link && npx supabase db push\n");

  if (missingTables.length > 0 || missingFns.length > 0 || !saleFnOk) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
