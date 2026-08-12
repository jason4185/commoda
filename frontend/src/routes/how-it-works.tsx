import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, CircleSlash, Coins, Timer, Lock } from "lucide-react";
import { Section, SectionHeading } from "@/components/commoda/Section";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Drop Protection Works | Commoda" },
      {
        name: "description",
        content:
          "From locked purchase reference price to daily dual-source settlement, breach outcomes and claims — how Commoda drop protection resolves.",
      },
      { property: "og:title", content: "How Drop Protection Works | Commoda" },
      {
        property: "og:description",
        content: "Purchase reference, coverage days, daily settlement, breach outcomes, claim or expiry.",
      },
    ],
  }),
  component: HowItWorksPage,
});

const STEPS = [
  {
    icon: Lock,
    title: "Purchase reference",
    body: "At purchase the reference price is read from Gate and stored with your protection. Your trigger price is that reference minus your chosen drop.",
  },
  {
    icon: Timer,
    title: "Coverage days",
    body: "Coverage runs for 7, 14 or 30 consecutive days. Each covered day is settled independently against the stored trigger.",
  },
  {
    icon: CheckCircle2,
    title: "Daily settlement",
    body: "For each covered day the protocol fetches the daily close from Binance and Gate and compares both against the stored trigger price.",
  },
  {
    icon: Coins,
    title: "Claim or expiry",
    body: "The first confirmed breach makes the protection claimable for its fixed payout. With no breach across all covered days, it expires.",
  },
];

const OUTCOMES = [
  {
    icon: CheckCircle2,
    label: "Breached",
    tone: "text-danger border-danger/25 bg-danger/5",
    body: "Both Binance and Gate report a daily close at or below the stored trigger price. The protection becomes claimable for its fixed payout.",
  },
  {
    icon: CircleSlash,
    label: "Not breached",
    tone: "text-success border-success/25 bg-success/5",
    body: "Both sources report a daily close above the trigger. The day is closed and coverage continues to the next day.",
  },
  {
    icon: CircleAlert,
    label: "Inconclusive",
    tone: "text-warning border-warning/30 bg-warning/5",
    body: "The sources disagree, or one is unavailable. The day is not resolved against you — it stays open and is retried until both sources agree.",
  },
];

function HowItWorksPage() {
  return (
    <>
      <Section tone="navy" className="contour-motif">
        <SectionHeading
          tone="light"
          eyebrow="How it works"
          title={
            <>
              A protection that resolves on{" "}
              <span className="font-display text-amber italic">evidence, not opinion.</span>
            </>
          }
          lead="Every outcome is determined by predefined terms and two independent market data sources. There is no discretionary assessment and no claims negotiation."
        />
      </Section>

      <Section>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="rounded-xl border border-border bg-card p-6 shadow-elegant transition-shadow hover:shadow-lift"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-navy-deep text-amber">
                  <s.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-sm font-semibold tabular-nums text-slate">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-navy-deep">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="sand">
        <SectionHeading
          eyebrow="Daily results"
          title="Three possible outcomes for every covered day"
          lead="A breach requires agreement. Disagreement never counts as a resolved day."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {OUTCOMES.map((o) => (
            <div key={o.label} className={`rounded-xl border bg-card p-6 ${o.tone}`}>
              <o.icon className="h-6 w-6" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold">{o.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{o.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionHeading
            eyebrow="Details"
            title="Mechanics, without the fine print"
            lead="The terms below apply identically to every market and every buyer."
          />
          <Accordion type="single" collapsible className="w-full">
            {[
              {
                q: "How is the reference price set?",
                a: "The purchase reference price is read from Gate at the moment of purchase and stored on the protection. It never changes afterwards, so your trigger is fixed for the whole coverage period.",
              },
              {
                q: "Why do two sources have to agree?",
                a: "A single feed can be delayed, thin or wrong. Requiring Binance and Gate to independently confirm a daily close at or below the trigger removes single-source failure from the settlement path.",
              },
              {
                q: "What happens on an inconclusive day?",
                a: "The day remains unresolved and is retried. It is never recorded as not breached, so a data outage cannot silently work against the protection holder.",
              },
              {
                q: "How large is the payout?",
                a: "Payouts are fixed at purchase by duration and drop level: 2–4 GEN for 7 days, 4–6 GEN for 14 days and 6–10 GEN for 30 days. The payout does not scale with how far the price falls.",
              },
              {
                q: "What happens if no breach occurs?",
                a: "The protection expires at the end of its coverage period. The premium is retained by the pool, which funds payouts for protections that do breach.",
              },
            ].map((item) => (
              <AccordionItem key={item.q} value={item.q}>
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

        <div className="mt-14 flex flex-wrap gap-3">
          <Button asChild variant="accent" size="lg">
            <Link to="/protect">Get Protection</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/transparency">See settlement transparency</Link>
          </Button>
        </div>
      </Section>
    </>
  );
}