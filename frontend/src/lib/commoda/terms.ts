import type { DropPct, DurationDays } from "./types";

// UI selector metadata only. Premiums and payouts are always read from the contract.
export const DROPS = [1, 2, 3] as const satisfies readonly DropPct[];
export const DURATIONS = [7, 14, 30] as const satisfies readonly DurationDays[];
