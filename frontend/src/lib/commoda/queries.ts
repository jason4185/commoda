import { queryOptions } from "@tanstack/react-query";
import { commodaService } from "./service";
import type { MarketId } from "./types";

export const qk = {
  markets: ["commoda", "markets"] as const,
  market: (id: MarketId) => ["commoda", "market", id] as const,
  wallet: ["commoda", "wallet"] as const,
  pool: ["commoda", "pool"] as const,
  protections: ["commoda", "protections"] as const,
  protection: (id: string) => ["commoda", "protection", id] as const,
};

export const marketsQuery = queryOptions({
  queryKey: qk.markets,
  queryFn: () => commodaService.getMarkets(),
});

export const walletQuery = queryOptions({
  queryKey: qk.wallet,
  queryFn: () => commodaService.getWallet(),
});

export const poolQuery = queryOptions({
  queryKey: qk.pool,
  queryFn: () => commodaService.getPoolStats(),
});

export const protectionsQuery = queryOptions({
  queryKey: qk.protections,
  queryFn: () => commodaService.getProtections(),
});