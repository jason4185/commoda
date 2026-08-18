import { createClient } from "genlayer-js";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import type { Address } from "viem";
import type { Connector } from "wagmi";
import { COMMODA_CONTRACT_ADDRESS, CONTRACT_EXPLORER, GENLAYER_CHAIN, GENLAYER_RPC_ENDPOINT, requireContractAddress } from "./config";
import { requiresFinality, type TransactionProgressCallback } from "./transaction-types";

type AnyClient = {
  readContract(args: Record<string, unknown>): Promise<unknown>;
  writeContract(args: Record<string, unknown>): Promise<unknown>;
  waitForTransactionReceipt(args: Record<string, unknown>): Promise<any>;
  getTransaction(args: Record<string, unknown>): Promise<any>;
};
const readClient = () => createClient({ chain: GENLAYER_CHAIN as any, endpoint: GENLAYER_RPC_ENDPOINT }) as unknown as AnyClient;
let activeWallet: { connector: Connector; account: Address } | null = null;
const PENDING_FINANCIAL_KEY = "commoda.pendingFinancialTx.v1";

export type PendingFinancialTx = {
  txHash: string;
  action: "CLAIM" | "REFUND";
  protectionId: string;
  account: string;
  chainId: number;
  status?: "PENDING" | "FAILED" | "UNAVAILABLE" | "FINALIZED";
};

