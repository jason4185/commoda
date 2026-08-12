import type { DropPct, DurationDays, Terms } from "./types";

export const DROPS: DropPct[] = [1, 2, 3];
export const DURATIONS: DurationDays[] = [7, 14, 30];

const PREMIUM: Record<DurationDays, number> = { 7: 1, 14: 2, 30: 3 };

const PAYOUT: Record<DurationDays, Record<DropPct, number>> = {
  7: { 1: 2, 2: 3, 3: 4 },
  14: { 1: 4, 2: 5, 3: 6 },
  30: { 1: 6, 2: 8, 3: 10 },
};

export function getTerms(duration: DurationDays, drop: DropPct): Terms {
  return {
    duration,
    drop,
    premium: PREMIUM[duration],
    payout: PAYOUT[duration][drop],
  };
}

export const TERMS_TABLE: Terms[] = DURATIONS.flatMap((d) =>
  DROPS.map((p) => getTerms(d, p)),
);

export function triggerPrice(reference: number | null, drop: DropPct): number | null {
  return reference === null ? null : reference * (1 - drop / 100);
}
