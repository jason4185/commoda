import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Circle } from "lucide-react";
import marketDataImage from "@/assets/market-data.jpg";
import { Section, SectionHeading } from "@/components/commoda/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { marketsQuery } from "@/lib/commoda/queries";
import { DROPS, DURATIONS } from "@/lib/commoda/terms";
import { LivePrice } from "@/components/commoda/LivePrice";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Commoda — Protection Built for Commodity Price Drops" },
      {
        name: "description",
        content:
          "Fixed-payout price protection for WTI, Brent and Natural Gas with simple terms and verified daily checks.",
      },
      { property: "og:title", content: "Commoda — Protection Built for Commodity Price Drops" },
      {
        property: "og:description",
        content:
          "Predefined price drops. Fixed payouts. Verified daily checks.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: markets, isPending } = useQuery(marketsQuery);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-deep">
        <div className="contour-motif absolute inset-0" aria-hidden />
        <div className="relative mx-auto w-full max-w-[1320px] px-5 py-24 sm:px-8 md:py-36">
          <p className="eyebrow text-amber">Commodity drop protection</p>
          <h1 className="mt-6 max-w-4xl text-4xl leading-[1.05] font-semibold text-porcelain sm:text-6xl md:text-[4.4rem]">
            Protection built for{" "}
            <span className="font-display text-amber italic">commodity price drops.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-porcelain/70 sm:text-xl">
            Protect WTI, Brent and Natural Gas against predefined price drops. Choose your drop level
            and coverage period, pay a fixed premium, and receive a fixed payout if the protected
            price is reached.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild variant="accent" size="xl">
              <Link to="/protect">
                Get Protection <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="onDark" size="xl">
              <Link to="/how-it-works">How It Works</Link>
            </Button>
          </div>

          {/* Market strip */}
          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {isPending || !markets
              ? [0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-36 rounded-xl bg-porcelain/10" />
                ))
              : markets.map((m) => (
                  <Link
                    key={m.id}
                    to="/markets"
                    className="group border-t border-porcelain/20 py-5 transition-colors hover:border-amber/60"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <p className="eyebrow text-amber">{m.id}</p>
                        <p className="mt-1.5 truncate font-medium text-porcelain">{m.name}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-[0.65rem] font-semibold text-[oklch(0.78_0.11_164)]">
                        Available
                      </span>
                    </div>
                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-2xl font-semibold tabular-nums text-porcelain">
                          <LivePrice market={m.id} dark />
                        </p>
                        <p className="mt-0.5 text-xs text-porcelain/55">Live price</p>
                      </div>
                      <p className="text-xs text-porcelain/55">Drops 1% · 2% · 3%</p>
                    </div>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr]">
          <SectionHeading
            eyebrow="How Commoda works"
            title={
              <>
                Protection with predefined outcomes.
              </>
            }
            lead="Every Commoda protection is defined by a price condition written down before coverage starts. If the condition is met on a covered day, the payout is owed. There is no loss adjustment, no negotiation and no discretionary review."
          />
          <ol className="grid gap-8 sm:grid-cols-3">
            {[
              { t: "Choose your commodity", d: "WTI, Brent or Natural Gas." },
              { t: "Set your protection", d: "Choose a 1%, 2% or 3% drop and a 7, 14 or 30 day period." },
              { t: "Daily checks", d: "Verified market prices show whether your protected price was reached." },
            ].map((i, n) => (
              <li key={i.t} className="editorial-rule pt-4">
                <span className="font-display text-4xl text-amber">0{n + 1}</span>
                <h3 className="mt-4 font-semibold text-navy-deep">{i.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate">{i.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section tone="sand">
        <div className="grid items-start gap-12 lg:grid-cols-[.8fr_1.2fr]">
          <SectionHeading
            eyebrow="A protection, at a glance"
            title={<>Every covered day leaves an <span className="font-display italic">auditable trail.</span></>}
            lead="Example values below are illustrative. Your starting price, protected price and daily checks are recorded as the protection progresses."
          />
          <div className="border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
              <div><p className="eyebrow text-slate">WTI protection</p><p className="mt-2 text-xl font-semibold text-navy-deep">1% Drop Protection</p></div>
              <span className="border border-success/25 bg-success/10 px-3 py-1 text-xs font-semibold text-success">Example</span>
            </div>
            <dl className="grid grid-cols-2 gap-6 py-7 sm:grid-cols-4">
                  {[['Starting price', '$82.39'], ['Protected price', '$81.57'], ['Coverage', '7 days'], ['Payout', '2 GEN']].map(([label, value]) => <div key={label}><dt className="text-xs text-slate">{label}</dt><dd className="mt-2 font-semibold tabular-nums text-navy-deep">{value}</dd></div>)}
            </dl>
            <div className="flex items-center gap-0 border-t border-border pt-6">
              {["Purchased", "Day 1", "Day 2", "Day 3", "Final day"].map((label, i) => <div key={label} className="flex min-w-0 flex-1 items-center"><div className="flex flex-col items-center gap-2"><span className={`grid h-7 w-7 place-items-center rounded-full ${i < 3 ? "bg-navy-deep text-porcelain" : "border border-border bg-porcelain text-slate"}`}>{i < 3 ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}</span><span className="text-center text-[0.68rem] text-slate">{label}</span></div>{i < 4 ? <span className="mx-2 mt-[-1.2rem] h-px flex-1 bg-border" /> : null}</div>)}
            </div>
          </div>
        </div>
      </Section>

      {/* Split image + accordion */}
      <Section tone="sand">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-border shadow-lift">
            <img
              src={marketDataImage}
              alt="Abstract visualization of commodity market data contours and daily closes"
              width={1280}
              height={1024}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <SectionHeading
              eyebrow="Daily checks"
              title={
                <>
                  Built on market data.{" "}
                  <span className="font-display italic">Checked automatically.</span>
                </>
              }
            />
            <Accordion type="single" collapsible defaultValue="ref" className="mt-8 w-full">
              {[
                {
                  id: "ref",
                  q: "Your starting price",
                  a: "Your starting price is recorded when you buy protection and stays the same for the full coverage period.",
                },
                {
                  id: "dual",
                  q: "Verified daily checks",
                  a: "Each completed day is checked using verified market prices. If the information does not agree, the check is tried again.",
                },
                {
                  id: "payout",
                  q: "Fixed payout",
                  a: "If the protected price is reached, your protection becomes ready to claim for the fixed payout shown at purchase.",
                },
              ].map((item) => (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger className="text-left text-base font-medium text-navy-deep">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-slate">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </Section>

      {/* Process */}
      <Section>
        <SectionHeading
          eyebrow="Process"
          title="Three steps from exposure to protection"
          lead="The whole lifecycle is visible from the moment you choose your terms."
        />
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              t: "Choose protection",
              d: "Pick a market, a 1–3% drop and a coverage period of 7, 14 or 30 days.",
            },
            {
              t: "Lock terms",
              d: "Pay the fixed GEN premium. Your starting price and protected price are recorded with your protection.",
            },
            {
              t: "Settle from verified data",
              d: "Each covered day is settled from two independent sources. A confirmed breach makes the fixed payout claimable.",
            },
          ].map((s, i) => (
            <li key={s.t} className="relative rounded-xl border border-border bg-card p-7">
            <span className="font-display text-5xl text-amber">0{i + 1}</span>
              <h3 className="mt-4 text-lg font-semibold text-navy-deep">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{s.d}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Product cards */}
      <Section tone="sand">
        <SectionHeading
          eyebrow="Products"
          title="Protection across three energy benchmarks"
          lead="Choose a market, drop level and coverage period that fits your needs."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {(markets ?? []).map((m) => (
            <article
              key={m.id}
              className="flex flex-col rounded-xl border border-border bg-card p-7 transition-shadow hover:shadow-lift"
            >
              <p className="eyebrow text-slate">{m.id}</p>
              <h3 className="mt-2 text-xl font-semibold text-navy-deep">{m.name}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate">{m.description}</p>
              <dl className="mt-6 space-y-2 border-t border-border pt-5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate">Drops</dt>
                  <dd className="text-ink">{DROPS.map((d) => `${d}%`).join(" · ")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate">Durations</dt>
                  <dd className="text-ink">{DURATIONS.join(" · ")} days</dd>
                </div>
              </dl>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/protect">Protect {m.shortName}</Link>
              </Button>
            </article>
          ))}
          {!markets
            ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-80 rounded-xl" />)
            : null}
        </div>
      </Section>

      {/* CTA */}
      <Section tone="navy" className="contour-motif">
        <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_auto]">
          <SectionHeading
            tone="light"
            title={
              <>
                Cover your next drawdown{" "}
                <span className="font-display text-amber italic">before it happens.</span>
              </>
            }
            lead="Choose your market and terms in under a minute. Premium and payout are fixed before you commit."
          />
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="accent" size="xl">
              <Link to="/protect">Get Protection</Link>
            </Button>
            <Button asChild variant="onDark" size="xl">
              <Link to="/dashboard">View Dashboard</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
