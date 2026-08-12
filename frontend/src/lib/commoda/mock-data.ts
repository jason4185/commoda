import { MARKETS } from "./markets";
import { getTerms, triggerPrice } from "./terms";
import { addDays } from "./format";
import type { DayResult, Protection, SettlementDay } from "./types";

const iso = (d: Date) => d.toISOString().slice(0, 10);

function buildDays(
  start: Date,
  duration: number,
  settled: number,
  reference: number,
  trigger: number,
  breachOn?: number,
  inconclusiveOn?: number,
): SettlementDay[] {
  return Array.from({ length: duration }, (_, i) => {
    const day = i + 1;
    const date = iso(addDays(start, day));
    if (day > settled) {
      return { day, date, result: "UNPROCESSED" as DayResult, binanceClose: null, gateClose: null };
    }
    if (day === inconclusiveOn) {
      return {
        day,
        date,
        result: "INCONCLUSIVE" as DayResult,
        binanceClose: Number((trigger * 0.999).toFixed(3)),
        gateClose: Number((trigger * 1.002).toFixed(3)),
        note: "Sources disagreed on the breach condition. Queued for retry.",
      };
    }
    if (day === breachOn) {
      return {
        day,
        date,
        result: "BREACHED" as DayResult,
        binanceClose: Number((trigger * 0.994).toFixed(3)),
        gateClose: Number((trigger * 0.996).toFixed(3)),
      };
    }
    const drift = 1 + (((day * 37) % 11) - 4) / 400;
    return {
      day,
      date,
      result: "NOT_BREACHED" as DayResult,
      binanceClose: Number((reference * drift).toFixed(3)),
      gateClose: Number((reference * drift * 1.0004).toFixed(3)),
    };
  });
}

function make(
  id: string,
  market: keyof typeof MARKETS,
  drop: 1 | 2 | 3,
  duration: 7 | 14 | 30,
  startedDaysAgo: number,
  state: Protection["state"],
  opts: { settled?: number; breachOn?: number; inconclusiveOn?: number } = {},
): Protection {
  const m = MARKETS[market];
  const start = addDays(new Date(), -startedDaysAgo);
  const reference = Number((m.referencePrice * 1.01).toFixed(3));
  const trigger = Number(triggerPrice(reference, drop).toFixed(3));
  const terms = getTerms(duration, drop);
  const settled = opts.settled ?? Math.min(startedDaysAgo, duration);
  return {
    id,
    market: m.id,
    drop,
    duration,
    referencePrice: reference,
    triggerPrice: trigger,
    premium: terms.premium,
    payout: terms.payout,
    startDate: iso(start),
    endDate: iso(addDays(start, duration)),
    state,
    days: buildDays(start, duration, settled, reference, trigger, opts.breachOn, opts.inconclusiveOn),
  };
}

export const seedProtections: Protection[] = [
  make("CMD-1042", "WTI", 2, 30, 11, "ACTIVE", { inconclusiveOn: 6 }),
  make("CMD-1038", "NATGAS", 3, 14, 9, "CLAIMABLE", { breachOn: 7 }),
  make("CMD-1031", "BRENT", 1, 7, 12, "EXPIRED", { settled: 7 }),
  make("CMD-1024", "WTI", 3, 14, 26, "CLAIMED", { settled: 14, breachOn: 5 }),
  make("CMD-1019", "BRENT", 2, 30, 4, "ACTIVE"),
];

export const seedPool = {
  poolBalance: 184_520,
  reservedLiability: 42_180,
  activeProtections: 318,
  payoutsPaid: 61_940,
  protectionsIssued: 1_284,
  utilisationPct: 22.9,
};

export const seedWallet = {
  address: "0x7A31f4C2b0Ae91D6f5Cc3e0b842dE19a7C5f0B31",
  balance: 128.5,
  connected: true,
};