import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { gen, dateLabel, usd } from "@/lib/commoda/format";
import { priceDigits } from "@/lib/commoda/markets";
import type { Market, Protection, Terms } from "@/lib/commoda/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  market: Market;
  terms: Terms;
  previewTrigger: number | null;
  startDate: string;
  endDate: string;
  isSubmitting: boolean;
  result: Protection | null;
  error: string | null;
  onConfirm: () => void;
  onDone: () => void;
}

export function PurchaseModal({
  open,
  onOpenChange,
  market,
  terms,
  previewTrigger,
  startDate,
  endDate,
  isSubmitting,
  result,
  error,
  onConfirm,
  onDone,
}: Props) {
  const [ack] = useState(true);
  const digits = priceDigits(market.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {result ? (
          <>
            <DialogHeader>
              <span className="grid h-11 w-11 place-items-center rounded-full bg-success/12 text-success">
                <CheckCircle2 className="h-6 w-6" aria-hidden />
              </span>
              <DialogTitle className="mt-3">Protection confirmed</DialogTitle>
              <DialogDescription>
                Starting price {usd(result.referencePrice, digits)} · protected price{" "}
                {usd(result.triggerPrice, digits)}.
              </DialogDescription>
            </DialogHeader>
            <dl className="mt-2 space-y-2.5 rounded-lg border border-border bg-sand/60 p-4 text-sm">
              <Row label="Protection ID" value={result.id} />
              <Row label="Market" value={market.name} />
              <Row label="Premium" value={gen(result.premium)} />
              <Row label="Payout" value={gen(result.payout)} />
              <Row label="Coverage" value={`${dateLabel(result.startDate)} → ${dateLabel(result.endDate)}`} />
            </dl>
            <DialogFooter>
              <Button variant="outline" onClick={onDone}>
                Buy another
              </Button>
              <Button asChild variant="accent">
                <Link to="/dashboard">View in dashboard</Link>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Review transaction</DialogTitle>
              <DialogDescription>
                Confirm your protection. Your starting price is recorded when the purchase completes.
              </DialogDescription>
            </DialogHeader>

            <dl className="space-y-2.5 rounded-lg border border-border bg-sand/60 p-4 text-sm">
              <Row label="Market" value={market.name} />
              <Row label="Drop protection" value={`${terms.drop}% drop`} />
              <Row label="Duration" value={`${terms.duration} days`} />
              <Row label="Coverage" value={`${dateLabel(startDate)} → ${dateLabel(endDate)}`} />
              <Row label="Protected price" value={usd(previewTrigger, digits)} />
              <div className="border-t border-border pt-2.5" />
              <Row label="Premium" value={gen(terms.premium)} strong />
              <Row label="Payout if protected price is reached" value={gen(terms.payout)} strong />
            </dl>

            <p className="text-xs leading-relaxed text-slate">
              Each completed day is checked using verified market prices.
            </p>

            {error ? (
              <p className="rounded-md border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="accent" onClick={onConfirm} disabled={isSubmitting || !ack}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" /> Confirming in wallet…
                  </>
                ) : (
                  `Confirm & pay ${gen(terms.premium)}`
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate">{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? "font-semibold text-navy-deep" : "text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}
