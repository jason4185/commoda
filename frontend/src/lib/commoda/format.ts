export const gen = (v: number | bigint | null | undefined) =>
  v === null || v === undefined ? "—" : typeof v === "bigint" ? `${Number(v) / 1e18} GEN` : `${Number.isInteger(v) ? v : v.toFixed(2)} GEN`;

export const usd = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `$${v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isoDateOnly = (value: string | null | undefined) => {
  const text = String(value ?? "");
  const direct = text.match(ISO_DATE);
  if (direct) return text;
  const timestamp = text.match(/^(\d{4}-\d{2}-\d{2})T/);
  return timestamp?.[1] ?? null;
};

const parsedDateParts = (value: string | null | undefined) => {
  const canonical = isoDateOnly(value);
  if (!canonical) return null;
  const match = canonical.match(ISO_DATE);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
};

export const dateLabel = (iso: string | null | undefined) => {
  const parts = parsedDateParts(iso);
  return parts ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day))) : "Date unavailable";
};

export const shortDate = (iso: string | null | undefined) => {
  const parts = parsedDateParts(iso);
  return parts ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day))) : "Date unavailable";
};

export const addDaysToIsoDate = (value: string | null | undefined, days: number) => {
  const parts = parsedDateParts(value);
  if (!parts || !Number.isInteger(days)) return null;
  const result = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, "0")}-${String(result.getUTCDate()).padStart(2, "0")}`;
};

export const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};
