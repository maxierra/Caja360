/**
 * Aplica en la DB remota las migraciones que el audit marcó como faltantes.
 *
 * Requisito en .env (una sola vez):
 *   DATABASE_URL=postgresql://postgres.[ref]:[TU_PASSWORD]@aws-0-...pooler.supabase.com:6543/postgres
 *   (Supabase → Project Settings → Database → Connection string → URI)
 *
 * Uso: npm run db:apply-pending
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

/** Orden según audit + dependencias. */
const PENDING_MIGRATIONS = [
  "20260329120000_business_mercadopago_pos.sql",
  "20260329160000_mercado_pago_pos_pending_webhook.sql",
  "20260330120000_cuenta_corriente_clientes.sql",
  "20260331100000_suppliers_orders.sql",
  "20260331120000_business_activity_log.sql",
  "20260331130000_session_end_activity.sql",
  "20260331140000_ensure_sale_activity_event.sql",
  "20260331160000_ensure_sale_void_activity_event.sql",
  "20260401100000_promotion_rules.sql",
  "20260401110000_promotion_rule_products_and_schedule.sql",
  "20260401120000_promotion_totals_in_sales.sql",
  "20260607183000_promotion_rule_category_filters.sql",
  "20260409120000_subscription_promo_codes.sql",
  "20260413193000_download_events.sql",
  "20260508180000_admin_product_load_totals.sql",
];

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
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

async function main() {
  loadEnvFile();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("\n❌ Falta DATABASE_URL en .env");
    console.error("   Supabase → Settings → Database → Connection string → URI");
    console.error("   (usa la contraseña de postgres, no el service_role)\n");
    process.exit(1);
  }

  let pg;
  try {
    pg = await import("pg");
  } catch {
    console.error("Ejecutá: npm install\n");
    process.exit(1);
  }

  const client = new pg.default.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
  } catch (err) {
    if (err?.code === "ENOTFOUND" && databaseUrl.includes("db.") && databaseUrl.includes(".supabase.co:5432")) {
      console.error("\n❌ No se pudo resolver el host directo (IPv6). En Supabase → Connect:");
      console.error("   1. Cambiá «Direct connection» por «Session pooler»");
      console.error("   2. Copiá la URI (usuario postgres.ebrvowlwjmeiwwkmzdol, puerto 5432)");
      console.error("   3. Volvé a correr con esa URI en DATABASE_URL\n");
    }
    throw err;
  }
  console.log("\n=== Aplicando migraciones pendientes ===\n");

  for (const file of PENDING_MIGRATIONS) {
    const fullPath = path.join(migrationsDir, file);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ No existe: ${file}`);
      process.exit(1);
    }
    const sql = fs.readFileSync(fullPath, "utf8");
    process.stdout.write(`→ ${file} ... `);
    try {
      await client.query(sql);
      console.log("ok");
    } catch (err) {
      console.log("ERROR");
      console.error(`\nFalló en ${file}:`);
      console.error(err.message ?? err);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log("\n✅ Listo. Corré de nuevo: npm run db:audit\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
