import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { Section, SectionHeading } from "@/components/commoda/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { marketsQuery } from "@/lib/commoda/queries";
import { priceDigits } from "@/lib/commoda/markets";
import { DROPS, DURATIONS, getTerms } from "@/lib/commoda/terms";
import { gen, pct, usd } from "@/lib/commoda/format";

export const Route = createFileRoute("/markets")({
  head: () => ({
    meta: [
      { title: "Markets — WTI, Brent & Natural Gas | Commoda" },
      {
        name: "description",
        content:
          "Supported Commoda markets: WTI Crude, Brent Crude and Natural Gas, with available drop levels, durations and settlement source symbols.",
      },
      { property: "og:title", content: "Markets — WTI, Brent & Natural Gas | Commoda" },
      {
        property: "og:description",
        content: "Drop levels, durations and dual-source settlement symbols for every Commoda market.",
      },
    ],
  }),
  component: MarketsPage,
});

function MarketsPage() {
  const { data: markets, isPending, isError, refetch } = useQuery(marketsQuery);

  return (
    <>
      <Section tone="navy" className="grid-motif">
        <SectionHeading
          tone="light"
          eyebrow="Markets"
          title={
            <>
              Three energy benchmarks.{" "}
              <span className="font-display text-amber italic">One protection standard.</span>
            </>
          }
          lead="Every market uses the same mechanics: a reference price locked at purchase, a predefined drop trigger, and daily settlement confirmed by two independent data sources."
        />
      </Section>

      <Section>
        {isError ? (
          <div className="rounded-xl border border-danger/25 bg-danger/5 p-8 text-center">
            <p className="font-medium text-danger">Market data could not be loaded.</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : isPending || !markets ? (
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {markets.map((m) => {
              const digits = priceDigits(m.id);
              return (
                <article
                  key={m.id}
                  className="overflow-hidden border border-border bg-card shadow-elegant"
                >
                  <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1.25fr_1fr]">
                    <div className="min-w-0">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                        <div className="min-w-0">
                          <p className="eyebrow text-slate">{m.id}</p>
                          <h2 className="mt-2 text-2xl font-semibold text-navy-deep sm:text-3xl">
                            {m.name}
                          </h2>
                        </div>
                        <span className="shrink-0 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                          Available
                        </span>
                      </div>
                      <p className="mt-4 max-w-xl leading-relaxed text-slate">{m.description}</p>

                      <dl className="mt-7 grid gap-5 sm:grid-cols-3">
                        <div>
                          <dt className="text-xs font-medium text-slate">Indicative price</dt>
                          <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">
                            {usd(m.referencePrice, digits)}
                          </dd>
                          <dd className="text-xs text-slate">{m.unit}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-slate">24h change</dt>
                          <dd
                            className={`mt-1 text-xl font-semibold tabular-nums ${
                              m.change24hPct < 0 ? "text-danger" : "text-success"
                            }`}
                          >
                            {pct(m.change24hPct)}
                          </dd>
                          <dd className="text-xs text-slate">demo data</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-slate">Source symbols</dt>
                          <dd className="mt-1 font-mono text-sm text-ink">{m.binanceSymbol}</dd>
                          <dd className="font-mono text-sm text-ink">{m.gateSymbol}</dd>
                        </div>
                      </dl>

                      <Button asChild variant="accent" className="mt-8">
                        <Link to="/protect" search={{ market: m.id }}>
                          Protect {m.shortName}
                          <ArrowUpRight />
                        </Link>
                      </Button>
                    </div>

                    <div className="rounded-lg border border-border bg-sand/60 p-5">
                      <h3 className="text-sm font-semibold text-navy-deep">
                        Available terms & fixed payouts
                      </h3>
                      <p className="mt-1 text-xs text-slate">Premium and payout in GEN.</p>
                      <table className="mt-4 w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate">
                            <th className="pb-2 font-medium">Duration</th>
                            <th className="pb-2 font-medium">Premium</th>
                            {DROPS.map((d) => (
                              <th key={d} className="pb-2 text-right font-medium">
                                {d}%
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {DURATIONS.map((dur) => (
                            <tr key={dur} className="border-t border-border/70">
                              <td className="py-2.5 font-medium text-ink">{dur} days</td>
                              <td className="py-2.5 tabular-nums text-slate">
                                {gen(getTerms(dur, 1).premium)}
                              </td>
                              {DROPS.map((d) => (
                                <td
                                  key={d}
                                  className="py-2.5 text-right font-semibold tabular-nums text-ink"
                                >
                                  {getTerms(dur, d).payout}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-xs text-slate">
          Prices shown are mock/demo values served through a single mock service. No live
          third-party price feed is connected yet.
        </p>
      </Section>
    </>
  );
}
