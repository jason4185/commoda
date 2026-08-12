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
  const canSettle = protection.state === "ACTIVE" && settledDays < protection.duration;
  const canClaim = protection.state === "CLAIMABLE";
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
            <Item label="Locked reference" value={usd(protection.referencePrice, digits)} />
            <Item label="Trigger price" value={usd(protection.triggerPrice, digits)} />
            <Item label="Premium paid" value={gen(protection.premium)} />
            <Item label="Fixed payout" value={gen(protection.payout)} />
            <Item label="Coverage start" value={dateLabel(protection.startDate)} />
            <Item label="Coverage end" value={dateLabel(protection.endDate)} />
          </dl>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={!canSettle || busy}
              onClick={() => onSettle(protection.id)}
            >
              {busy && pendingAction?.kind === "settle" ? (
                <>
                  <Loader2 className="animate-spin" /> Settling…
                </>
              ) : (
                "Settle next day"
              )}
            </Button>
            <Button variant="accent" disabled={!canClaim || busy} onClick={() => onClaim(protection.id)}>
              {busy && pendingAction?.kind === "claim" ? (
                <>
                  <Loader2 className="animate-spin" /> Claiming…
                </>
              ) : (
                `Claim ${gen(protection.payout)}`
              )}
            </Button>
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
                      {d.binanceClose !== null && d.gateClose !== null
                        ? `Binance ${usd(d.binanceClose, digits)} · Gate ${usd(d.gateClose, digits)}`
                        : "Awaiting settlement"}
                    </p>
                    {d.note ? <p className="mt-1 text-xs text-warning">{d.note}</p> : null}
                  </div>
                  <ResultBadge result={d.result} />
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-navy-deep">Evidence summary</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate">
              Settlement compares the Binance ({market.binanceSymbol}) and Gate ({market.gateSymbol})
              historical daily closes against the trigger price stored at purchase. A day is only
              recorded as breached when both sources report a close at or below{" "}
              {usd(protection.triggerPrice, digits)}.
            </p>
          </div>
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
