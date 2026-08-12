import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Github, ShieldCheck } from "lucide-react";
import { Section, SectionHeading } from "@/components/commoda/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { poolQuery, marketsQuery, configQuery } from "@/lib/commoda/queries";
import { gen } from "@/lib/commoda/format";
import { COMMODA_CONTRACT_ADDRESS, GENLAYER_CHAIN, CONTRACT_EXPLORER, GITHUB_URL } from "@/lib/commoda/config";

export const Route = createFileRoute("/transparency")({
  head: () => ({
    meta: [
      { title: "Transparency — Pool, Sources & Settlement | Commoda" },
      {
        name: "description",
        content:
          "Commoda pool state, contract architecture, market source table, settlement rule and what GenLayer validators independently verify.",
      },
      { property: "og:title", content: "Transparency — Pool, Sources & Settlement | Commoda" },
      {
        property: "og:description",
        content: "Pool state, contract architecture, sources and validator verification for Commoda.",
      },
    ],
  }),
  component: TransparencyPage,
});

function TransparencyPage() {
  const { data: pool, isPending } = useQuery(poolQuery);
  const { data: markets } = useQuery(marketsQuery);
  const { data: config } = useQuery(configQuery);

  const stats = pool
    ? [
        { label: "Pool balance", value: gen(pool.poolBalance) },
        { label: "Reserved liability", value: gen(pool.reservedLiability) },
        { label: "Active protections", value: pool.activeProtections.toLocaleString() },
        { label: "Payouts paid", value: gen(pool.payoutsPaid) },
      ]
    : [];

  return (
    <>
      <Section tone="navy">
        <SectionHeading
          tone="light"
          eyebrow="Transparency"
          title={
            <>
              Everything that determines an outcome is{" "}
              <span className="font-display text-amber italic">inspectable.</span>
            </>
          }
          lead="Terms, sources, pool state and settlement logic are published up front. Nothing about a protection is decided behind closed doors."
        />
      </Section>

      <Section>
        <SectionHeading eyebrow="Pool state" title="Protocol reserves" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {isPending || !pool
            ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)
            : stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-6">
                  <p className="text-xs font-medium text-slate">{s.label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-deep">
                    {s.value}
                  </p>
                </div>
              ))}
        </div>
        {pool ? (
          <p className="mt-5 text-sm text-slate">
            Pool utilisation: <span className="font-semibold text-ink">{pool.utilisationPct.toFixed(2)}%</span>{" "}
            of reserves are committed against open protections.
          </p>
        ) : null}
      </Section>

      <Section tone="sand">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Architecture" title="Contract architecture" />
            <ul className="mt-8 space-y-4">
              {[
                {
                  t: "Protection registry",
                  d: "Stores each protection: market, drop level, duration, locked reference price, derived trigger, premium, payout and state.",
                },
                {
                  t: "Settlement engine",
                  d: "Processes one covered day at a time, fetching daily closes from both sources and writing an immutable day result.",
                },
                {
                  t: "Pool & liability accounting",
                  d: "Tracks premiums received, payout liability reserved against open protections and payouts released on claim.",
                },
                {
                  t: "Claim handler",
                  d: "Releases the fixed payout once a protection reaches the claimable state. Payout size is fixed at purchase.",
                },
              ].map((i) => (
                <li key={i.t} className="rounded-xl border border-border bg-card p-5">
                  <p className="font-semibold text-navy-deep">{i.t}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate">{i.d}</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SectionHeading eyebrow="Sources" title="Market source table" />
            <div className="mt-8 overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-sand/70 text-left text-xs text-slate">
                  <tr>
                    <th className="px-4 py-3 font-medium">Market</th>
                    <th className="px-4 py-3 font-medium">Binance</th>
                    <th className="px-4 py-3 font-medium">Gate</th>
                  </tr>
                </thead>
                <tbody>
                  {(markets ?? []).map((m) => (
                    <tr key={m.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium text-ink">{m.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate">{m.binanceSymbol}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate">{m.gateSymbol}</td>
                    </tr>
                  ))}
                  {!markets ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6">
                        <Skeleton className="h-16 w-full" />
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="mt-8 rounded-xl border border-navy/15 bg-navy/5 p-6">
              <h3 className="text-sm font-semibold text-navy-deep">Settlement rule</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                A covered day is <strong className="text-danger">BREACHED</strong> only when the
                Binance daily close and the Gate daily close are both at or below the stored trigger
                price. If both are above, the day is{" "}
                <strong className="text-success">NOT_BREACHED</strong>. If the sources disagree or
                one is unavailable, the day is{" "}
                <strong className="text-warning">INCONCLUSIVE</strong> and retried.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="navy">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <SectionHeading
            tone="light"
            eyebrow="Validators"
            title="What validators verify"
            lead="GenLayer validators independently fetch the external market evidence for each settlement. They are not merely checking that a payload is well-formed JSON."
          />
          <ul className="space-y-4">
            {[
              "Each validator independently requests the historical daily close from Binance and Gate for the covered date.",
              "Validators compare the retrieved closes against the trigger price stored on the protection at purchase.",
              "A day result is only written when validators reach agreement on the same outcome from their own retrieved evidence.",
              "Disagreement between sources or between validators produces an inconclusive day rather than a resolved one.",
            ].map((t) => (
              <li
                key={t}
                className="flex gap-3 rounded-xl border border-porcelain/12 bg-porcelain/5 p-5"
              >
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-hidden />
                <span className="text-sm leading-relaxed text-porcelain/80">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <a className="inline-flex items-center gap-2 border border-porcelain/25 px-4 py-2 text-sm text-porcelain" href={`${CONTRACT_EXPLORER}/address/${COMMODA_CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer"><ExternalLink /> Contract Explorer</a>
          <a className="inline-flex items-center gap-2 border border-porcelain/25 px-4 py-2 text-sm text-porcelain" href={GITHUB_URL} target="_blank" rel="noreferrer"><Github /> GitHub</a>
        </div>
        <div className="mt-10 grid gap-4 border-t border-porcelain/12 pt-8 text-sm text-porcelain/75 sm:grid-cols-3">
          <p><span className="block text-xs uppercase tracking-[0.14em] text-amber">Network</span>{GENLAYER_CHAIN.name}</p>
          <p><span className="block text-xs uppercase tracking-[0.14em] text-amber">Contract</span>{COMMODA_CONTRACT_ADDRESS}</p>
          <p><span className="block text-xs uppercase tracking-[0.14em] text-amber">Status</span>{config ? "Connected" : "Loading"}</p>
        </div>
      </Section>
    </>
  );
}
