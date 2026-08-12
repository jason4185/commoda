import { queryOptions } from "@tanstack/react-query";
import { commodaService } from "./service";
import type { MarketId } from "./types";

export const qk = {
  markets: ["commoda", "markets"] as const,
  config: ["commoda", "config"] as const,
  pool: ["commoda", "pool"] as const,
  summary: (owner: string) => ["commoda", "userSummary", owner] as const,
  attention: (owner: string) => ["commoda", "attention", owner] as const,
  protections: (owner: string) => ["commoda", "ownerCards", owner] as const,
  protection: (id: string) => ["commoda", "protection", id] as const,
};
export const marketsQuery = queryOptions({ queryKey: qk.markets, queryFn: () => commodaService.getMarkets(), staleTime: 300_000 });
export const configQuery = queryOptions({ queryKey: qk.config, queryFn: () => commodaService.getConfig(), staleTime: 300_000 });
export const poolQuery = queryOptions({ queryKey: qk.pool, queryFn: () => commodaService.getPoolStats(), staleTime: 30_000 });
export const summaryQuery = (owner: string) => queryOptions({ queryKey: qk.summary(owner), queryFn: () => commodaService.getSummary(owner), enabled: Boolean(owner), staleTime: 30_000 });
export const attentionQuery = (owner: string) => queryOptions({ queryKey: qk.attention(owner), queryFn: () => commodaService.getAttention(owner, 0, 20), enabled: Boolean(owner), staleTime: 30_000 });
export const protectionsQuery = (owner: string) => queryOptions({ queryKey: qk.protections(owner), queryFn: () => commodaService.getProtections(owner, 0, 20), enabled: Boolean(owner), staleTime: 30_000 });
export const protectionQuery = (id: string) => queryOptions({ queryKey: qk.protection(id), queryFn: () => commodaService.getProtection(id), enabled: Boolean(id), staleTime: 15_000 });
export const marketTermsQuery = (market: MarketId) => queryOptions({ queryKey: ["commoda", "marketTerms", market] as const, queryFn: () => commodaService.getMarketTerms(market), staleTime: 300_000 });
export const quoteQuery = (market: MarketId, duration: number, drop: number) => queryOptions({ queryKey: ["commoda", "quote", market, duration, drop] as const, queryFn: () => commodaService.quote({ market, duration: duration as any, drop: drop as any }), staleTime: 15_000 });
