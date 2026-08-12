import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StateBadge, ResultBadge } from "@/components/commoda/StateBadge";
import { ProtectionDrawer } from "@/components/app/ProtectionDrawer";
import { protectionsQuery, qk } from "@/lib/commoda/queries";
import { commodaService } from "@/lib/commoda/service";
import { MARKETS, priceDigits } from "@/lib/commoda/markets";
import { dateLabel, gen, usd } from "@/lib/commoda/format";
import type { Protection } from "@/lib/commoda/types";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Protection Dashboard | Commoda" },
      {
        name: "description",
        content:
          "Track active, claimable and expired commodity drop protections, daily settlement results, premiums paid and payouts received.",
      },
      { property: "og:title", content: "Protection Dashboard | Commoda" },
      {
        property: "og:description",
        content: "Monitor drop protections, settlement progress and claims in one institutional view.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery(protectionsQuery);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | Protection["state"]>("ALL");
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    kind: "settle" | "claim";
  } | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.protections });
    queryClient.invalidateQueries({ queryKey: qk.wallet });
    queryClient.invalidateQueries({ queryKey: qk.pool });
  };

  const settle = useMutation({
    mutationFn: (id: string) => commodaService.settleNextDay(id),
    onMutate: (id) => setPendingAction({ id, kind: "settle" }),
    onSuccess: (p) => {
      invalidate();
      const last = [...p.days].reverse().find((d) => d.result !== "UNPROCESSED");
      toast.success(`Day settled for ${p.id}`, {
        description: last ? `Result: ${last.result.replace("_", " ").toLowerCase()}` : undefined,
      });
    },
    onError: (e: Error) => toast.error("Settlement failed", { description: e.message }),
    onSettled: () => setPendingAction(null),
  });

  const claim = useMutation({
    mutationFn: (id: string) => commodaService.claim(id),
    onMutate: (id) => setPendingAction({ id, kind: "claim" }),
    onSuccess: (p) => {
      invalidate();
      toast.success(`Payout of ${gen(p.payout)} sent`, { description: `${p.id} is now claimed.` });
    },
    onError: (e: Error) => toast.error("Claim failed", { description: e.message }),
    onSettled: () => setPendingAction(null),
  });

  const allProtections = data ?? [];
  const protections = allProtections.filter((p) => filter === "ALL" || p.state === filter);
  const selected = protections.find((p) => p.id === selectedId) ?? null;

  const summary = [
    { label: "Active protections", value: allProtections.filter((p) => p.state === "ACTIVE").length.toString() },
    { label: "Claimable", value: allProtections.filter((p) => p.state === "CLAIMABLE").length.toString() },
    { label: "Total premiums", value: gen(allProtections.reduce((a, p) => a + p.premium, 0)) },
    {
      label: "Potential payout",
      value: gen(allProtections.filter((p) => p.state === "CLAIMABLE").reduce((a, p) => a + p.payout, 0)),
    },
  ];

  return (
    <div className="bg-porcelain">
      <div className="mx-auto w-full max-w-[1320px] px-5 py-14 sm:px-8 md:py-20">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow text-slate">Dashboard</p>
            <h1 className="mt-2 truncate text-3xl font-semibold text-navy-deep sm:text-4xl">
              Good afternoon / portfolio
            </h1>
          </div>
          <Button asChild variant="accent" className="shrink-0">
            <Link to="/protect">Get Protection</Link>
          </Button>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isPending
            ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)
            : summary.slice(0, 4).map((s) => (
                <div key={s.label} className="border border-border bg-card p-5">
                  <p className="text-xs font-medium text-slate">{s.label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-deep">
                    {s.value}
                  </p>
                </div>
              ))}
        </div>

        <div className="mt-10">
          {isError ? (
            <div className="rounded-xl border border-danger/25 bg-danger/5 p-10 text-center">
              <p className="font-medium text-danger">Protections could not be loaded.</p>
              <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : isPending ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : protections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-14 text-center">
              <h2 className="text-lg font-semibold text-navy-deep">No protections yet</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate">
                Once you purchase drop protection it will appear here with its settlement timeline.
              </p>
              <Button asChild variant="accent" className="mt-6">
                <Link to="/protect">Get Protection</Link>
              </Button>
            </div>
          ) : (
            <div>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
                <h2 className="text-xl font-semibold text-navy-deep">Your protections</h2>
                <div className="flex flex-wrap gap-1">
                  {(["ALL", "ACTIVE", "CLAIMABLE", "EXPIRED", "CLAIMED"] as const).map((value) => <button key={value} onClick={() => setFilter(value)} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${filter === value ? "bg-navy-deep text-porcelain" : "text-slate hover:bg-sand hover:text-ink"}`}>{value === "ALL" ? "All" : value[0] + value.slice(1).toLowerCase()}</button>)}
                </div>
              </div>
              <div className="space-y-3">
              {protections.map((p) => (
                <ProtectionRow
                  key={p.id}
                  protection={p}
                  onOpen={() => setSelectedId(p.id)}
                  onSettle={() => settle.mutate(p.id)}
                  onClaim={() => claim.mutate(p.id)}
                  pendingAction={pendingAction}
                />
              ))}
              </div>
            </div>
          )}
        </div>

        <p className="mt-8 text-xs text-slate">
          Demo data. Settlement and claim actions run against a mock contract service.
        </p>
      </div>

      <ProtectionDrawer
        protection={selected}
        open={Boolean(selected)}
        onOpenChange={(v) => !v && setSelectedId(null)}
        onSettle={(id) => settle.mutate(id)}
        onClaim={(id) => claim.mutate(id)}
        pendingAction={pendingAction}
      />
    </div>
  );
}

function ProtectionRow({
  protection: p,
  onOpen,
  onSettle,
  onClaim,
  pendingAction,
}: {
  protection: Protection;
  onOpen: () => void;
  onSettle: () => void;
  onClaim: () => void;
  pendingAction: { id: string; kind: "settle" | "claim" } | null;
}) {
  const market = MARKETS[p.market];
  const digits = priceDigits(p.market);
  const settled = p.days.filter((d) => d.result !== "UNPROCESSED").length;
  const nextDay = p.days.find((d) => d.result === "UNPROCESSED");
  const lastResult = [...p.days].reverse().find((d) => d.result !== "UNPROCESSED");
  const busy = pendingAction?.id === p.id;

  return (
    <article className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-elegant">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpen}
              className="rounded text-base font-semibold text-navy-deep underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {p.id}
            </button>
            <StateBadge state={p.state} />
            {lastResult ? <ResultBadge result={lastResult.result} /> : null}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <Cell label="Market" value={market.shortName} />
            <Cell label="Drop" value={`${p.drop}%`} />
            <Cell label="Reference" value={usd(p.referencePrice, digits)} />
            <Cell label="Trigger" value={usd(p.triggerPrice, digits)} />
            <Cell label="Settled days" value={`${settled}/${p.duration}`} />
            <Cell
              label="Next settlement"
              value={nextDay ? dateLabel(nextDay.date) : "—"}
            />
          </dl>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="ghost" onClick={onOpen}>
            Details
          </Button>
          <Button
            variant="outline"
            disabled={p.state !== "ACTIVE" || !nextDay || busy}
            onClick={onSettle}
          >
            {busy && pendingAction?.kind === "settle" ? (
              <>
                <Loader2 className="animate-spin" /> Settling…
              </>
            ) : (
              "Settle"
            )}
          </Button>
          <Button variant="accent" disabled={p.state !== "CLAIMABLE" || busy} onClick={onClaim}>
            {busy && pendingAction?.kind === "claim" ? (
              <>
                <Loader2 className="animate-spin" /> Claiming…
              </>
            ) : (
              "Claim Payout"
            )}
          </Button>
        </div>
      </div>
    </article>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate">{label}</dt>
      <dd className="mt-0.5 truncate font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}
