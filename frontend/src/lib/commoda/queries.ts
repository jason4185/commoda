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
  protection: (id: string, owner = "") => ["commoda", "protection", id, owner] as const,
  history: (id: string, start: number, limit: number) => ["commoda", "history", id, start, limit] as const,
  settlementEvidence: (market: MarketId, date: string, version: number) => ["commoda", "settlement", market, date, version] as const,
  market: (market: MarketId) => ["commoda", "market", market] as const,
};
export const marketsQuery = queryOptions({ queryKey: qk.markets, queryFn: () => commodaService.getMarkets(), staleTime: 300_000 });
export const configQuery = queryOptions({ queryKey: qk.config, queryFn: () => commodaService.getConfig(), staleTime: 300_000 });
export const poolQuery = queryOptions({ queryKey: qk.pool, queryFn: () => commodaService.getPoolStats(), staleTime: 30_000 });
export const summaryQuery = (owner: string) => queryOptions({ queryKey: qk.summary(owner), queryFn: () => commodaService.getSummary(owner), enabled: Boolean(owner), staleTime: 30_000 });
export const attentionQuery = (owner: string) => queryOptions({ queryKey: qk.attention(owner), queryFn: () => commodaService.getAttention(owner, 0, 20), enabled: Boolean(owner), staleTime: 30_000 });
export const protectionsQuery = (owner: string) => queryOptions({ queryKey: qk.protections(owner), queryFn: () => commodaService.getProtections(owner, 0, 20), enabled: Boolean(owner), staleTime: 30_000 });
export const protectionQuery = (id: string, owner = "") => queryOptions({ queryKey: qk.protection(id, owner), queryFn: () => commodaService.getProtection(id, owner || undefined), enabled: Boolean(id && owner), staleTime: 15_000 });
export const settlementEvidenceQuery = (market: MarketId, date: string, version: number) => queryOptions({ queryKey: qk.settlementEvidence(market, date, version), queryFn: () => commodaService.getSettlementEvidence(market, date, version), enabled: Boolean(market && date && version > 0), staleTime: 300_000 });
export const marketTermsQuery = (market: MarketId) => queryOptions({ queryKey: ["commoda", "marketTerms", market] as const, queryFn: () => commodaService.getMarketTerms(market), staleTime: 300_000 });
export const marketDetailQuery = (market: MarketId | null) => queryOptions({ queryKey: market ? qk.market(market) : ["commoda", "market", "invalid"] as const, queryFn: () => { if (!market) throw new Error("Unsupported market"); return commodaService.getMarketDetail(market); }, enabled: Boolean(market), staleTime: 300_000 });
const VALID_DURATIONS = [7, 14, 30];
const VALID_DROPS = [1, 2, 3];
export const quoteQuery = (market: MarketId | null, duration: number, drop: number) => queryOptions({
  queryKey: ["commoda", "quote", market, duration, drop] as const,
  queryFn: () => {
    if (!market || !VALID_DURATIONS.includes(duration) || !VALID_DROPS.includes(drop)) {
      throw new Error("Invalid protection selection");
    }
    return commodaService.quote({ market, duration: duration as any, drop: drop as any });
  },
  enabled: Boolean(market && VALID_DURATIONS.includes(duration) && VALID_DROPS.includes(drop)),
  staleTime: 15_000,
});
