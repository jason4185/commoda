import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Wallet } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Logo } from "@/components/commoda/Logo";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/commoda/wallet";
import { shortAddress } from "@/lib/commoda/format";

const NAV = [{ to: "/protect", label: "Protection" }, { to: "/how-it-works", label: "How It Works" }, { to: "/markets", label: "Markets" }, { to: "/transparency", label: "Transparency" }] as const;
function WalletBlock() {
  const wallet = useWallet();
  return <ConnectButton.Custom>
    {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
      const connected = mounted && account && chain;
      if (!connected) return <Button variant="outline" onClick={openConnectModal}><Wallet /> Connect Wallet</Button>;
      if (chain.unsupported) return <Button variant="outline" className="text-danger" onClick={openChainModal}>Wrong Network</Button>;
      return <Button variant="outline" className="gap-2 px-3" onClick={openAccountModal}>
        <Wallet className="h-4 w-4 text-navy" />
        <span className="hidden text-xs font-semibold sm:inline">{wallet.balanceFormatted ? `${Number(wallet.balanceFormatted).toFixed(2)} GEN` : "—"}</span>
        <span className="font-mono text-xs">{account.displayName}</span>
        <span aria-hidden>⌄</span>
      </Button>;
    }}
  </ConnectButton.Custom>;
}
export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: s => s.location.pathname });
  return <header className="sticky top-0 z-50 border-b border-border/80 bg-porcelain/95 backdrop-blur-md"><div className="mx-auto grid w-full max-w-[1320px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 sm:px-8 lg:grid-cols-[auto_1fr_auto]"><Link to="/"><Logo /></Link><nav className="hidden justify-center gap-7 lg:flex">{NAV.map(item => <Link key={item.to} to={item.to} className={pathname === item.to ? "font-semibold text-navy-deep" : "text-slate"}>{item.label}</Link>)}</nav><div className="hidden items-center gap-2.5 lg:flex"><WalletBlock /><Button asChild variant="outline"><Link to="/dashboard">View Dashboard</Link></Button><Button asChild variant="accent"><Link to="/protect">Get Protection</Link></Button></div><button onClick={() => setOpen(v => !v)} className="justify-self-end border border-border bg-card p-2 lg:hidden" aria-label="Menu">{open ? <X /> : <Menu />}</button></div>{open ? <div className="border-t border-border bg-porcelain p-5 lg:hidden"><div className="flex flex-col gap-2">{NAV.map(item => <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="p-2 text-ink">{item.label}</Link>)}<WalletBlock /><Button asChild variant="accent"><Link to="/protect">Get Protection</Link></Button></div></div> : null}</header>;
}
