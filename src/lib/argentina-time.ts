import { parseDbTimestamptzToDate } from "@/lib/parse-db-timestamp";

const AR_TIME_ZONE = "America/Argentina/Buenos_Aires";

function arDateParts(baseDate: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(baseDate);

  const get = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

export function getArgentinaDayRangeUtcIso(dateInput?: string | null) {
  const ymd =
    dateInput && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
      ? dateInput
      : (() => {
          const { year, month, day } = arDateParts(new Date());
          return `${year}-${month}-${day}`;
        })();

  return {
    ymd,
    startIso: `${ymd}T00:00:00-03:00`,
    endExclusiveIso: nextArgentinaDateYmd(ymd, 1) + "T00:00:00-03:00",
    endInclusiveIso: `${ymd}T23:59:59.999-03:00`,
  };
}

export function nextArgentinaDateYmd(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0, 0));
  const { year: yy, month: mm, day: dd } = arDateParts(date);
  return `${yy}-${mm}-${dd}`;
}

export function formatArgentinaDateTime(input: string) {
  const date = parseDbTimestamptzToDate(input) ?? new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: AR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatArgentinaShortDate(input: string) {
  const date = parseDbTimestamptzToDate(input) ?? new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: AR_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export function toArgentinaDateForExport(input: string) {
  const date = parseDbTimestamptzToDate(input) ?? new Date(input);
  return date;
}
