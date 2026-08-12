/**
 * Contract service layer.
 *
 * Every read/write the UI performs against protocol state goes through this
 * module. It is currently backed by an in-memory mock store; swapping it for
 * real GenLayer contract reads/writes means replacing the bodies below only.
 */
import { MARKET_LIST, MARKETS } from "./markets";
import { getTerms, triggerPrice } from "./terms";
import { addDays } from "./format";
import { seedPool, seedProtections, seedWallet } from "./mock-data";
import type {
  DurationDays,
  DropPct,
  Market,
  MarketId,
  PoolStats,
  Protection,
  PurchaseRequest,
  Wallet,
} from "./types";

const LATENCY = 420;
const delay = <T,>(value: T, ms = LATENCY) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

let protections: Protection[] = seedProtections.map((p) => ({ ...p }));
let pool: PoolStats = { ...seedPool };
let wallet: Wallet = { ...seedWallet };

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export const commodaService = {
  async getMarkets(): Promise<Market[]> {
    return delay(MARKET_LIST);
  },

  async getMarket(id: MarketId): Promise<Market> {
    return delay(MARKETS[id]);
  },

  async getWallet(): Promise<Wallet> {
    return delay({ ...wallet }, 200);
  },

  async getPoolStats(): Promise<PoolStats> {
    return delay({ ...pool });
  },

  async getProtections(): Promise<Protection[]> {
    return delay(protections.map((p) => ({ ...p })));
  },

  async getProtection(id: string): Promise<Protection | null> {
    const found = protections.find((p) => p.id === id);
    return delay(found ? { ...found } : null);
  },

  /** Quotes premium/payout and a *preview* trigger from the latest indicative price. */
  async quote(req: PurchaseRequest) {
    const market = MARKETS[req.market];
    const terms = getTerms(req.duration, req.drop);
    const start = new Date();
    return delay(
      {
        market,
        ...terms,
        previewReferencePrice: market.referencePrice,
        previewTriggerPrice: triggerPrice(market.referencePrice, req.drop),
        startDate: iso(start),
        endDate: iso(addDays(start, req.duration)),
      },
      160,
    );
  },

  /** Mock purchase: locks the reference price and debits the premium. */
  async purchase(req: PurchaseRequest): Promise<Protection> {
    await delay(null, 1400);
    const market = MARKETS[req.market];
    const terms = getTerms(req.duration, req.drop);
    const start = new Date();
    const reference = Number(market.referencePrice.toFixed(3));
    const protection: Protection = {
      id: `CMD-${1100 + protections.length}`,
      market: market.id,
      drop: req.drop as DropPct,
      duration: req.duration as DurationDays,
      referencePrice: reference,
      triggerPrice: Number(triggerPrice(reference, req.drop).toFixed(3)),
      premium: terms.premium,
      payout: terms.payout,
      startDate: iso(start),
      endDate: iso(addDays(start, req.duration)),
      state: "ACTIVE",
      days: Array.from({ length: req.duration }, (_, i) => ({
        day: i + 1,
        date: iso(addDays(start, i + 1)),
        result: "UNPROCESSED" as const,
        binanceClose: null,
        gateClose: null,
      })),
    };
    protections = [protection, ...protections];
    wallet = { ...wallet, balance: Number((wallet.balance - terms.premium).toFixed(2)) };
    pool = {
      ...pool,
      poolBalance: pool.poolBalance + terms.premium,
      reservedLiability: pool.reservedLiability + terms.payout,
      activeProtections: pool.activeProtections + 1,
      protectionsIssued: pool.protectionsIssued + 1,
    };
    emit();
    return { ...protection };
  },

  /** Mock settlement of the next unprocessed covered day. */
  async settleNextDay(id: string): Promise<Protection> {
    await delay(null, 1100);
    const current = protections.find((x) => x.id === id);
    if (!current) throw new Error(`Protection ${id} not found`);
    const p: Protection = { ...current, days: current.days.map((d) => ({ ...d })) };
    const next = p.days.find((d) => d.result === "UNPROCESSED");
    if (!next) throw new Error("No unprocessed covered days remain");
    const drift = 1 - ((next.day * 13) % 9) / 300;
    const close = Number((p.referencePrice * drift).toFixed(3));
    const breached = close <= p.triggerPrice;
    next.binanceClose = close;
    next.gateClose = Number((close * 1.0006).toFixed(3));
    next.result = breached ? "BREACHED" : "NOT_BREACHED";
    if (breached) p.state = "CLAIMABLE";
    else if (p.days.every((d) => d.result !== "UNPROCESSED")) p.state = "EXPIRED";
    protections = protections.map((x) => (x.id === id ? p : x));
    emit();
    return { ...p };
  },

  async claim(id: string): Promise<Protection> {
    await delay(null, 1300);
    const current = protections.find((x) => x.id === id);
    if (!current) throw new Error(`Protection ${id} not found`);
    const p: Protection = { ...current, state: "CLAIMED" };
    protections = protections.map((x) => (x.id === id ? p : x));
    wallet = { ...wallet, balance: Number((wallet.balance + p.payout).toFixed(2)) };
    pool = {
      ...pool,
      poolBalance: pool.poolBalance - p.payout,
      reservedLiability: Math.max(0, pool.reservedLiability - p.payout),
      payoutsPaid: pool.payoutsPaid + p.payout,
      activeProtections: Math.max(0, pool.activeProtections - 1),
    };
    emit();
    return { ...p };
  },
};

export type CommodaService = typeof commodaService;