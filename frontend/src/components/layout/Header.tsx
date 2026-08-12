import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, Menu, X, Wallet } from "lucide-react";
import { Logo } from "@/components/commoda/Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { walletQuery } from "@/lib/commoda/queries";
import { gen, shortAddress } from "@/lib/commoda/format";

const NAV = [
  { to: "/protect", label: "Protection" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/markets", label: "Markets" },
  { to: "/transparency", label: "Transparency" },
] as const;

function WalletBlock() {
  const { data, isPending } = useQuery(walletQuery);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-navy/30 hover:bg-sand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Wallet"
        >
          <Wallet className="h-4 w-4 shrink-0 text-navy" aria-hidden />
          <span className="tabular-nums">{isPending || !data ? "—" : gen(data.balance)}</span>
          <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
          <span className="hidden text-slate sm:block">
            {data ? shortAddress(data.address) : "Not connected"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-slate">
          Connected wallet (demo)
        </DropdownMenuLabel>
        <DropdownMenuItem className="font-mono text-xs">
          {data ? data.address : "—"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-between">
          <span>Balance</span>
          <span className="font-semibold tabular-nums">{data ? gen(data.balance) : "—"}</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="justify-between">
          <span>Network</span>
          <span className="text-slate">GenLayer Testnet</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-porcelain/95 backdrop-blur-md">
      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 sm:px-8 lg:grid-cols-[auto_1fr_auto]">
        <Link to="/" className="min-w-0 rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <Logo />
        </Link>

        <nav className="hidden justify-center gap-7 lg:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={`text-[0.8rem] font-semibold transition-colors hover:text-navy-deep ${
                pathname === item.to ? "text-navy-deep" : "text-slate"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 lg:flex">
          <WalletBlock />
          <Button asChild variant="outline">
            <Link to="/dashboard">View Dashboard</Link>
          </Button>
          <Button asChild variant="accent">
            <Link to="/protect">Get Protection</Link>
          </Button>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="justify-self-end rounded-md border border-border bg-card p-2 text-ink lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-border bg-porcelain lg:hidden">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-1 px-5 py-4 sm:px-8">
            {NAV.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2.5 text-sm font-medium text-ink hover:bg-sand"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2">
              <WalletBlock />
              <Button asChild variant="outline" onClick={() => setOpen(false)}>
                <Link to="/dashboard">View Dashboard</Link>
              </Button>
              <Button asChild variant="accent" onClick={() => setOpen(false)}>
                <Link to="/protect">Get Protection</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
