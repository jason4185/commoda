import type { Market, MarketId } from "./types";

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
    referencePrice: 78.42,
    change24hPct: -0.86,
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
    referencePrice: 82.15,
    change24hPct: 0.42,
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
    referencePrice: 2.964,
    change24hPct: -1.94,
    available: true,
  },
};

export const MARKET_LIST: Market[] = [MARKETS.WTI, MARKETS.BRENT, MARKETS.NATGAS];

export const priceDigits = (id: MarketId) => (id === "NATGAS" ? 3 : 2);