/**
 * Permisos de empleado (rol !== owner): una clave por pantalla del menú.
 * Guardado en memberships.permissions (jsonb).
 */

export type EmployeePermissionKey =
  | "dashboard"
  | "pos"
  | "sales"
  | "cash"
  | "inventory"
  | "products"
  | "clientes"
  | "proveedores"
  | "empleados"
  | "etiquetas"
  | "reports"
  | "subscription"
  | "settings";

/** Flags adicionales para acciones finas dentro de cada módulo. */
export type EmployeePermissionActionKey =
  | "sales_void" // puede anular ventas
  | "products_edit_price" // puede editar precios de productos
  | "products_edit_stock"; // puede editar stock de productos

export type EmployeePermissionFlag = EmployeePermissionKey | EmployeePermissionActionKey;

/** Opciones en Configuración → empleados (orden del menú lateral). */
export const EMPLOYEE_PERMISSION_OPTIONS: readonly { key: EmployeePermissionKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "pos", label: "Punto de venta" },
  { key: "sales", label: "Ventas (historial)" },
  { key: "cash", label: "Caja" },
  { key: "inventory", label: "Inventario" },
  { key: "products", label: "Productos" },
  { key: "clientes", label: "Clientes" },
  { key: "proveedores", label: "Proveedores" },
  { key: "empleados", label: "Empleados" },
  { key: "etiquetas", label: "Etiquetas" },
  { key: "reports", label: "Reportes" },
  { key: "subscription", label: "Suscripción" },
  { key: "settings", label: "Configuración" },
] as const;

export function defaultEmployeePermissions(): Record<EmployeePermissionFlag, boolean> {
  return {
    dashboard: false,
    pos: false,
    sales: false,
    cash: false,
    inventory: false,
    products: false,
    clientes: false,
    proveedores: false,
    empleados: false,
    etiquetas: false,
    reports: false,
    subscription: false,
    settings: false,
    sales_void: false,
    products_edit_price: false,
    products_edit_stock: false,
  };
}

/** Compatibilidad: antes clientes/proveedores/empleados/etiquetas usaban la clave "products". */
export function normalizePermissionsFromStorage(raw: Record<string, unknown> | null | undefined): Record<string, boolean> {
  const base = defaultEmployeePermissions();
  const src = raw ?? {};
  const legacyProducts = src.products === true;

  for (const k of Object.keys(base) as EmployeePermissionFlag[]) {
    if (src[k] !== undefined && src[k] !== null) {
      (base as any)[k] = Boolean(src[k]);
    }
  }

  const missingSub =
    src.clientes === undefined &&
    src.proveedores === undefined &&
    src.empleados === undefined &&
    src.etiquetas === undefined;

  if (missingSub && legacyProducts) {
    base.clientes = true;
    base.proveedores = true;
    base.empleados = true;
    base.etiquetas = true;
  }

  if (src.pos == null && src.sales === true) {
    base.pos = true;
  }

  return base as Record<string, boolean>;
}

function can(permissions: Record<string, unknown>, key: string): boolean {
  return Boolean((permissions as any)?.[key]);
}

/** Punto de venta: históricamente podía habilitarse con "ventas". */
export function canAccessPos(permissions: Record<string, unknown>): boolean {
  return can(permissions, "pos") || can(permissions, "sales");
}

/**
 * ¿Puede un miembro (no owner) ver esta ruta? Usar en middleware / shell.
 */
export function memberCanAccessAppPath(
  pathname: string,
  role: string | null | undefined,
  permissions: Record<string, unknown> | null | undefined
): boolean {
  if (role === "owner") return true;
  const p = permissions ?? {};

  if (pathname === "/app" || pathname.startsWith("/app?")) return can(p, "dashboard");
  if (pathname.startsWith("/app/subscription")) return can(p, "subscription");
  if (pathname.startsWith("/app/pos")) return canAccessPos(p);
  if (pathname.startsWith("/app/inventory")) return can(p, "inventory");
  if (pathname.startsWith("/app/sales")) return can(p, "sales");
  if (pathname.startsWith("/app/facturacion")) return can(p, "sales");
  if (pathname.startsWith("/app/cash")) return can(p, "cash");
  if (pathname.startsWith("/app/products")) return can(p, "products");
  if (pathname.startsWith("/app/clientes")) return can(p, "clientes");
  if (pathname.startsWith("/app/proveedores")) return can(p, "proveedores");
  if (pathname.startsWith("/app/empleados")) return can(p, "empleados");
  if (pathname.startsWith("/app/etiquetas")) return can(p, "etiquetas");
  if (pathname.startsWith("/app/reports")) return can(p, "reports");
  if (pathname.startsWith("/app/settings")) return can(p, "settings");

  return false;
}

/** Primera ruta permitida para redirecciones (sin dashboard). */
export function firstAllowedMemberPath(permissions: Record<string, unknown>): string | null {
  const p = permissions ?? {};
  if (canAccessPos(p)) return "/app/pos";
  if (can(p, "inventory")) return "/app/inventory";
  if (can(p, "cash")) return "/app/cash";
  if (can(p, "products")) return "/app/products";
  if (can(p, "clientes")) return "/app/clientes";
  if (can(p, "proveedores")) return "/app/proveedores";
  if (can(p, "empleados")) return "/app/empleados";
  if (can(p, "etiquetas")) return "/app/etiquetas";
  if (can(p, "sales")) return "/app/sales";
  if (can(p, "reports")) return "/app/reports";
  if (can(p, "settings")) return "/app/settings";
  if (can(p, "subscription")) return "/app/subscription";
  return null;
}
