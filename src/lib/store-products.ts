import { createAdminClient } from "@/lib/supabase/admin";

export type StoreProduct = {
  sku: string;
  name: string;
  price_ars: number;
  includes_hardware: boolean;
  hardware_summary: string | null;
  is_active: boolean;
  sort_order: number;
};

const DEFAULT_PRICES = {
  software_lifetime: 150_000,
  combo_essential: 350_000,
} as const;

function resolveStorePrice(sku: string, fallback: number): number {
  if (sku === "software_lifetime") {
    const n = Number(process.env.STORE_SOFTWARE_LIFETIME_AMOUNT);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }
  if (sku === "combo_essential") {
    const n = Number(process.env.STORE_COMBO_ESSENTIAL_AMOUNT);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }
  return fallback;
}

const FALLBACK: StoreProduct[] = [
  {
    sku: "software_lifetime",
    name: "Software POS TIENDA360",
    price_ars: resolveStorePrice("software_lifetime", DEFAULT_PRICES.software_lifetime),
    includes_hardware: false,
    hardware_summary: null,
    is_active: true,
    sort_order: 0,
  },
  {
    sku: "combo_essential",
    name: "Combo Punto de Venta",
    price_ars: resolveStorePrice("combo_essential", DEFAULT_PRICES.combo_essential),
    includes_hardware: true,
    hardware_summary: "Software + lector + impresora térmica",
    is_active: true,
    sort_order: 10,
  },
  {
    sku: "combo_initial",
    name: "Combo inicial + software lifetime",
    price_ars: 599_000,
    includes_hardware: true,
    hardware_summary: "Mostrador completo para empezar",
    is_active: true,
    sort_order: 20,
  },
  {
    sku: "combo_commerce",
    name: "Combo comercio + software lifetime",
    price_ars: 699_000,
    includes_hardware: true,
    hardware_summary: "Mini POS completo",
    is_active: true,
    sort_order: 30,
  },
  {
    sku: "combo_advanced",
    name: "Combo avanzado + software lifetime",
    price_ars: 1_399_000,
    includes_hardware: true,
    hardware_summary: "PC táctil completa",
    is_active: true,
    sort_order: 40,
  },
];

const STORE_DISPLAY_NAMES: Record<string, string> = {
  software_lifetime: "Software POS TIENDA360",
  combo_essential: "Combo Punto de Venta",
};

const STORE_HARDWARE_SUMMARY: Record<string, string> = {
  combo_essential: "Software + lector de barras + impresora térmica",
};

function storeDisplayName(sku: string, dbName: string): string {
  const lifetimeTitle = (process.env.STORE_SOFTWARE_LIFETIME_TITLE ?? "").trim();
  const comboTitle = (process.env.STORE_COMBO_ESSENTIAL_TITLE ?? "").trim();
  if (sku === "software_lifetime" && lifetimeTitle) return lifetimeTitle;
  if (sku === "combo_essential" && comboTitle) return comboTitle;
  return STORE_DISPLAY_NAMES[sku] ?? dbName;
}

function applyStoreEnvOverrides(products: StoreProduct[]): StoreProduct[] {
  return products.map((p) => ({
    ...p,
    price_ars: resolveStorePrice(
      p.sku,
      p.price_ars || DEFAULT_PRICES[p.sku as keyof typeof DEFAULT_PRICES] || p.price_ars
    ),
    name: storeDisplayName(p.sku, p.name),
    hardware_summary: STORE_HARDWARE_SUMMARY[p.sku] ?? p.hardware_summary,
  }));
}

export async function getStoreProducts(): Promise<StoreProduct[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("store_products")
      .select("sku,name,price_ars,includes_hardware,hardware_summary,is_active,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error || !data?.length) {
      return applyStoreEnvOverrides(FALLBACK);
    }
    return applyStoreEnvOverrides(
      (data as StoreProduct[]).map((p) => ({
        ...p,
        price_ars: Number(p.price_ars),
      }))
    );
  } catch {
    return applyStoreEnvOverrides(FALLBACK);
  }
}

export async function getStoreProductBySku(sku: string): Promise<StoreProduct | null> {
  const products = await getStoreProducts();
  return products.find((p) => p.sku === sku) ?? null;
}

export function getStoreEnvPrice(sku: string): number {
  return resolveStorePrice(sku, DEFAULT_PRICES[sku as keyof typeof DEFAULT_PRICES] ?? 0);
}

export function getStoreEnvTitle(sku: string): string {
  if (sku === "software_lifetime") {
    const t = (process.env.STORE_SOFTWARE_LIFETIME_TITLE ?? "").trim();
    return t || "Software POS — Licencia de por vida";
  }
  if (sku === "combo_essential") {
    const t = (process.env.STORE_COMBO_ESSENTIAL_TITLE ?? "").trim();
    return t || "Combo Punto de Venta";
  }
  return STORE_DISPLAY_NAMES[sku] ?? sku;
}

export function formatStorePrice(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function slugifyBusinessName(input: string): string {
  const safe = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${safe || "negocio"}-${suffix}`;
}
