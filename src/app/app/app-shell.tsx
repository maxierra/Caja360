"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import {
  BarChart3,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  LayoutDashboard,
  Menu,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Tag,
  Truck,
  UserCircle2,
  Users,
  Wallet,
  X,
} from "lucide-react";

import femaleAvatar from "@/female.png";
import maleAvatar from "@/men.png";

import { signOut } from "@/app/auth/actions";
import { ActivitySessionPing } from "@/components/activity-session-ping";
import { ThemeToggle } from "@/components/theme-toggle";
import { TrialCountdown } from "@/components/trial-countdown";
import { Button } from "@/components/ui/button";
import { memberCanAccessAppPath } from "@/lib/employee-permissions";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Clase Tailwind para el color principal del ítem (icono/texto activo). */
  colorClass: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, colorClass: "text-emerald-500" },
  { href: "/app/pos", label: "Punto de venta", icon: ShoppingCart, colorClass: "text-emerald-500" },
  { href: "/app/inventory", label: "Inventario", icon: Boxes, colorClass: "text-sky-500" },
  { href: "/app/products", label: "Productos", icon: Package, colorClass: "text-violet-500" },
  { href: "/app/clientes", label: "Clientes", icon: Users, colorClass: "text-cyan-500" },
  { href: "/app/proveedores", label: "Proveedores", icon: Truck, colorClass: "text-amber-500" },
  { href: "/app/empleados", label: "Empleados", icon: UserCircle2, colorClass: "text-rose-500" },
  { href: "/app/etiquetas", label: "Etiquetas", icon: Tag, colorClass: "text-fuchsia-500" },
  { href: "/app/sales", label: "Ventas", icon: Receipt, colorClass: "text-indigo-500" },
  { href: "/app/facturacion", label: "Facturación", icon: FileText, colorClass: "text-teal-500" },
  { href: "/app/cash", label: "Caja", icon: Wallet, colorClass: "text-emerald-500" },
  { href: "/app/reports", label: "Reportes", icon: BarChart3, colorClass: "text-sky-500" },
  { href: "/app/subscription", label: "Suscripción", icon: CreditCard, colorClass: "text-purple-500" },
  { href: "/app/settings", label: "Configuración", icon: Settings, colorClass: "text-slate-500" },
];

type Props = {
  children: React.ReactNode;
  business: {
    id: string | null;
    name: string | null;
  };
  user: {
    email: string | null;
    avatar?: string | null;
  };
  cash: {
    open: boolean;
  };
  access?: {
    role: string | null;
    permissions: Record<string, any> | null;
  };
  plan?: {
    label: string;
    /** ISO end of trial; muestra contador en sidebar */
    trialEndsAt?: string | null;
  };
};

function ShortcutBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg border border-[var(--pos-border)] bg-[var(--pos-surface)] px-2 py-1 text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function userAvatarSrc(avatar?: string | null) {
  if (avatar === "female") return femaleAvatar;
  if (avatar === "male") return maleAvatar;
  return null;
}

function userInitials(email: string | null) {
  const base = (email ?? "").trim();
  if (!base) return "U";
  const name = base.split("@")[0] ?? base;
  const parts = name.split(/[._\-\s]+/).filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .filter(Boolean);
  return letters.join("") || name.slice(0, 2).toUpperCase();
}

