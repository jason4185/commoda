import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Info, Lock } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PurchaseModal } from "@/components/app/PurchaseModal";
import { marketsQuery, qk, quoteQuery, marketTermsQuery } from "@/lib/commoda/queries";
import { canPurchaseFromQuote, commodaService } from "@/lib/commoda/service";
import { priceDigits } from "@/lib/commoda/markets";
import { DROPS, DURATIONS } from "@/lib/commoda/terms";
import { addDays, dateLabel, gen } from "@/lib/commoda/format";
import type { DropPct, DurationDays, MarketId, Protection } from "@/lib/commoda/types";
import { useWallet } from "@/lib/commoda/wallet";
import { LivePrice } from "@/components/commoda/LivePrice";
import { useTransactionManager } from "@/lib/commoda/transaction-context";

const searchSchema = z.object({
  market: z.enum(["WTI", "BRENT", "NATGAS"]).optional(),
});

export const Route = createFileRoute("/protect")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Get Drop Protection | Commoda" },
      {
        name: "description",
        content:
          "Choose a commodity, drop level and coverage period, then review your fixed premium and payout.",
      },
      { property: "og:title", content: "Get Drop Protection | Commoda" },
      {
        property: "og:description",
        content: "Choose a market, drop level and coverage period for fixed-payout commodity protection.",
      },
    ],
  }),
  component: ProtectPage,
});

