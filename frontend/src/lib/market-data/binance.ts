import type { MarketId } from "@/lib/commoda/types";

const SYMBOLS: Record<MarketId, string> = {
  WTI: "CLUSDT",
  BRENT: "BZUSDT",
  NATGAS: "NATGASUSDT",
};

export interface LivePrice {
  market: MarketId;
  symbol: string;
  price: string;
  change24hPercent: number | null;
  updatedAt: number;
}

export async function getBinanceLivePrice(market: MarketId): Promise<LivePrice> {
  const symbol = SYMBOLS[market];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  let response: Response;
  try {
    response = await fetch(
      `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`,
      { signal: controller.signal },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new Error("Market price temporarily unavailable.");
  const data = await response.json() as Record<string, unknown>;
  if (String(data["symbol"] ?? "").toUpperCase() !== symbol || typeof data["lastPrice"] !== "string") {
    throw new Error("Market price temporarily unavailable.");
  }
  const price = Number(data["lastPrice"]);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Market price temporarily unavailable.");
  const change = Number(data["priceChangePercent"]);
  const updatedAt = Number(data["closeTime"]);
  return {
    market,
    symbol,
    price: data["lastPrice"],
    change24hPercent: Number.isFinite(change) ? change : null,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now(),
  };
}
