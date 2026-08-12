export const gen = (v: number | bigint | null | undefined) =>
  v === null || v === undefined ? "—" : typeof v === "bigint" ? `${Number(v) / 1e18} GEN` : `${Number.isInteger(v) ? v : v.toFixed(2)} GEN`;

export const usd = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `$${v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};
