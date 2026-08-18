import { formatUnits } from "viem";
import { addDaysToIsoDate, isoDateOnly } from "./format";
import { readContract, readContractAsAccount, writeContract, getActiveAccount } from "./contract";
import { MARKETS } from "./markets";
import type { CancellationStatus, DayResult, DurationDays, DropPct, FinancialFinality, Market, MarketId, PoolStats, Protection, PurchaseRequest } from "./types";
import type { TransactionProgressCallback } from "./transaction-types";

const raw = (v: unknown): any => typeof v === "string" ? JSON.parse(v) : v;
const n = (v: unknown) => Number(typeof v === "bigint" ? v : String(v ?? 0));
const big = (v: unknown) => BigInt(String(v ?? 0));
const genValue = (v: unknown) => Number(formatUnits(big(v), 18));
const priceValue = (v: unknown) => Number(formatUnits(big(v), 8));

export type SettlementAction = "SETTLE" | "RETRY" | "NONE";
export type CancellationAction = "CANCEL" | "NONE";
export type FinancialActionResult = { protection: Protection; finalized: boolean; hash: string };
export function getProtectionStatusLabel(state: Protection["state"], finality: FinancialFinality = "UNKNOWN") { return { ACTIVE: "Active", CLAIMABLE: "Ready to claim", EXPIRED: "Ended", CLAIMED: finality === "FINALIZED" ? "Paid" : "Claim accepted", CANCELLED: finality === "FINALIZED" ? "Premium refunded" : "Cancelled" }[state]; }
export function getFinancialTransferLabel(action: "CLAIM" | "REFUND", finality: FinancialFinality): string {
  if (finality === "FINALIZED") return action === "CLAIM" ? "Paid" : "Premium refunded";
  if (finality === "PENDING") return action === "CLAIM" ? "Payout awaiting finality" : "Refund awaiting finality";
  if (finality === "FAILED" || finality === "UNAVAILABLE") return "Transfer status unavailable";
  return action === "CLAIM" ? "Claim accepted" : "Cancellation accepted";
}
export function getDayResultLabel(result: DayResult) { return { UNPROCESSED: "Waiting to be checked", BREACHED: "Protected price reached", NOT_BREACHED: "No protected drop", INCONCLUSIVE: "Sources disagree", UNAVAILABLE: "Source data unavailable" }[result]; }
export function getSettlementAction(p: Protection): SettlementAction { if (p.state !== "ACTIVE" || p.canSettle !== true) return "NONE"; return p.retryRequired ? "RETRY" : "SETTLE"; }
export function getCancellationAction(p: Protection): CancellationAction { return p.canCancel === true ? "CANCEL" : "NONE"; }
export function canCancelProtection(p: Protection) { return p.canCancel === true; }
export function canClaimProtection(p: Protection) { return p.canClaim ?? p.state === "CLAIMABLE"; }
export function canPurchaseFromQuote(q: { enoughLiquidity?: boolean } | null | undefined) { return q?.enoughLiquidity === true; }

