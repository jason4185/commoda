import {
  createConfig,
  http,
  injected,
  WagmiProvider,
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GENLAYER_CHAIN } from "./config";
import { setActiveWallet } from "./contract";

export const wagmiConfig = createConfig({
  chains: [GENLAYER_CHAIN],
  connectors: [injected({ shimDisconnect: true })],
  transports: { [GENLAYER_CHAIN.id]: http(GENLAYER_CHAIN.rpcUrls.default.http[0]) },
  ssr: true,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  return <WagmiProvider config={wagmiConfig}><RainbowKitProvider><WalletSync />{children}</RainbowKitProvider></WagmiProvider>;
}

function WalletSync() {
  const account = useAccount();
  const { connectors } = useConnect();
  const connector = connectors[0];
  const queryClient = useQueryClient();
  const previousAddress = useRef<string | undefined>(undefined);
  useEffect(() => {
    setActiveWallet(account.address && connector ? { account: account.address, connector } : null);
    if (previousAddress.current && previousAddress.current.toLowerCase() !== account.address?.toLowerCase()) {
      queryClient.removeQueries({ queryKey: ["commoda", "userSummary", previousAddress.current] });
      queryClient.removeQueries({ queryKey: ["commoda", "attention", previousAddress.current] });
      queryClient.removeQueries({ queryKey: ["commoda", "ownerCards", previousAddress.current] });
    }
    previousAddress.current = account.address;
  }, [account.address, connector]);
  useEffect(() => () => setActiveWallet(null), []);
  return null;
}

export function useWallet() {
  const account = useAccount();
  const { connectors, connect, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const balance = useBalance({ address: account.address, chainId: GENLAYER_CHAIN.id });
  const connector = connectors[0];
  return useMemo(() => ({
    address: account.address ?? null,
    balance: balance.data?.value ?? null,
    balanceFormatted: balance.data?.formatted ?? null,
    status: (connecting ? "connecting" : account.isConnected ? "connected" : "disconnected") as "disconnected" | "connecting" | "connected",
    chainId: account.chainId,
    wrongNetwork: account.isConnected && account.chainId !== GENLAYER_CHAIN.id,
    connect: async () => { if (connector) await connect({ connector }); },
    disconnect,
    switchToBradbury: () => switchChain({ chainId: GENLAYER_CHAIN.id }),
  }), [account.address, account.chainId, account.isConnected, balance.data, connector, connect, connecting, disconnect, switchChain]);
}
