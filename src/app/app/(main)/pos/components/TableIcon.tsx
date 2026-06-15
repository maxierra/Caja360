import * as React from "react";
import { cn } from "@/lib/utils";

export type TableVisualStatus = "libre" | "ocupada" | "en_preparacion" | "servida";

type VisualColors = {
  tableFill: string;
  tableStroke: string;
  chairFill: string;
  chairStroke: string;
  textFill: string;
  badgeFill: string;
  badgeText: string;
};

const STATUS_COLORS: Record<TableVisualStatus, VisualColors> = {
  libre: {
    tableFill: "#10b981",
    tableStroke: "#059669",
    chairFill: "#34d399",
    chairStroke: "#047857",
    textFill: "#ffffff",
    badgeFill: "#047857",
    badgeText: "#ffffff",
  },
  ocupada: {
    tableFill: "#f59e0b",
    tableStroke: "#d97706",
    chairFill: "#fbbf24",
    chairStroke: "#b45309",
    textFill: "#ffffff",
    badgeFill: "#b45309",
    badgeText: "#ffffff",
  },
  en_preparacion: {
    tableFill: "#3b82f6",
    tableStroke: "#2563eb",
    chairFill: "#60a5fa",
    chairStroke: "#1d4ed8",
    textFill: "#ffffff",
    badgeFill: "#1d4ed8",
    badgeText: "#ffffff",
  },
  servida: {
    tableFill: "#8b5cf6",
    tableStroke: "#7c3aed",
    chairFill: "#a78bfa",
    chairStroke: "#6d28d9",
    textFill: "#ffffff",
    badgeFill: "#6d28d9",
    badgeText: "#ffffff",
  },
};

const SIZE_CLASSES = {
  sm: "size-20",
  md: "size-[120px]",
  lg: "size-[140px]",
} as const;

const MAX_NAME_LENGTH = 8;

function truncateTableName(name: string, maxLen = MAX_NAME_LENGTH): string {
  if (name.length <= maxLen) return name;
  return `${name.slice(0, maxLen - 1)}…`;
}

export type SalonTableVisualProps = {
  tableName: string;
  status: TableVisualStatus;
  size?: keyof typeof SIZE_CLASSES;
  itemCount?: number;
  total?: number;
  className?: string;
};

export function SalonTableVisual({
  tableName,
  status,
  size = "md",
  itemCount,
  className,
}: SalonTableVisualProps) {
  const colors = STATUS_COLORS[status];
  const displayName = truncateTableName(tableName);
  const fontSize = displayName.length <= 4 ? 11 : displayName.length <= 6 ? 9 : 8;

  return (
    <div className={cn("relative shrink-0", SIZE_CLASSES[size], className)}>
      <svg
        viewBox="0 0 100 100"
        className="size-full transition-transform duration-150 group-hover:scale-105"
        aria-hidden="true"
        role="img"
      >
        {/* Chairs */}
        <rect x="38" y="8" width="24" height="14" rx="4" fill={colors.chairFill} stroke={colors.chairStroke} strokeWidth="1.5" />
        <rect x="38" y="78" width="24" height="14" rx="4" fill={colors.chairFill} stroke={colors.chairStroke} strokeWidth="1.5" />
        <rect x="8" y="38" width="14" height="24" rx="4" fill={colors.chairFill} stroke={colors.chairStroke} strokeWidth="1.5" />
        <rect x="78" y="38" width="14" height="24" rx="4" fill={colors.chairFill} stroke={colors.chairStroke} strokeWidth="1.5" />

        {/* Table surface */}
        <rect
          x="28"
          y="28"
          width="44"
          height="44"
          rx="5"
          fill={colors.tableFill}
          stroke={colors.tableStroke}
          strokeWidth="2"
        />

        {/* Table name */}
        <text
          x="50"
          y="52"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={colors.textFill}
          fontSize={fontSize}
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
        >
          {displayName}
        </text>

        {/* Item count badge */}
        {itemCount != null && itemCount > 0 ? (
          <>
            <circle cx="82" cy="18" r="11" fill={colors.badgeFill} stroke="#ffffff" strokeWidth="1.5" />
            <text
              x="82"
              y="18"
              textAnchor="middle"
              dominantBaseline="middle"
              fill={colors.badgeText}
              fontSize="9"
              fontWeight="700"
              fontFamily="system-ui, sans-serif"
            >
              {itemCount > 99 ? "99+" : itemCount}
            </text>
          </>
        ) : null}
      </svg>
    </div>
  );
}
