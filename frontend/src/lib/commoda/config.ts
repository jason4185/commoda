import { testnetBradbury } from "genlayer-js/chains";
import { getAddress, type Address } from "viem";

export const COMMODA_CONTRACT_ADDRESS = "0x35D3a7EbF3c76d4bAF531d87191dAe9859854b1e" as Address;
export const GENLAYER_RPC_ENDPOINT = "https://rpc-bradbury.genlayer.com";
export const GENLAYER_CHAIN = testnetBradbury;
export const CONTRACT_EXPLORER = "https://explorer-bradbury.genlayer.com";
export const GITHUB_URL = "https://github.com/jason4185/commoda";
export const PAGE_SIZE = 20;

export function requireContractAddress(): Address {
  const configured = String(import.meta.env["VITE_COMMODA_CONTRACT_ADDRESS"] ?? COMMODA_CONTRACT_ADDRESS).trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(configured)) throw new Error("Invalid Commoda contract address.");
  const address = getAddress(configured);
  if (address.toLowerCase() !== COMMODA_CONTRACT_ADDRESS.toLowerCase()) {
    throw new Error("VITE_COMMODA_CONTRACT_ADDRESS is not the Commoda Bradbury deployment.");
  }
  return address;
}
