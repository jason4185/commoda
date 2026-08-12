import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { TransactionProgressModal } from "@/components/app/TransactionProgressModal";
import type { TransactionProgress, TransactionProgressUpdate } from "./transaction-types";

type TransactionContextValue = {
  progress: TransactionProgress;
  open: boolean;
  begin: (title: string, method: string) => void;
  update: (update: TransactionProgressUpdate) => void;
  fail: (error: unknown) => void;
  setOutcome: (outcome: string) => void;
  close: () => void;
  title: string;
};
const Context = createContext<TransactionContextValue | null>(null);

const friendlyError = (error: unknown) => {
  const text = error instanceof Error ? error.message : String(error);
  if (/reject|denied|user/i.test(text)) return "The transaction was rejected in your wallet.";
  if (/network|chain/i.test(text)) return "Wrong network. Switch to GenLayer Bradbury Testnet.";
  return text.replace(/^Error:\s*/i, "") || "The transaction could not be accepted.";
};

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<TransactionProgress>({ stage: "preparing" });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Transaction");
  const begin = useCallback((nextTitle: string, method: string) => { setTitle(nextTitle); setProgress({ stage: "preparing", method }); setOpen(true); }, []);
  const update = useCallback((next: TransactionProgressUpdate) => setProgress((current) => ({ ...current, ...next })), []);
  const fail = useCallback((error: unknown) => setProgress((current) => ({ ...current, stage: "failed", error: friendlyError(error) })), []);
  const setOutcome = useCallback((outcome: string) => setProgress((current) => ({ ...current, outcome })), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ progress, open, begin, update, fail, setOutcome, close, title }), [progress, open, begin, update, fail, setOutcome, close, title]);
  return <Context.Provider value={value}>{children}<TransactionProgressModal open={open} onOpenChange={setOpen} progress={progress} title={title} /></Context.Provider>;
}

export function useTransactionManager() {
  const value = useContext(Context);
  if (!value) throw new Error("TransactionProvider is missing.");
  return value;
}
