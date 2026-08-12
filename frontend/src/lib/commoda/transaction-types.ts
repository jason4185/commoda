export type TransactionStage = "preparing" | "awaiting_wallet" | "submitted" | "processing" | "accepted" | "failed";

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
