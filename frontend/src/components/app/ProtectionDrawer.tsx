import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ResultBadge, StateBadge } from "@/components/commoda/StateBadge";
import { MARKETS, priceDigits } from "@/lib/commoda/markets";
import { dateLabel, gen, shortDate, usd } from "@/lib/commoda/format";
import { canClaimProtection, getDayResultLabel, getSettlementAction } from "@/lib/commoda/service";
import type { Protection } from "@/lib/commoda/types";

interface Props {
  protection: Protection | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSettle: (id: string) => void;
  onClaim: (id: string) => void;
  pendingAction: { id: string; kind: "settle" | "claim" } | null;
}

export function ProtectionDrawer({
  protection,
  open,
  onOpenChange,
  onSettle,
  onClaim,
  pendingAction,
}: Props) {
  if (!protection) return null;
  const market = MARKETS[protection.market];
  const digits = priceDigits(protection.market);
  const settledDays = protection.days.filter((d) => d.result !== "UNPROCESSED").length;
  const settlementAction = getSettlementAction(protection);
  const canClaim = canClaimProtection(protection);
  const busy = pendingAction?.id === protection.id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-navy-deep">{protection.id}</SheetTitle>
            <StateBadge state={protection.state} />
          </div>
          <SheetDescription>
            {market.name} · {protection.drop}% drop · {protection.duration} days
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8">
          <dl className="grid grid-cols-2 gap-4 border border-border bg-sand/50 p-4 text-sm">
            <Item label="Starting price" value={usd(protection.referencePrice, digits)} />
            <Item label="Protected price" value={usd(protection.triggerPrice, digits)} />
            <Item label="Premium" value={gen(protection.premium)} />
            <Item label="Payout" value={gen(protection.payout)} />
            <Item label="Purchase date" value={dateLabel(protection.startDate)} />
            <Item label="Coverage" value={`${protection.duration} days`} />
          </dl>

          <div className="flex flex-wrap gap-3">
            {settlementAction !== "NONE" ? <Button variant="outline" disabled={busy} onClick={() => onSettle(protection.id)}>{busy && pendingAction?.kind === "settle" ? <><Loader2 className="animate-spin" /> Checking…</> : settlementAction === "RETRY" ? "Retry Settlement" : "Settle Now"}</Button> : null}
            {canClaim ? <Button variant="accent" disabled={busy} onClick={() => onClaim(protection.id)}>
              {busy && pendingAction?.kind === "claim" ? (
                <>
                  <Loader2 className="animate-spin" /> Claiming…
                </>
              ) : (
                "Claim Payout"
              )}
            </Button> : null}
            {protection.state === "CLAIMED" ? <span className="self-center text-sm font-semibold text-success">Paid</span> : null}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-navy-deep">Daily settlement timeline</h3>
            <p className="mt-1 text-xs text-slate">
              {settledDays} of {protection.duration} covered days settled.
            </p>
            <ol className="mt-4 space-y-2">
              {protection.days.map((d) => (
                <li
                  key={d.day}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      Day {d.day} · {shortDate(d.date)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate">
                      {getDayResultLabel(d.result)}
                    </p>
                    {d.note ? <p className="mt-1 text-xs text-warning">{d.note}</p> : null}
                  </div>
                  <ResultBadge result={d.result} />
                </li>
              ))}
            </ol>
          </div>

          <details className="border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-semibold text-navy-deep">Verification details</summary>
            <p className="mt-3 text-xs leading-relaxed text-slate">
              Each completed day is checked against your protected price using verified market prices.
            </p>
            {protection.days.filter((d) => d.binanceClose !== null || d.gateClose !== null).map((d) => (
              <dl key={d.day} className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
                <Item label="Settlement date" value={shortDate(d.date)} />
                <Item label="Verification result" value={getDayResultLabel(d.result)} />
                <Item label="Price check 1" value={d.binanceClose === null ? "—" : usd(d.binanceClose, digits)} />
                <Item label="Price check 2" value={d.gateClose === null ? "—" : usd(d.gateClose, digits)} />
              </dl>
            ))}
          </details>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
