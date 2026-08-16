export type MarketId = "WTI" | "BRENT" | "NATGAS";

export type DropPct = 1 | 2 | 3;
export type DurationDays = 7 | 14 | 30;

export type ProtectionState = "ACTIVE" | "CLAIMABLE" | "EXPIRED" | "CLAIMED" | "CANCELLED";

export type CancellationStatus = "UNAUTHORIZED" | "NOT_ACTIVE" | "CONCLUSIVE" | "GRACE_PERIOD" | "READY";

export type DayResult = "UNPROCESSED" | "BREACHED" | "NOT_BREACHED" | "INCONCLUSIVE";

export interface Market {
  id: MarketId;
  name: string;
  shortName: string;
  unit: string;
  description: string;
  binanceSymbol: string;
  gateSymbol: string;
  referencePrice: number | null;
  change24hPct: number | null;
  available: boolean;
}

export interface Terms {
  duration: DurationDays;
  drop: DropPct;
  premium: number;
  payout: number;
}

export interface SettlementDay {
  day: number;
  date: string;
  result: DayResult;
  binanceClose: number | null;
  gateClose: number | null;
  evidenceVersion?: number;
  note?: string;
}

export interface Protection {
  id: string;
  market: MarketId;
  drop: DropPct;
  duration: DurationDays;
  referencePrice: number | null;
  triggerPrice: number;
  premium: number;
  payout: number;
  startDate: string;
  endDate: string;
  state: ProtectionState;
  settledDays: number;
  days: SettlementDay[];
  nextDate?: string;
  breachDate?: string;
  lastResult?: DayResult;
  canSettle?: boolean;
  retryRequired?: boolean;
  canClaim?: boolean;
  canCancel?: boolean;
  cancellationStatus?: CancellationStatus;
  cancellationEligibleDate?: string;
}

export interface PoolStats {
  poolBalance: number;
  reservedLiability: number;
  activeProtections: number;
  cancelledProtections: number;
  premiumsCollected: number;
  premiumsRefunded: number;
  netRetainedPremiums: number;
  payoutsPaid: number;
  protectionsIssued: number;
  utilisationPct: number;
}

export interface Wallet {
  address: string;
  balance: number;
  connected: boolean;
}

export interface PurchaseRequest {
  market: MarketId;
  drop: DropPct;
  duration: DurationDays;
}