function mapMarket(id: MarketId, data: any): Market { return { ...MARKETS[id], name: String(data?.display_name || MARKETS[id].name), available: true, referencePrice: null, change24hPct: null }; }
function mapDay(d: any, i: number, purchase?: string): Protection["days"][number] { return { day: n(d.day ?? i + 1), date: isoDateOnly(d.date) ?? addDaysToIsoDate(purchase, i + 1) ?? "", result: d.status as DayResult, binanceClose: d.binance_close == null ? null : priceValue(d.binance_close), gateClose: d.gate_close == null ? null : priceValue(d.gate_close), ...(d.evidence_version == null ? {} : { evidenceVersion: n(d.evidence_version) }), ...(d.first_unresolved_at ? { firstUnresolvedAt: String(d.first_unresolved_at) } : {}), ...(d.unresolved_source ? { unresolvedSource: String(d.unresolved_source) } : {}), ...(d.unresolved_class ? { unresolvedClass: String(d.unresolved_class) } : {}) }; }
function mapProtection(p: any, history?: any[], readiness?: { settlement?: any; claim?: any; cancellation?: any }): Protection {
  const purchase = isoDateOnly(p.purchase_date) ?? "";
  const days = history ? history.map((d, i) => mapDay(d, i, purchase)) : Array.from({ length: n(p.duration) }, (_, i) => ({ day: i + 1, date: addDaysToIsoDate(purchase, i + 1) ?? "", result: "UNPROCESSED" as DayResult, binanceClose: null, gateClose: null }));
  const next = isoDateOnly(p.next_settlement_date ?? p.next_date);
  const breach = isoDateOnly(p.breach_date);
  const cancellation = readiness?.cancellation;
  const cancellationStatus = cancellation?.status ?? p.cancellation_status;
  const cancellationEligibleDate = cancellation?.eligible_date ? isoDateOnly(cancellation.eligible_date) : undefined;
  const cancellationEligibleAt = cancellation?.eligible_at ?? p.cancellation_eligible_at;
  return { id: String(n(p.protection_id)), market: p.market as MarketId, drop: n(p.event_percent) as DropPct, duration: n(p.duration) as DurationDays, referencePrice: priceValue(p.reference_price), triggerPrice: priceValue(p.trigger_price), premium: genValue(p.premium), payout: genValue(p.payout), startDate: purchase, endDate: addDaysToIsoDate(purchase, n(p.duration)) ?? "", state: p.state, settledDays: n(p.settled_days), days, ...(next ? { nextDate: next } : {}), ...(breach ? { breachDate: breach } : {}), ...(p.last_result ? { lastResult: p.last_result } : {}), ...(readiness?.settlement?.can_settle !== undefined ? { canSettle: Boolean(readiness.settlement.can_settle) } : p.can_settle !== undefined ? { canSettle: Boolean(p.can_settle) } : {}), retryRequired: readiness?.settlement?.retry_required === true || p.last_result === "INCONCLUSIVE" || p.last_result === "UNAVAILABLE" || Boolean(p.retry_required), ...(readiness?.claim?.can_claim !== undefined ? { canClaim: Boolean(readiness.claim.can_claim) } : p.can_claim !== undefined ? { canClaim: Boolean(p.can_claim) } : {}), ...(cancellationStatus ? { cancellationStatus: cancellationStatus as CancellationStatus } : {}), ...(cancellationEligibleDate ? { cancellationEligibleDate } : {}), ...(cancellationEligibleAt ? { cancellationEligibleAt } : {}), ...(cancellation?.can_cancel !== undefined ? { canCancel: Boolean(cancellation.can_cancel) } : p.can_cancel !== undefined ? { canCancel: Boolean(p.can_cancel) } : {}) };
}

/** Resolve the actual globally allocated ID returned by the owner index. */
export function resolveLatestOwnerProtectionId(ownerProtectionIds: unknown[]): string {
  if (!Array.isArray(ownerProtectionIds) || ownerProtectionIds.length === 0) {
    throw new Error("The purchased protection could not be found in the owner index.");
  }
  const id = ownerProtectionIds[ownerProtectionIds.length - 1];
  if (id === null || id === undefined || (typeof id !== "string" && typeof id !== "number" && typeof id !== "bigint")) {
    throw new Error("The purchased protection ID could not be read from the owner index.");
  }
  return String(id);
}

