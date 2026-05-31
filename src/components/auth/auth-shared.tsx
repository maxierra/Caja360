import type { LucideIcon } from "lucide-react";
import { Store } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/** Misma base visual que la landing (minimal + pasteles suaves) */
export const authPageBackgroundClass =
  "min-h-screen flex flex-col text-slate-900 bg-gradient-to-b from-sky-50/90 via-zinc-50 to-emerald-50/70";

export const authCommerceHeroImageUrl =
  "https://images.unsplash.com/photo-1441986300917-64667bdceb1?auto=format&fit=crop&w=1600&q=85";

export const authInputClassName =
  "h-11 border-slate-200 bg-white pl-10 text-slate-900 placeholder:text-slate-400 shadow-sm focus-visible:border-sky-400 focus-visible:ring-sky-400/25";

export const authLabelClassName = "text-sm font-medium text-slate-700";

/** Iconos dentro del campo (Mail, Lock) — el padre ya tiene `relative` */
export const authInputIconClassName = "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400";

type MarketingFeature = { icon: LucideIcon; text: string };

type AuthMarketingPanelProps = {
  headline: string;
  description: string;
  features: MarketingFeature[];
  logoUrl?: string;
};

const featureTone = [
  { wrap: "border-sky-100 bg-sky-50 text-sky-700", icon: "text-sky-600" },
  { wrap: "border-emerald-100 bg-emerald-50 text-emerald-800", icon: "text-emerald-600" },
] as const;

export function AuthMarketingPanel({
  headline,
  description,
  features,
  logoUrl = "/newlogo.jpeg",
}: AuthMarketingPanelProps) {
  return (
    <section className="relative hidden min-h-[560px] overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-white via-sky-50/50 to-violet-50/40 shadow-xl shadow-sky-100/60 lg:block lg:min-h-[640px]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 top-16 h-56 w-56 rounded-full bg-violet-200/35 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-8 bottom-24 h-48 w-48 rounded-full bg-emerald-200/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-40 w-[80%] max-w-md -translate-x-1/2 rounded-full bg-sky-200/25 blur-3xl"
      />

      <div className="relative flex h-full flex-col p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="group relative">
            <div className="absolute -inset-3 rounded-3xl bg-gradient-to-tr from-sky-200/40 via-violet-200/30 to-emerald-200/35 blur-xl opacity-80 transition-opacity group-hover:opacity-100" />
            <img
              src={logoUrl}
              alt="Logo"
              className="relative h-64 w-auto rounded-2xl border border-white/80 bg-white object-contain p-2 shadow-lg shadow-sky-200/50 ring-1 ring-violet-100/80 transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </div>
        </div>

        <div className="mt-auto space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/90 bg-sky-50/90 px-3 py-1.5 text-xs font-semibold text-sky-950 shadow-sm backdrop-blur-sm">
            <Store className="size-3.5 text-sky-600" />
            Sistema de Gestión PRO
          </div>
          <div>
            <h2 className="text-balance text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{headline}</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 md:text-base">{description}</p>
          </div>
          <ul className="grid gap-3 text-sm text-slate-700">
            {features.map(({ icon: Icon, text }, i) => {
              const tone = featureTone[i % featureTone.length];
              return (
                <li key={text} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl border shadow-sm backdrop-blur-sm",
                      tone.wrap,
                    )}
                  >
                    <Icon className={cn("size-4", tone.icon)} />
                  </span>
                  {text}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

type AuthFormSurfaceProps = {
  children: React.ReactNode;
  className?: string;
};

export function AuthFormSurface({ children, className }: AuthFormSurfaceProps) {
  return (
    <section
      className={cn(
        "mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-sky-100 bg-white/95 shadow-xl shadow-sky-200/40 ring-1 ring-violet-50/90 backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}

type AuthEyebrowProps = { children: React.ReactNode };

export function AuthEyebrow({ children }: AuthEyebrowProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/90 bg-sky-50/90 px-3 py-1 text-xs font-semibold text-sky-950 shadow-sm">
      {children}
    </div>
  );
}

export function AuthFormHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 bg-gradient-to-br from-white to-sky-50/30 p-6 md:p-8">
      {eyebrow}
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-slate-600 md:text-base">{description}</p>
      {children}
    </div>
  );
}

export function AuthFormBody({ children }: { children: React.ReactNode }) {
  return <div className="p-6 md:p-8 md:pt-6">{children}</div>;
}

export function AuthFormFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 bg-gradient-to-r from-sky-50/40 via-white to-violet-50/30 px-6 py-5 md:px-8">
      {children}
    </div>
  );
}

export function authAlertError(message: string) {
  return (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">{message}</div>
  );
}

export function authAlertSuccess(message: string) {
  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
      {message}
    </div>
  );
}

export function AuthPrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="mt-1 h-12 w-full rounded-2xl bg-sky-700 text-sm font-semibold text-white shadow-md shadow-sky-300/40 transition-colors hover:bg-sky-800 active:scale-[0.99]"
    >
      {children}
    </button>
  );
}

export function AuthTextLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-sm font-medium text-sky-800 underline-offset-4 transition hover:text-sky-950 hover:underline",
        className,
      )}
    >
      {children}
    </Link>
  );
}
