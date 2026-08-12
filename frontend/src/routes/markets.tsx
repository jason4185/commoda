import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { Section, SectionHeading } from "@/components/commoda/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { marketsQuery, marketTermsQuery } from "@/lib/commoda/queries";
import { priceDigits } from "@/lib/commoda/markets";
import { DROPS, DURATIONS } from "@/lib/commoda/terms";
import { gen } from "@/lib/commoda/format";
import { LivePrice } from "@/components/commoda/LivePrice";

export const Route = createFileRoute("/markets")({
  head: () => ({
    meta: [
      { title: "Markets — WTI, Brent & Natural Gas | Commoda" },
      {
        name: "description",
        content:
          "Choose simple price-drop protection for WTI, Brent Crude or Natural Gas.",
      },
      { property: "og:title", content: "Markets — WTI, Brent & Natural Gas | Commoda" },
      {
        property: "og:description",
        content: "Compare Commoda protection options for WTI, Brent Crude and Natural Gas.",
      },
    ],
  }),
  component: MarketsPage,
});

function MarketsPage() {
  const { data: markets, isPending, isError, refetch } = useQuery(marketsQuery);
  const termQueries = useQueries({ queries: (markets ?? []).map((m) => marketTermsQuery(m.id)) });

  return (
    <>
      <Section tone="navy">
        <SectionHeading
          tone="light"
          eyebrow="Markets"
          title={<>Energy markets available for <span className="font-display text-amber italic">protection.</span></>}
          lead="Choose what you want to protect, how much of a drop you want covered, and how long you want protection to last."
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
              const terms = termQueries[markets.findIndex((x) => x.id === m.id)]?.data as Array<{ duration: number; event_percent: number; premium: number; payout: number }> | undefined;
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
                      <p className="mt-4 max-w-xl leading-relaxed text-slate">Protect against a predefined drop in {m.name.toLowerCase()} prices.</p>

                      <dl className="mt-7 grid gap-5 sm:grid-cols-3">
                        <div>
                          <dt className="text-xs font-medium text-slate">Live market price</dt>
                          <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">
                            <LivePrice market={m.id} />
                          </dd>
                          <dd className="text-xs text-slate">{m.unit}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-slate">Available protection</dt>
                          <dd className="mt-1 font-medium text-ink">1% · 2% · 3% drops</dd>
                          <dd className="text-xs text-slate">7 · 14 · 30 days</dd>
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
                        Protection options
                      </h3>
                      <p className="mt-1 text-xs text-slate">Choose how long you want protection and the drop level you want covered.</p>
                      <table className="mt-4 w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate">
                            <th className="pb-2 font-medium">Duration</th>
                            <th className="pb-2 font-medium">Premium</th>
                            {DROPS.map((d) => (
                              <th key={d} className="pb-2 text-right font-medium">
                                {d}% Drop
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {DURATIONS.map((dur) => (
                            <tr key={dur} className="border-t border-border/70">
                              <td className="py-2.5 font-medium text-ink">{dur} days</td>
                              <td className="py-2.5 tabular-nums text-slate">
                                {terms ? gen(terms.find((t) => t.duration === dur && t.event_percent === 1)?.premium) : "—"}
                              </td>
                              {DROPS.map((d) => (
                                <td
                                  key={d}
                                  className="py-2.5 text-right font-semibold tabular-nums text-ink"
                                >
                                  {terms ? gen(terms.find((t) => t.duration === dur && t.event_percent === d)?.payout) : "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="border-t border-border px-6 py-3 text-xs text-slate sm:px-9">Payouts are fixed when you purchase protection.</p>
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-xs text-slate">
          Live prices are informational. Your starting price is recorded by the contract when protection is purchased.
        </p>
      </Section>
    </>
  );
}
