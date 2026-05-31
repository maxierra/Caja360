"use client";

import Link from "next/link";

type Props = {
  secondaryHref: string;
  secondaryLabel: string;
};

export function AuthSiteHeader({ secondaryHref, secondaryLabel }: Props) {
  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-sky-100/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
          <span className="size-2 rounded-full bg-sky-600 shadow-[0_0_12px_rgba(2,132,199,0.35)]" />
          <span className="text-sm font-semibold tracking-tight text-slate-900">POS SaaS</span>
        </Link>
        <Link
          href={secondaryHref}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-sky-200/90 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-sky-50/90"
        >
          {secondaryLabel}
        </Link>
      </div>
    </header>
  );
}
