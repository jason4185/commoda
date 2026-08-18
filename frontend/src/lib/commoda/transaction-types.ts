export type TransactionStage = "preparing" | "awaiting_wallet" | "submitted" | "processing" | "accepted" | "awaiting_finality" | "finalized" | "failed";

export const FINALITY_REQUIRED_METHODS = new Set(["claim_payout", "cancel_unresolved_protection"]);
export function requiresFinality(method?: string) { return method ? FINALITY_REQUIRED_METHODS.has(method) : false; }

export type TransactionProgressUpdate = {
  stage: TransactionStage;
  method?: string;
  hash?: string;
  status?: string;
  error?: string;
  outcome?: string;
};

export type TransactionProgress = TransactionProgressUpdate;

export type TransactionProgressCallback = (progress: TransactionProgressUpdate) => void;
