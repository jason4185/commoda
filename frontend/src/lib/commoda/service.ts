import { formatUnits } from "viem";
import { addDays } from "./format";
import { readContract, writeContract, getActiveAccount } from "./contract";
import { MARKETS } from "./markets";
import type { DayResult, DurationDays, DropPct, Market, MarketId, PoolStats, Protection, PurchaseRequest } from "./types";

const raw = (v: unknown): any => typeof v === "string" ? JSON.parse(v) : v;
const n = (v: unknown) => Number(typeof v === "bigint" ? v : String(v ?? 0));
const big = (v: unknown) => BigInt(String(v ?? 0));
const genValue = (v: unknown) => Number(formatUnits(big(v), 18));
const priceValue = (v: unknown) => Number(formatUnits(big(v), 8));
const dayDate = (s: string) => `${s}T00:00:00.000Z`;

export type SettlementAction = "SETTLE" | "RETRY" | "NONE";
export function getProtectionStatusLabel(state: Protection["state"]) { return { ACTIVE: "Active", CLAIMABLE: "Ready to claim", EXPIRED: "Ended", CLAIMED: "Paid" }[state]; }
export function getDayResultLabel(result: DayResult) { return { UNPROCESSED: "Waiting", BREACHED: "Protected price reached", NOT_BREACHED: "No protected drop", INCONCLUSIVE: "Checking again" }[result]; }
export function getSettlementAction(p: Protection): SettlementAction { if (p.state !== "ACTIVE" || p.canSettle === false) return "NONE"; return p.retryRequired ? "RETRY" : "SETTLE"; }
export function canClaimProtection(p: Protection) { return p.canClaim ?? p.state === "CLAIMABLE"; }

function mapMarket(id: MarketId, data: any): Market { return { ...MARKETS[id], name: String(data?.display_name || MARKETS[id].name), available: true, referencePrice: null, change24hPct: null }; }
function mapDay(d: any, i: number): Protection["days"][number] { return { day: n(d.day ?? i + 1), date: dayDate(String(d.date)), result: d.status as DayResult, binanceClose: d.binance_close == null ? null : priceValue(d.binance_close), gateClose: d.gate_close == null ? null : priceValue(d.gate_close) }; }
function mapProtection(p: any, history?: any[]): Protection {
  const purchase = String(p.purchase_date);
  const days = history ? history.map(mapDay) : Array.from({ length: n(p.duration) }, (_, i) => ({ day: i + 1, date: dayDate(String(p.next_settlement_date || purchase)), result: "UNPROCESSED" as DayResult, binanceClose: null, gateClose: null }));
  return { id: String(n(p.protection_id)), market: p.market as MarketId, drop: n(p.event_percent) as DropPct, duration: n(p.duration) as DurationDays, referencePrice: priceValue(p.reference_price), triggerPrice: priceValue(p.trigger_price), premium: genValue(p.premium), payout: genValue(p.payout), startDate: dayDate(purchase), endDate: dayDate(addDays(new Date(dayDate(purchase)), n(p.duration)).toISOString().slice(0, 10)), state: p.state, days, ...(p.next_settlement_date ? { nextDate: dayDate(p.next_settlement_date) } : {}), ...(p.breach_date ? { breachDate: dayDate(p.breach_date) } : {}), ...(p.last_result ? { lastResult: p.last_result } : {}), ...(p.can_settle !== undefined ? { canSettle: p.can_settle } : {}), retryRequired: p.last_result === "INCONCLUSIVE" || Boolean(p.retry_required), ...(p.can_claim !== undefined ? { canClaim: p.can_claim } : {}) };
}

export const commodaService = {
  async getMarkets(): Promise<Market[]> { const ids = raw(await readContract("get_supported_markets")) as string[]; return ids.map(id => mapMarket(id as MarketId, null)); },
  async getMarketTerms(market: MarketId) { return (raw(await readContract("get_market_terms", [market])) as any[]).map(t => ({ ...t, premium: genValue(t.premium), payout: genValue(t.payout) })); },
  async getConfig() { return raw(await readContract("get_config")); },
  async getPoolStats(): Promise<PoolStats> { const p = raw(await readContract("get_pool_state")); const poolBalance = genValue(p.pool_balance), reservedLiability = genValue(p.reserved_liability); return { poolBalance, reservedLiability, activeProtections: n(p.active), payoutsPaid: genValue(p.payouts_paid), protectionsIssued: n(p.protections), utilisationPct: poolBalance ? reservedLiability / poolBalance * 100 : 0 }; },
  async getSummary(owner: string) { return raw(await readContract("get_user_summary", [owner])); },
  async getAttention(owner: string, start = 0, limit = 20) { return raw(await readContract("get_user_attention", [owner, start, limit])); },
  async getProtections(owner: string, start = 0, limit = 20): Promise<Protection[]> { return (raw(await readContract("get_owner_protection_cards", [owner, start, limit])) as any[]).map(p => mapProtection(p)); },
  async getProtection(id: string): Promise<Protection> { const p = raw(await readContract("get_protection", [BigInt(id)])); const history = raw(await readContract("get_protection_history", [BigInt(id), 0, n(p.duration)])); const days = await Promise.all((history as any[]).map(async (d, i) => { const day = mapDay(d, i); if (n(d.evidence_version) > 0) { try { const e = raw(await readContract("get_market_settlement_version", [p.market, d.date, n(d.evidence_version)])); day.binanceClose = priceValue(e.binance_close); day.gateClose = priceValue(e.gate_close); } catch { /* evidence may be unavailable while a result is catching up */ } } return day; })); return mapProtection(p, days); },
  async quote(req: PurchaseRequest) { const q = raw(await readContract("quote_protection", [req.market, req.duration, req.drop])); return { ...q, market: MARKETS[req.market], premium: genValue(q.premium), payout: genValue(q.payout), availableLiquidity: genValue(q.available_liquidity), enoughLiquidity: Boolean(q.enough_liquidity) }; },
  async purchase(req: PurchaseRequest): Promise<Protection> { const q = raw(await readContract("quote_protection", [req.market, req.duration, req.drop])); await writeContract("purchase_protection", [req.market, req.duration, req.drop], big(q.premium)); const owner = getActiveAccount(); if (!owner) throw new Error("Wallet disconnected after purchase."); const count = n(await readContract("get_owner_protection_count", [owner])); return this.getProtection(String(count - 1)); },
  async settleNextDay(id: string) { const readiness = raw(await readContract("settlement_readiness", [BigInt(id), ""])); if (!readiness.can_settle) throw new Error("Protection is not ready to settle yet."); await writeContract("settle_protection", [BigInt(id)]); return this.getProtection(id); },
  async claim(id: string) { const readiness = raw(await readContract("claim_readiness", [BigInt(id)])); if (!readiness.can_claim) throw new Error("Payout is not ready to claim."); await writeContract("claim_payout", [BigInt(id)]); return this.getProtection(id); },
};
