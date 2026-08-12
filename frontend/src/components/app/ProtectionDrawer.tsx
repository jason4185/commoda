import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { settlementEvidenceQuery } from "@/lib/commoda/queries";
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
  const settledDays = protection.settledDays;
  const settlementAction = getSettlementAction(protection);
  const canClaim = canClaimProtection(protection);
  const busy = pendingAction?.id === protection.id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-navy-deep">{market.name}</SheetTitle>
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
              {settledDays} of {protection.duration} days checked.
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
                    {d.result !== "UNPROCESSED" && d.evidenceVersion ? <EvidenceDetails market={protection.market} day={d} digits={digits} /> : null}
                  </div>
                  <ResultBadge result={d.result} />
                </li>
              ))}
            </ol>
          </div>

          <p className="text-xs leading-relaxed text-slate">Verification details are available on completed daily checks.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EvidenceDetails({ market, day, digits }: { market: Protection["market"]; day: Protection["days"][number]; digits: number }) {
  const [open, setOpen] = useState(false);
  const query = useQuery(settlementEvidenceQuery(market, day.date, day.evidenceVersion ?? 0));
  const evidence = query.data;
  return <details className="mt-2 text-xs" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-slate">Verification details</summary>
    {open ? <dl className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-2 text-xs">
      <Item label="Settlement date" value={shortDate(day.date)} />
      <Item label="Result" value={getDayResultLabel(day.result)} />
      <Item label="Source 1 price" value={query.isPending ? "Loading…" : evidence?.binanceClose == null ? "—" : usd(evidence.binanceClose, digits)} />
      <Item label="Source 2 price" value={query.isPending ? "Loading…" : evidence?.gateClose == null ? "—" : usd(evidence.gateClose, digits)} />
    </dl> : null}
  </details>;
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
