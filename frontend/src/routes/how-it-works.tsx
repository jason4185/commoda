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
          "A simple guide to choosing protection, checking prices each day and receiving a fixed payout.",
      },
      { property: "og:title", content: "How Drop Protection Works | Commoda" },
      {
        property: "og:description",
        content: "Choose protection, follow daily price checks and claim a fixed payout if the protected price is reached.",
      },
    ],
  }),
  component: HowItWorksPage,
});

const STEPS = [
  {
    icon: Lock,
    title: "Choose a commodity",
    body: "Select WTI, Brent or Natural Gas.",
  },
  {
    icon: Timer,
    title: "Choose your protection",
    body: "Pick a 1%, 2% or 3% drop and a 7, 14 or 30 day period.",
  },
  {
    icon: CheckCircle2,
    title: "Buy protection",
    body: "Pay the fixed premium and your starting price is recorded.",
  },
  {
    icon: Coins,
    title: "Daily price checks",
    body: "After each completed day, Commoda checks whether the protected price was reached.",
  },
];

const OUTCOMES = [
  {
    icon: CheckCircle2,
    label: "Protected price reached",
    tone: "text-danger border-danger/25 bg-danger/5",
    body: "Your protection becomes ready to claim for its fixed payout.",
  },
  {
    icon: CircleSlash,
    label: "No protected drop",
    tone: "text-success border-success/25 bg-success/5",
    body: "The day is complete and coverage continues to the next day.",
  },
  {
    icon: CircleAlert,
    label: "Sources disagree",
    tone: "text-warning border-warning/30 bg-warning/5",
    body: "The day stays open and is checked again. It does not count against your protection.",
  },
  {
    icon: CircleAlert,
    label: "Source data unavailable",
    tone: "text-warning border-warning/30 bg-warning/5",
    body: "Consensus could not obtain the required source data. The day stays open and can be retried.",
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
              <span className="font-display text-amber italic">simple and clear.</span>
            </>
          }
          lead="Choose your terms up front, then let verified market prices determine the outcome."
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
                q: "When is my starting price recorded?",
                a: "Your starting price is recorded when you buy protection. Your protected price is then calculated from the drop level you selected.",
              },
              {
                q: "How are daily checks verified?",
                a: "Commoda uses verified market prices and GenLayer validator checks before a day is marked complete.",
              },
              {
                q: "What happens when a day cannot be confirmed?",
                a: "The day stays open and is checked again. It is not marked as a clear day while the check is unresolved.",
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
