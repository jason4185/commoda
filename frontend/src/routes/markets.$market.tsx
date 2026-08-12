import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Section, SectionHeading } from "@/components/commoda/Section";
import { LivePrice } from "@/components/commoda/LivePrice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { marketDetailQuery } from "@/lib/commoda/queries";
import { marketFromSlug } from "@/lib/commoda/markets";
import { gen } from "@/lib/commoda/format";
import { DROPS, DURATIONS } from "@/lib/commoda/terms";

export const Route = createFileRoute("/markets/$market")({
  head: ({ params }) => ({ meta: [{ title: `${params.market.toUpperCase()} Protection | Commoda` }] }),
  component: MarketDetailPage,
});

function MarketDetailPage() {
  const { market: slug } = Route.useParams();
  const marketId = marketFromSlug(slug);
  const detail = useQuery(marketDetailQuery(marketId));

  if (!marketId) {
    return <Section><div className="max-w-xl py-10"><p className="eyebrow text-slate">Markets</p><h1 className="mt-3 text-4xl font-semibold text-navy-deep">Market not found</h1><p className="mt-4 text-slate">This market is not supported by Commoda.</p><Button asChild variant="accent" className="mt-8"><Link to="/markets">View Markets</Link></Button></div></Section>;
  }
  if (detail.isPending) return <Section><div className="space-y-6 py-10"><Skeleton className="h-5 w-24" /><Skeleton className="h-14 w-96 max-w-full" /><Skeleton className="h-48 w-full" /></div></Section>;
  if (detail.isError || !detail.data) return <Section><div className="max-w-xl py-10"><p className="eyebrow text-slate">{marketId}</p><h1 className="mt-3 text-4xl font-semibold text-navy-deep">Unable to load market details.</h1><p className="mt-4 text-slate">Try again to load the current protection options.</p><Button variant="outline" className="mt-8" onClick={() => void detail.refetch()}>Try again</Button></div></Section>;

  const { market, terms } = detail.data;
  return <>
    <Section tone="navy">
      <Link to="/markets" className="inline-flex items-center gap-2 text-sm text-porcelain/70 hover:text-porcelain"><ArrowLeft className="h-4 w-4" /> Back to markets</Link>
      <div className="mt-12 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div><p className="eyebrow text-amber">{market.id}</p><SectionHeading tone="light" className="mt-3" title={market.name} lead={`Protect against a predefined drop in ${market.name.toLowerCase()} prices with fixed terms and a fixed payout.`} /></div>
        <div className="border border-porcelain/15 bg-porcelain/5 p-6"><p className="text-xs font-medium text-porcelain/60">Live market price</p><p className="mt-2 text-3xl font-semibold tabular-nums text-porcelain"><LivePrice market={marketId} dark /></p><p className="mt-2 text-xs text-porcelain/55">Informational only. Your starting price is recorded when you buy.</p></div>
      </div>
    </Section>
    <Section>
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]"><div><SectionHeading eyebrow="Protection terms" title="Choose the drop and coverage that fit your needs." /><p className="mt-6 max-w-lg leading-relaxed text-slate">Available protection covers 1%, 2% or 3% drops over 7, 14 or 30 days. Payouts are fixed when you purchase.</p><Button asChild variant="accent" size="lg" className="mt-8"><Link to="/protect" search={{ market: marketId }}>Protect {market.shortName} <ArrowUpRight /></Link></Button></div>
        <div className="overflow-x-auto border border-border bg-card"><table className="w-full min-w-[560px] text-sm"><thead className="bg-sand/70 text-left text-xs text-slate"><tr><th className="px-4 py-3 font-medium">Duration</th><th className="px-4 py-3 font-medium">Premium</th>{DROPS.map((drop) => <th key={drop} className="px-4 py-3 text-right font-medium">{drop}% Drop</th>)}</tr></thead><tbody>{DURATIONS.map((duration) => <tr key={duration} className="border-t border-border"><td className="px-4 py-4 font-medium text-ink">{duration} days</td><td className="px-4 py-4 text-slate">{gen(terms.find((term: any) => term.duration === duration && term.event_percent === 1)?.premium)}</td>{DROPS.map((drop) => <td key={drop} className="px-4 py-4 text-right font-semibold tabular-nums text-ink">{gen(terms.find((term: any) => term.duration === duration && term.event_percent === drop)?.payout)}</td>)}</tr>)}</tbody></table></div>
      </div>
    </Section>
  </>;
}
