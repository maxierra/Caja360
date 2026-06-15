"use client";

import * as React from "react";

import { Barcode, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  inputRef?: React.Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
};

export function SearchBar({ inputRef, value, onChange, onKeyDown, className, placeholder }: Props) {
  return (
    <div className={cn("relative", className)}>
      <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center gap-2 text-muted-foreground">
        <Search className="size-4" />
      </div>

      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? "Buscar por nombre o escanear código de barras..."}
        className={cn(
          "h-12 rounded-2xl bg-[var(--pos-surface-2)] pl-10 pr-4 text-base lg:pr-24",
          "border border-[var(--pos-border)]",
          "focus-visible:ring-3 focus-visible:ring-[var(--pos-glow)] focus-visible:border-[var(--pos-accent)]"
        )}
      />

      <div className="pointer-events-none absolute inset-y-0 right-3 hidden items-center gap-2 lg:flex">
        <span className="rounded-lg border border-[var(--pos-border)] bg-[var(--pos-surface)] px-2 py-1 text-[11px] font-medium text-muted-foreground">
          F2
        </span>
        <div className="flex size-9 items-center justify-center rounded-xl border border-[var(--pos-border)] bg-[var(--pos-surface)] text-muted-foreground">
          <Barcode className="size-4" />
        </div>
      </div>
    </div>
  );
}
