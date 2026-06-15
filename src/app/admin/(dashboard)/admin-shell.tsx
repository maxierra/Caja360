"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Bell,
  CreditCard,
  Activity,
  PackageSearch,
  Shield,
  ChevronLeft,
  ChevronRight,
  Truck,
} from "lucide-react";

import { adminSignOut } from "@/app/admin/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Suscripciones", icon: CreditCard },
  { href: "/admin/payments", label: "Pagos", icon: CreditCard },
  { href: "/admin/envios", label: "Envíos", icon: Truck },
  { href: "/admin/carga-productos", label: "Carga productos", icon: PackageSearch },
  { href: "/admin/alertas", label: "Alertas", icon: Bell },
  { href: "/admin/monitoring", label: "Monitoreo", icon: Activity },
];

type Props = {
  children: React.ReactNode;
  user: {
    email: string | null;
  };
};

const SIDEBAR_COLLAPSED_KEY = "admin_sidebar_collapsed";
const SIDEBAR_COLLAPSED_EVENT = "admin-sidebar-collapsed-change";

function getSidebarCollapsedSnapshot() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
}

function subscribeToSidebarCollapsed(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange);
  };
}

function userInitials(email: string | null) {
  const base = (email ?? "").trim();
  if (!base) return "A";
  const name = base.split("@")[0] ?? base;
  const parts = name.split(/[._\-\s]+/).filter(Boolean);
  const letters = parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .filter(Boolean);
  return letters.join("") || name.slice(0, 2).toUpperCase();
}

export function AdminShell({ children, user }: Props) {
  const pathname = usePathname();
  const collapsed = React.useSyncExternalStore(
    subscribeToSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    () => false
  );

  const toggleCollapsed = React.useCallback(() => {
    const next = !getSidebarCollapsedSnapshot();
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT));
  }, []);

  return (
    <div className="min-h-dvh w-full bg-[var(--pos-bg)]">
      <div className="flex min-h-dvh w-full gap-4 px-2 py-4 md:px-3">
        {/* Sidebar */}
        <aside
          className={cn(
            "sticky top-4 hidden h-[calc(100dvh-2rem)] shrink-0 flex-col rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface)] shadow-sm md:flex",
            collapsed ? "w-20" : "w-64"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-[var(--pos-border)] p-4">
            <Link href="/admin" className="flex min-w-0 items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-[0_0_0_1px_rgba(234,88,12,0.5)]">
                <Shield className="size-5" />
              </span>
              {collapsed ? null : (
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold tracking-tight">
                    Panel Admin
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    Plataforma
                  </div>
                </div>
              )}
            </Link>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronLeft className="size-4" />
              )}
            </Button>
          </div>

          {/* Nav */}
          <div className={cn("flex-1 p-2", collapsed ? "" : "p-3")}>
            <nav className="grid gap-1">
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                      "text-muted-foreground hover:bg-[var(--pos-surface-2)] hover:text-foreground",
                      active ? "bg-[var(--pos-surface-2)] text-foreground" : "",
                      collapsed ? "justify-center" : ""
                    )}
                  >
                    {active ? (
                      <span className="absolute left-0 top-2 h-[calc(100%-16px)] w-1 rounded-r bg-orange-500" />
                    ) : null}
                    <Icon
                      className={cn(
                        "size-4",
                        active ? "text-orange-500" : ""
                      )}
                    />
                    {collapsed ? null : (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--pos-border)] p-4">
            <div
              className={cn(
                "flex items-center gap-3",
                collapsed ? "justify-center" : ""
              )}
            >
              <span className="inline-flex size-10 items-center justify-center overflow-hidden rounded-2xl border border-orange-500/40 bg-orange-600/20 text-sm font-semibold text-orange-400">
                {userInitials(user.email)}
              </span>
              {collapsed ? null : (
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {user.email ?? "Admin"}
                  </div>
                  <div className="text-xs text-orange-500 font-medium">
                    Administrador
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Header bar */}
          <header className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--pos-border)] bg-[var(--pos-surface)] px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-8 items-center justify-center rounded-xl bg-orange-600/20 text-orange-500">
                <Shield className="size-4" />
              </span>
              <div>
                <div className="text-sm font-semibold tracking-tight">
                  Panel de Administración
                </div>
                <div className="text-xs text-muted-foreground">
                  {user.email}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <form action={adminSignOut}>
                <Button type="submit" variant="outline" size="sm">
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