function NavLinks({
  navItems,
  pathname,
  iconOnly,
  onNavigate,
}: {
  navItems: NavItem[];
  pathname: string;
  iconOnly: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="grid gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onNavigate?.()}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
              "text-muted-foreground hover:bg-[var(--pos-surface-2)] hover:text-foreground",
              active ? "bg-[var(--pos-surface-2)] text-foreground" : "",
              iconOnly ? "justify-center" : ""
            )}
          >
            {active ? (
              <span className="absolute left-0 top-2 h-[calc(100%-16px)] w-1 rounded-r bg-[var(--pos-accent)]" />
            ) : null}
            <Icon
              className={cn(
                "size-4 shrink-0 transition-colors",
                item.colorClass,
                active ? "opacity-100" : "opacity-60 group-hover:opacity-100"
              )}
            />
            {iconOnly ? null : (
              <span
                className={cn(
                  "truncate transition-colors",
                  active ? "font-semibold" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, business, user, cash, access, plan }: Props) {
  const pathname = usePathname();

  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const navItems = React.useMemo(() => {
    const base = NAV_ITEMS;
    const role = access?.role ?? null;
    const perms = (access?.permissions ?? {}) as Record<string, unknown>;
    return base.filter((item) => memberCanAccessAppPath(item.href, role, perms));
  }, [access?.role, access?.permissions]);

  React.useEffect(() => {
    const saved = window.localStorage.getItem("app_sidebar_collapsed");
    setCollapsed(saved === "1");
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem("app_sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const businessLabel = business.name ?? (business.id ? `${business.id.slice(0, 8)}…` : "Sin negocio");

  return (
    <div className="min-h-dvh w-full bg-[var(--pos-bg)]">
      <ActivitySessionPing businessId={business.id} />
      {mobileNavOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100vw-2rem))] max-w-[100vw] flex-col border-r border-[var(--pos-border)] bg-[#f5f7fb] shadow-xl transition-transform duration-200 ease-out dark:bg-[var(--sidebar)]",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        )}
        role="dialog"
        aria-modal={mobileNavOpen}
        aria-hidden={!mobileNavOpen}
        aria-label="Menú de navegación"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--pos-border)] p-4">
          <Link
            href="/app"
            className="flex min-w-0 flex-1 items-center gap-3"
            onClick={() => setMobileNavOpen(false)}
          >
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--pos-accent)] text-black shadow-[0_0_0_1px_var(--pos-glow)]">
              <ShoppingCart className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight">{businessLabel}</div>
              <div className="truncate text-xs text-muted-foreground">POS SaaS</div>
            </div>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks
            navItems={navItems}
            pathname={pathname}
            iconOnly={false}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </div>

        <div className="border-t border-[var(--pos-border)] p-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface-2)] text-sm font-semibold text-muted-foreground">
              {userAvatarSrc(user.avatar) ? (
                <Image
                  src={userAvatarSrc(user.avatar)!}
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 object-cover"
                />
              ) : (
                userInitials(user.email)
              )}
            </span>
            <div className="min-w-0 text-sm">
              <div className="truncate font-medium">{user.email ?? "Usuario"}</div>
              <div className="text-xs text-muted-foreground">
                Plan: {plan?.label ?? "—"}
                {plan?.trialEndsAt ? (
                  <>
                    {" "}
                    · demo{" "}
                    <TrialCountdown endsAt={plan.trialEndsAt} variant="compact" className="inline text-xs" />
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-dvh w-full gap-4 px-2 py-4 md:px-3">
        <aside
          className={cn(
            "sticky top-4 hidden h-[calc(100dvh-2rem)] shrink-0 flex-col rounded-2xl border border-[var(--pos-border)] bg-[#f5f7fb] shadow-sm md:flex dark:bg-[var(--sidebar)]",
            collapsed ? "w-20" : "w-72"
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--pos-border)] p-4">
            <Link href="/app" className="flex min-w-0 items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-[var(--pos-accent)] text-black shadow-[0_0_0_1px_var(--pos-glow)]">
                <ShoppingCart className="size-5" />
              </span>
              {collapsed ? null : (
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold tracking-tight">{businessLabel}</div>
                  <div className="truncate text-xs text-muted-foreground">POS SaaS</div>
                </div>
              )}
            </Link>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
            >
              {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </Button>
          </div>

          <div className={cn("flex-1 p-2", collapsed ? "" : "p-3")}>
            <NavLinks navItems={navItems} pathname={pathname} iconOnly={collapsed} />
          </div>

          <div className="border-t border-[var(--pos-border)] p-4">
            <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "")}
            >
              <span className="inline-flex size-10 items-center justify-center overflow-hidden rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface-2)] text-sm font-semibold text-muted-foreground">
                {userAvatarSrc(user.avatar) ? (
                  <Image
                    src={userAvatarSrc(user.avatar)!}
                    alt="avatar"
                    width={40}
                    height={40}
                    className="size-10 object-cover"
                    priority
                  />
                ) : (
                  userInitials(user.email)
                )}
              </span>
              {collapsed ? null : (
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{user.email ?? "Usuario"}</div>
                  <div className="text-xs text-muted-foreground">
                    Plan: {plan?.label ?? "—"}
                    {plan?.trialEndsAt ? (
                      <>
                        {" "}
                        · demo{" "}
                        <TrialCountdown endsAt={plan.trialEndsAt} variant="compact" className="inline text-xs" />
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--pos-border)] bg-gradient-to-r from-[var(--pos-surface-2)] to-[var(--pos-surface)] px-3 py-3 shadow-sm sm:gap-3 sm:px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 md:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Abrir menú"
                aria-expanded={mobileNavOpen}
              >
                <Menu className="size-5" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-semibold tracking-tight">{businessLabel}</div>
                  {business.id ? (
                    <span className="hidden min-[400px]:inline-flex rounded-lg border border-[var(--pos-border)] bg-[var(--pos-surface-2)] px-2 py-1 text-[11px] font-medium text-muted-foreground">
                      {business.id.slice(0, 8)}…
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={cn(
                        "relative inline-flex size-2 rounded-full",
                        cash.open ? "bg-emerald-400" : "bg-destructive"
                      )}
                    >
                      {cash.open ? (
                        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" />
                      ) : null}
                    </span>
                    {cash.open ? "Caja abierta" : "Caja cerrada"}
                  </span>
                  <span className="hidden md:inline-flex items-center gap-2">
                    <ShortcutBadge>F2</ShortcutBadge>
                    <ShortcutBadge>F4</ShortcutBadge>
                    <ShortcutBadge>ESC</ShortcutBadge>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <ThemeToggle />
              <form action={signOut}>
                <Button type="submit" variant="outline" size="sm" className="px-2.5">
                  Salir
                </Button>
              </form>
            </div>
          </header>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
