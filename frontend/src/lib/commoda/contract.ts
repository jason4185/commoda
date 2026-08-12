import { createClient } from "genlayer-js";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import type { Address } from "viem";
import type { Connector } from "wagmi";
import { COMMODA_CONTRACT_ADDRESS, CONTRACT_EXPLORER, GENLAYER_CHAIN, GENLAYER_RPC_ENDPOINT, requireContractAddress } from "./config";

type AnyClient = {
  readContract(args: Record<string, unknown>): Promise<unknown>;
  writeContract(args: Record<string, unknown>): Promise<unknown>;
  waitForTransactionReceipt(args: Record<string, unknown>): Promise<any>;
};
const readClient = () => createClient({ chain: GENLAYER_CHAIN as any, endpoint: GENLAYER_RPC_ENDPOINT }) as unknown as AnyClient;
let activeWallet: { connector: Connector; account: Address } | null = null;

export function setActiveWallet(wallet: { connector: Connector; account: Address } | null) { activeWallet = wallet; }
export function getActiveAccount() { return activeWallet?.account ?? null; }
export async function readContract(functionName: string, args: unknown[] = []) {
  return readClient().readContract({ address: requireContractAddress(), functionName, args, transactionHashVariant: "latest-nonfinal" });
}

export async function writeContract(functionName: string, args: unknown[] = [], value = 0n) {
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
  const client = createClient({ chain: GENLAYER_CHAIN as any, endpoint: GENLAYER_RPC_ENDPOINT, account: activeWallet.account, provider }) as unknown as AnyClient;
  const result = await client.writeContract({ address: requireContractAddress(), functionName, args, value });
  const hash = String(result);
  const receipt = await Promise.race([
    client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, interval: 2_000, retries: 60 }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 150_000)),
  ]);
  if (receipt === null) throw new Error(`Transaction ${hash} is still processing. Refresh shortly.`);
  if (receipt?.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) throw new Error("This action could not be completed.");
  if (receipt?.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) throw new Error("Transaction is still processing. Refresh shortly.");
  return { hash, receipt };
}

export function transactionExplorer(hash: string) { return `${CONTRACT_EXPLORER}/tx/${hash}`; }
export const contractAddress = COMMODA_CONTRACT_ADDRESS;