export const commodaService = {
  async getMarkets(): Promise<Market[]> { const ids = raw(await readContract("get_supported_markets")) as string[]; return ids.map(id => mapMarket(id as MarketId, null)); },
  async getMarketTerms(market: MarketId) { return (raw(await readContract("get_market_terms", [market])) as any[]).map(t => ({ ...t, duration: n(t.duration), event_percent: n(t.event_percent), premium: genValue(t.premium), payout: genValue(t.payout) })); },
  async getMarketDetail(market: MarketId) { const [metadata, terms] = await Promise.all([readContract("get_market", [market]), this.getMarketTerms(market)]); return { market: mapMarket(market, raw(metadata)), terms }; },
  async getConfig() { return raw(await readContract("get_config")); },
  async getPoolStats(): Promise<PoolStats> { const p = raw(await readContract("get_pool_state")); const poolBalance = genValue(p.pool_balance), reservedLiability = genValue(p.reserved_liability); return { poolBalance, reservedLiability, activeProtections: n(p.active), cancelledProtections: n(p.cancelled), premiumsCollected: genValue(p.premiums), premiumsRefunded: genValue(p.premiums_refunded), netRetainedPremiums: genValue(p.net_retained_premiums), payoutsPaid: genValue(p.payouts_paid), protectionsIssued: n(p.protections), utilisationPct: poolBalance ? reservedLiability / poolBalance * 100 : 0 }; },
  async getSummary(owner: string) { return raw(await readContract("get_user_summary", [owner])); },
  async getAttention(owner: string, start = 0, limit = 20) { return raw(await readContract("get_user_attention", [owner, start, limit])); },
  async getProtections(owner: string, start = 0, limit = 20): Promise<Protection[]> { return (raw(await readContractAsAccount("get_owner_protection_cards", [owner, start, limit], owner as `0x${string}`)) as any[]).map(p => mapProtection(p)); },
  async getProtection(id: string, account?: string): Promise<Protection> {
    const protectionId = BigInt(id);
    const p = raw(await readContract("get_protection", [protectionId]));
    const reads = [readContract("get_protection_history", [protectionId, 0, n(p.duration)])];
    if (account) {
      reads.push(readContractAsAccount("settlement_readiness", [protectionId, ""], account as `0x${string}`));
      reads.push(readContractAsAccount("claim_readiness", [protectionId], account as `0x${string}`));
      reads.push(readContractAsAccount("cancellation_readiness", [protectionId], account as `0x${string}`));
    }
    const [history, settlement, claim, cancellation] = await Promise.all(reads);
    return mapProtection(p, raw(history), account ? { settlement: raw(settlement), claim: raw(claim), cancellation: raw(cancellation) } : undefined);
  },
  async getSettlementEvidence(market: MarketId, date: string, version: number) { const e = raw(await readContract("get_market_settlement_version", [market, date, version])); return { binanceClose: e.binance_close == null ? null : priceValue(e.binance_close), gateClose: e.gate_close == null ? null : priceValue(e.gate_close), version }; },
  async quote(req: PurchaseRequest) { const q = raw(await readContract("quote_protection", [req.market, req.duration, req.drop])); return { ...q, market: MARKETS[req.market], premium: genValue(q.premium), payout: genValue(q.payout), availableLiquidity: genValue(q.available_liquidity), enoughLiquidity: Boolean(q.enough_liquidity) }; },
  async purchase(req: PurchaseRequest, onProgress?: TransactionProgressCallback): Promise<Protection> { const q = raw(await readContract("quote_protection", [req.market, req.duration, req.drop])); await writeContract("purchase_protection", [req.market, req.duration, req.drop], big(q.premium), onProgress); const owner = getActiveAccount(); if (!owner) throw new Error("Wallet disconnected after purchase."); const count = n(await readContract("get_owner_protection_count", [owner])); if (count <= 0) throw new Error("The purchased protection could not be found."); const ownerIds = raw(await readContract("get_my_protections", [owner, count - 1, 1])); const protectionId = resolveLatestOwnerProtectionId(ownerIds); return this.getProtection(protectionId, owner); },
  async settleNextDay(id: string, onProgress?: TransactionProgressCallback) { const owner = getActiveAccount(); if (!owner) throw new Error("Connect your wallet before settling."); const readiness = raw(await readContractAsAccount("settlement_readiness", [BigInt(id), ""], owner)); if (!readiness.can_settle) throw new Error("Protection is not ready to settle yet."); await writeContract("settle_protection", [BigInt(id)], 0n, onProgress); return this.getProtection(id, owner); },
  async cancelUnresolved(id: string, onProgress?: TransactionProgressCallback): Promise<FinancialActionResult> { const owner = getActiveAccount(); if (!owner) throw new Error("Connect your wallet before requesting terminal resolution."); const readiness = raw(await readContractAsAccount("cancellation_readiness", [BigInt(id)], owner)); if (!readiness.can_cancel) throw new Error("Protection is not ready for terminal resolution yet."); const tx = await writeContract("cancel_unresolved_protection", [BigInt(id)], 0n, onProgress); return { protection: await this.getProtection(id, owner), finalized: Boolean((tx as any).finalized), hash: String((tx as any).hash ?? "") }; },
  async claim(id: string, onProgress?: TransactionProgressCallback): Promise<FinancialActionResult> { const owner = getActiveAccount(); if (!owner) throw new Error("Connect your wallet before claiming."); const readiness = raw(await readContractAsAccount("claim_readiness", [BigInt(id)], owner)); if (!readiness.can_claim) throw new Error("Payout is not ready to claim."); const tx = await writeContract("claim_payout", [BigInt(id)], 0n, onProgress); return { protection: await this.getProtection(id, owner), finalized: Boolean((tx as any).finalized), hash: String((tx as any).hash ?? "") }; },
};
