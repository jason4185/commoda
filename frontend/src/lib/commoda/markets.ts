import type { Market, MarketId } from "./types";

export type MarketSlug = "wti" | "brent" | "natgas";

const MARKET_SLUGS: Record<MarketId, MarketSlug> = {
  WTI: "wti",
  BRENT: "brent",
  NATGAS: "natgas",
};

export const MARKETS: Record<MarketId, Market> = {
  WTI: {
    id: "WTI",
    name: "WTI Crude Oil",
    shortName: "WTI",
    unit: "per barrel",
    description:
      "West Texas Intermediate is the North American crude benchmark. Refiners, producers and logistics operators carry direct exposure to sharp WTI drawdowns.",
    binanceSymbol: "WTIUSDT",
    gateSymbol: "WTI_USDT",
    referencePrice: null,
    change24hPct: null,
    available: true,
  },
  BRENT: {
    id: "BRENT",
    name: "Brent Crude Oil",
    shortName: "Brent",
    unit: "per barrel",
    description:
      "Brent is the global seaborne crude benchmark used across European, African and Asian pricing. It anchors most international physical contracts.",
    binanceSymbol: "BRENTUSDT",
    gateSymbol: "BRENT_USDT",
    referencePrice: null,
    change24hPct: null,
    available: true,
  },
  NATGAS: {
    id: "NATGAS",
    name: "Natural Gas",
    shortName: "Nat Gas",
    unit: "per MMBtu",
    description:
      "Henry Hub natural gas is among the most volatile energy benchmarks, with weather-driven drawdowns that move faster than most hedging cycles.",
    binanceSymbol: "NGUSDT",
    gateSymbol: "NG_USDT",
    referencePrice: null,
    change24hPct: null,
    available: true,
  },
};

export const MARKET_LIST: Market[] = [MARKETS.WTI, MARKETS.BRENT, MARKETS.NATGAS];

export const priceDigits = (id: MarketId) => (id === "NATGAS" ? 3 : 2);

export function marketFromSlug(value: string | undefined): MarketId | null {
  if (!value) return null;
  const entry = (Object.entries(MARKET_SLUGS) as [MarketId, MarketSlug][]).find(([, slug]) => slug === value.toLowerCase());
  return entry?.[0] ?? null;
}

export function marketToSlug(id: MarketId): MarketSlug {
  return MARKET_SLUGS[id];
}