function ProtectPage() {
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const wallet = useWallet();
  const transaction = useTransactionManager();
  const { data: markets, isPending, isError, refetch } = useQuery(marketsQuery);

  const [marketId, setMarketId] = useState<MarketId>(search.market ?? "WTI");
  const [drop, setDrop] = useState<DropPct>(1);
  const [duration, setDuration] = useState<DurationDays>(7);
  const [modalOpen, setModalOpen] = useState(false);
  const [result, setResult] = useState<Protection | null>(null);

  const market = markets?.find((m) => m.id === marketId);
  const { data: quote, isPending: quotePending, isError: quoteError, refetch: refetchQuote } = useQuery(quoteQuery(marketId, duration, drop));
  const { data: marketTerms } = useQuery(marketTermsQuery(marketId));
  const terms = quote ? { duration, drop, premium: quote.premium, payout: quote.payout } : null;
  const digits = priceDigits(marketId);

  const { start, end } = useMemo(() => {
    const s = new Date();
    return { start: s.toISOString(), end: addDays(s, duration).toISOString() };
  }, [duration]);

  const purchase = useMutation({
    mutationFn: () => commodaService.purchase({ market: marketId, drop, duration }, transaction.update),
    onMutate: () => { setModalOpen(false); transaction.begin("Purchasing protection", "purchase_protection"); },
    onSuccess: (p) => {
      setResult(p);
      queryClient.invalidateQueries({ queryKey: qk.pool });
      if (wallet.address) {
        queryClient.invalidateQueries({ queryKey: qk.protections(wallet.address) });
        queryClient.invalidateQueries({ queryKey: qk.summary(wallet.address) });
        queryClient.invalidateQueries({ queryKey: qk.attention(wallet.address) });
        queryClient.invalidateQueries({ queryKey: qk.protection(p.id, wallet.address) });
      }
      transaction.setOutcome("Your protection purchase was accepted.");
    },
    onError: (error) => { if (transaction.progress.stage !== "accepted") transaction.fail(error); },
  });

  const preview = null;

  return (
    <div className="bg-porcelain">
      <div className="mx-auto w-full max-w-[1320px] px-5 py-14 sm:px-8 md:py-20">
        <header className="max-w-2xl">
          <p className="eyebrow text-slate">Get protection</p>
          <h1 className="mt-3 text-3xl leading-tight font-semibold text-navy-deep sm:text-4xl">
            Build your drop protection
          </h1>
          <p className="mt-4 leading-relaxed text-slate">
            Choose a market, a drop level and a coverage period. Your premium and payout are fixed
            before you buy.
          </p>
        </header>

        {isError ? (
          <div className="mt-10 rounded-xl border border-danger/25 bg-danger/5 p-8 text-center">
            <p className="font-medium text-danger">Markets could not be loaded.</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
            {/* Left: steps */}
            <div className="space-y-8">
              <StepBlock index={1} title="Choose commodity">
                <div className="grid gap-3 sm:grid-cols-3">
                  {isPending || !markets
                    ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)
                    : markets.map((m) => {
                        const active = m.id === marketId;
                        return (
                          <button
                            key={m.id}
                            onClick={() => setMarketId(m.id)}
                            aria-pressed={active}
                            className={`rounded-lg border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                              active
                                ? "border-navy-deep bg-navy-deep text-porcelain shadow-lift"
                                : "border-border bg-card hover:border-navy/35 hover:bg-sand/60"
                            }`}
                          >
                            <p
                              className={`eyebrow ${active ? "text-amber" : "text-slate"}`}
                            >
                              {m.id}
                            </p>
                            <p className="mt-2 font-semibold">{m.name}</p>
                            <p
                              className={`mt-1 text-sm tabular-nums ${active ? "text-porcelain/70" : "text-slate"}`}
                            >
                              <LivePrice market={m.id} />
                            </p>
                          </button>
                        );
                      })}
                </div>
              </StepBlock>

              <StepBlock index={2} title="Choose drop protection">
                <div className="grid gap-3 sm:grid-cols-3">
                  {DROPS.map((d) => {
                    const active = d === drop;
                    return (
                      <button
                        key={d}
                        onClick={() => setDrop(d)}
                        aria-pressed={active}
                        className={`rounded-lg border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                          active
                            ? "border-amber bg-amber/12 shadow-elegant"
                            : "border-border bg-card hover:border-navy/35 hover:bg-sand/60"
                        }`}
                      >
                        <p className="text-2xl font-semibold text-navy-deep">{d}%</p>
                        <p className="mt-1 text-sm text-slate">
                          Pays {gen((marketTerms as any[] | undefined)?.find((t) => t.duration === duration && t.event_percent === d)?.payout)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </StepBlock>

              <StepBlock index={3} title="Choose duration">
                <div className="grid gap-3 sm:grid-cols-3">
                  {DURATIONS.map((d) => {
                    const active = d === duration;
                    return (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        aria-pressed={active}
                        className={`rounded-lg border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                          active
                            ? "border-amber bg-amber/12 shadow-elegant"
                            : "border-border bg-card hover:border-navy/35 hover:bg-sand/60"
                        }`}
                      >
                        <p className="text-2xl font-semibold text-navy-deep">{d} days</p>
                        <p className="mt-1 text-sm text-slate">
                          Premium {gen((marketTerms as any[] | undefined)?.find((t) => t.duration === d && t.event_percent === drop)?.premium)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </StepBlock>

              <div className="flex gap-3 rounded-xl border border-navy/15 bg-navy/5 p-5">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-navy" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-navy-deep">Your starting price</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate">
                    Your starting price is recorded when the purchase completes. Your protected price
                    is calculated from the drop level you select.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: review panel */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lift">
                <div className="border-b border-border bg-navy-deep px-6 py-5">
                  <p className="eyebrow text-amber">Review protection</p>
                    <p className="mt-1.5 text-lg font-semibold text-porcelain">
                    {market ? market.name : "Select a market"}
                  </p>
                </div>

                <dl className="divide-y divide-border px-6 text-sm">
                  <Line label="Protected drop" value={`${drop}%`} />
                  <Line label="Protected price" value="Calculated at purchase" hint="Based on the starting price" />
                  <Line label="Duration" value={`${duration} days`} />
                  <Line
                    label="Coverage"
                    value={`${dateLabel(start)} → ${dateLabel(end)}`}
                  />
                  <Line label="Starting price" value="Recorded at purchase" />
                  <Line label="Daily checks" value="After each completed day" />
                  <Line label="Premium" value={gen(terms?.premium)} strong />
                  <Line label="Payout" value={gen(terms?.payout)} strong />
                </dl>

                <div className="px-6 pt-5 pb-6">
                  <Button
                    variant="accent"
                    size="lg"
                    className="w-full"
                    disabled={!market || quoteError || (Boolean(wallet.address) && !wallet.wrongNetwork && (quotePending || !terms || !canPurchaseFromQuote(quote)))}
                    onClick={() => {
                      if (!wallet.address) { void wallet.connect(); return; }
                      if (wallet.wrongNetwork) { wallet.switchToBradbury(); return; }
                      setResult(null);
                      purchase.reset();
                      setModalOpen(true);
                    }}
                  >
                    {!wallet.address ? "Connect Wallet" : wallet.wrongNetwork ? "Switch to Bradbury" : quotePending ? "Loading terms…" : "Review Protection"}
                  </Button>
                  {quoteError ? (
                    <div className="mt-4 rounded-md border border-danger/25 bg-danger/5 px-3 py-3 text-sm text-danger">
                      <p>Unable to load protection terms.</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetchQuote()}>
                        Try again
                      </Button>
                    </div>
                  ) : quotePending ? (
                    <p className="mt-3 text-xs text-slate">Loading protection terms…</p>
                  ) : quote && !canPurchaseFromQuote(quote) ? (
                    <div className="mt-4 rounded-md border border-amber/30 bg-amber/10 px-3 py-3 text-sm text-slate">
                      <p className="font-medium text-navy-deep">Protection temporarily unavailable.</p>
                      <p className="mt-1">The pool does not currently have enough unreserved liquidity for this protection.</p>
                    </div>
                  ) : null}
                  <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    Payout is fixed and does not scale with the size of the drop.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {market && terms ? (
        <PurchaseModal
          open={modalOpen}
          onOpenChange={(v) => {
            setModalOpen(v);
            if (!v) setResult(null);
          }}
          market={market}
          terms={terms!}
          previewTrigger={preview}
          startDate={start}
          endDate={end}
          isSubmitting={purchase.isPending}
          result={result}
          error={purchase.isError ? "The transaction could not be completed. Please try again." : null}
          onConfirm={() => purchase.mutate()}
          onDone={() => {
            setModalOpen(false);
            setResult(null);
          }}
        />
      ) : null}
    </div>
  );
}

function StepBlock({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy-deep text-xs font-semibold text-porcelain">
          {index}
        </span>
        <h2 className="text-base font-semibold text-navy-deep">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Line({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-slate">
        {label}
        {hint ? <span className="mt-0.5 block text-xs text-slate/70">{hint}</span> : null}
      </dt>
      <dd
        className={`text-right tabular-nums ${strong ? "text-base font-semibold text-navy-deep" : "text-ink"}`}
      >
        {value}
      </dd>
    </div>
  );
}