function pendingStorage(): Storage | null {
  try {
    return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function getAllPendingFinancialTransactions(): PendingFinancialTx[] {
  const storage = pendingStorage();
  if (!storage) return [];
  try {
    const value = JSON.parse(storage.getItem(PENDING_FINANCIAL_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item) => item && typeof item.txHash === "string") : [];
  } catch {
    return [];
  }
}

export function getPendingFinancialTransactions(account: string): PendingFinancialTx[] {
  return getAllPendingFinancialTransactions().filter((item): item is PendingFinancialTx =>
    (item.action === "CLAIM" || item.action === "REFUND") && typeof item.protectionId === "string" &&
    typeof item.account === "string" && item.account.toLowerCase() === account.toLowerCase() &&
    (item.status === undefined || item.status === "PENDING" || item.status === "FAILED" || item.status === "UNAVAILABLE" || item.status === "FINALIZED") &&
    Number(item.chainId) === GENLAYER_CHAIN.id);
}

export function rememberPendingFinancialTransaction(item: PendingFinancialTx) {
  const storage = pendingStorage();
  if (!storage) return;
  const all = getAllPendingFinancialTransactions().filter((current) => current.txHash !== item.txHash);
  all.push(item);
  storage.setItem(PENDING_FINANCIAL_KEY, JSON.stringify(all));
}

export function clearPendingFinancialTransaction(txHash: string) {
  const storage = pendingStorage();
  if (!storage) return;
  const remaining = getAllPendingFinancialTransactions().filter((item) => item.txHash !== txHash);
  if (remaining.length === 0) storage.removeItem(PENDING_FINANCIAL_KEY);
  else storage.setItem(PENDING_FINANCIAL_KEY, JSON.stringify(remaining));
}

export async function getPendingFinancialStatus(txHash: string): Promise<"PENDING" | "FINALIZED" | "FAILED" | "UNAVAILABLE"> {
  try {
    const transaction = await readClient().getTransaction({ hash: txHash });
    const status = String(transaction?.statusName ?? transaction?.status ?? "").toUpperCase();
    if (status === TransactionStatus.FINALIZED) {
      return transaction?.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR ? "FAILED" : "FINALIZED";
    }
    if (status === TransactionStatus.CANCELED || status === "CANCELED") return "FAILED";
    return "PENDING";
  } catch {
    return "UNAVAILABLE";
  }
}

export function setActiveWallet(wallet: { connector: Connector; account: Address } | null) { activeWallet = wallet; }
export function getActiveAccount() { return activeWallet?.account ?? null; }
export async function readContract(functionName: string, args: unknown[] = []) {
  return readClient().readContract({ address: requireContractAddress(), functionName, args, transactionHashVariant: "latest-nonfinal" });
}

/**
 * Reads a sender-sensitive public view with the selected wallet account as
 * GenLayer's message sender. This intentionally does not require the wallet
 * provider: public reads remain wallet-independent, while account context is
 * supplied explicitly for views that inspect gl.message.sender_address.
 */
export async function readContractAsAccount(functionName: string, args: unknown[] = [], account: Address) {
  const client = createClient({ chain: GENLAYER_CHAIN as any, endpoint: GENLAYER_RPC_ENDPOINT, account }) as unknown as AnyClient;
  return client.readContract({ address: requireContractAddress(), functionName, args, transactionHashVariant: "latest-nonfinal" });
}

export async function writeContract(functionName: string, args: unknown[] = [], value = 0n, onProgress?: TransactionProgressCallback) {
  onProgress?.({ stage: "preparing", method: functionName });
  let pendingHash = "";
  let submittedAccount: Address | null = null;
  try {
  if (!activeWallet) throw new Error("Connect an injected wallet before submitting.");
  const provider = await activeWallet.connector.getProvider();
  const request = (provider as { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> }).request;
  if (!request) throw new Error("Your wallet could not be used. Try reconnecting it.");
  const accounts = await request({ method: "eth_accounts" });
  if (!Array.isArray(accounts) || String(accounts[0]).toLowerCase() !== activeWallet.account.toLowerCase()) {
    throw new Error("Connected wallet account changed. Reconnect and try again.");
  }
  const chainId = await request({ method: "eth_chainId" });
  if (String(chainId).toLowerCase() !== `0x${GENLAYER_CHAIN.id.toString(16)}`) {
    throw new Error("Wrong network. Switch to GenLayer Bradbury Testnet.");
  }
  submittedAccount = activeWallet.account;
  onProgress?.({ stage: "awaiting_wallet", method: functionName });
  const client = createClient({ chain: GENLAYER_CHAIN as any, endpoint: GENLAYER_RPC_ENDPOINT, account: activeWallet.account, provider }) as unknown as AnyClient;
  const result = await client.writeContract({ address: requireContractAddress(), functionName, args, value });
  const hashValue = typeof result === "string" ? result : result && typeof result === "object" ? (result as { hash?: unknown; txHash?: unknown; transactionHash?: unknown }).hash ?? (result as { txHash?: unknown }).txHash ?? (result as { transactionHash?: unknown }).transactionHash : undefined;
  const hash = String(hashValue ?? result);
  pendingHash = hash;
  if (requiresFinality(functionName)) {
    rememberPendingFinancialTransaction({
      txHash: hash,
      action: functionName === "claim_payout" ? "CLAIM" : "REFUND",
      protectionId: String(args[0] ?? ""),
      account: activeWallet.account,
      chainId: GENLAYER_CHAIN.id,
    });
  }
  onProgress?.({ stage: "submitted", method: functionName, hash });
  onProgress?.({ stage: "processing", method: functionName, hash });
  const receipt = await Promise.race([
    client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, interval: 2_000, retries: 60 }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 150_000)),
  ]);
  if (receipt === null) throw new Error(`Transaction ${hash} is still processing. Refresh shortly.`);
  if (receipt?.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) throw new Error("This action could not be completed.");
  if (receipt?.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) throw new Error("Transaction is still processing. Refresh shortly.");
  onProgress?.({ stage: "accepted", method: functionName, hash });
  if (!requiresFinality(functionName)) return { hash, receipt, finalized: true };

  onProgress?.({ stage: "awaiting_finality", method: functionName, hash,
    status: TransactionStatus.FINALIZED,
    outcome: "Accepted — awaiting finality. The transfer is not complete yet." });
  const finalizedReceipt = await Promise.race([
    client.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED, interval: 2_000, retries: 60 }).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 150_000)),
  ]);
  if (finalizedReceipt === null) {
    try {
      const current = await client.getTransaction({ hash });
      const status = String(current?.statusName ?? current?.status ?? "");
      if (status === TransactionStatus.CANCELED || status === "CANCELED") throw new Error("Transaction was canceled before finalization.");
    } catch (error) {
      if (error instanceof Error && error.message.includes("canceled")) throw error;
    }
    return { hash, receipt, finalized: false };
  }
  if (finalizedReceipt?.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) throw new Error("This action could not be completed.");
  if (finalizedReceipt?.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) throw new Error("Transaction did not finalize successfully.");
  clearPendingFinancialTransaction(hash);
  onProgress?.({ stage: "finalized", method: functionName, hash, status: TransactionStatus.FINALIZED });
  return { hash, receipt: finalizedReceipt, finalized: true };
  } catch (error) {
    if (pendingHash && requiresFinality(functionName)) {
      rememberPendingFinancialTransaction({
        txHash: pendingHash,
        action: functionName === "claim_payout" ? "CLAIM" : "REFUND",
        protectionId: String(args[0] ?? ""),
        account: submittedAccount ?? "",
        chainId: GENLAYER_CHAIN.id,
        status: "FAILED",
      });
    }
    onProgress?.({ stage: "failed", method: functionName, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export function transactionExplorer(hash: string) { return `${CONTRACT_EXPLORER}/tx/${hash}`; }
export const contractAddress = COMMODA_CONTRACT_ADDRESS;
