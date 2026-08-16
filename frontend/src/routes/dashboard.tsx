import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StateBadge, ResultBadge } from "@/components/commoda/StateBadge";
import { ProtectionDrawer } from "@/components/app/ProtectionDrawer";
import { protectionsQuery, qk, summaryQuery, attentionQuery, protectionQuery } from "@/lib/commoda/queries";
import {
  canCancelProtection,
  canClaimProtection,
  commodaService,
  getSettlementAction,
} from "@/lib/commoda/service";
import { MARKETS, priceDigits } from "@/lib/commoda/markets";
import { dateLabel, gen, usd } from "@/lib/commoda/format";
import type { Protection } from "@/lib/commoda/types";
import { useWallet } from "@/lib/commoda/wallet";
import { useTransactionManager } from "@/lib/commoda/transaction-context";

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
  const wallet = useWallet();
  const transaction = useTransactionManager();
  const owner = wallet.address ?? "";
  const { data, isPending, isError, refetch } = useQuery(protectionsQuery(owner));
  const { data: userSummary } = useQuery(summaryQuery(owner));
  useQuery(attentionQuery(owner));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | Protection["state"] | "READY_TO_SETTLE">("ALL");
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    kind: "settle" | "cancel" | "claim";
  } | null>(null);

  const invalidate = (id?: string) => {
    queryClient.invalidateQueries({ queryKey: qk.protections(owner) });
    queryClient.invalidateQueries({ queryKey: qk.summary(owner) });
    queryClient.invalidateQueries({ queryKey: qk.attention(owner) });
    queryClient.invalidateQueries({ queryKey: qk.pool });
    if (id) queryClient.invalidateQueries({ queryKey: qk.protection(id, owner) });
  };

  const settle = useMutation({
    mutationFn: (id: string) => commodaService.settleNextDay(id, transaction.update),
    onMutate: (id) => { setPendingAction({ id, kind: "settle" }); const target = allProtections.find((item) => item.id === id); transaction.begin(target && getSettlementAction(target) === "RETRY" ? "Retrying settlement" : "Settling protection", "settle_protection"); },
    onSuccess: (p) => {
      invalidate(p.id);
      const last = [...p.days].reverse().find((d) => d.result !== "UNPROCESSED");
      transaction.setOutcome(last ? ({ NOT_BREACHED: "No protected drop", BREACHED: "Protected price reached", INCONCLUSIVE: "Checking again required", UNPROCESSED: "Waiting" }[last.result]) : "Settlement accepted.");
    },
    onError: (e: Error) => { if (transaction.progress.stage !== "accepted") transaction.fail(e); toast.error("Settlement failed", { description: e.message }); },
    onSettled: () => setPendingAction(null),
  });

  const claim = useMutation({
    mutationFn: (id: string) => commodaService.claim(id, transaction.update),
    onMutate: (id) => { setPendingAction({ id, kind: "claim" }); transaction.begin("Claiming payout", "claim_payout"); },
    onSuccess: (p) => {
      invalidate(p.id);
      transaction.setOutcome(`Payout of ${gen(p.payout)} was accepted.`);
    },
    onError: (e: Error) => { if (transaction.progress.stage !== "accepted") transaction.fail(e); toast.error("Claim failed", { description: e.message }); },
    onSettled: () => setPendingAction(null),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => commodaService.cancelUnresolved(id, transaction.update),
    onMutate: (id) => { setPendingAction({ id, kind: "cancel" }); transaction.begin("Refunding protection", "cancel_unresolved_protection"); },
    onSuccess: (p) => {
      invalidate(p.id);
      transaction.setOutcome(`Original premium of ${gen(p.premium)} was refunded.`);
    },
    onError: (e: Error) => { if (transaction.progress.stage !== "accepted") transaction.fail(e); toast.error("Cancellation failed", { description: e.message }); },
    onSettled: () => setPendingAction(null),
  });

  const allProtections = data ?? [];
  const protections = allProtections.filter(
    (p) => filter === "ALL" || (filter === "READY_TO_SETTLE" ? getSettlementAction(p) !== "NONE" : p.state === filter),
  );
  const selected = allProtections.find((p) => p.id === selectedId) ?? null;
  const { data: selectedDetail } = useQuery(protectionQuery(selectedId ?? "", owner));

  const summary = [
    { label: "Total", value: String(userSummary?.total ?? allProtections.length) },
    { label: "Active", value: String(userSummary?.active ?? allProtections.filter((p) => p.state === "ACTIVE").length) },
    { label: "Ready to settle", value: allProtections.filter((p) => getSettlementAction(p) !== "NONE").length.toString() },
    { label: "Ready to claim", value: String(userSummary?.claimable ?? allProtections.filter(canClaimProtection).length) },
    { label: "Ended", value: String(userSummary?.expired ?? allProtections.filter((p) => p.state === "EXPIRED").length) },
    { label: "Claimed", value: String(userSummary?.claimed ?? allProtections.filter((p) => p.state === "CLAIMED").length) },
    { label: "Cancelled", value: String(userSummary?.cancelled ?? allProtections.filter((p) => p.state === "CANCELLED").length) },
    { label: "Premiums paid", value: userSummary ? gen(Number(userSummary.premiums) / 1e18) : gen(allProtections.reduce((a, p) => a + p.premium, 0)) },
    { label: "Premiums refunded", value: userSummary ? gen(Number(userSummary.premiums_refunded) / 1e18) : gen(0) },
    { label: "Claimable payout", value: userSummary ? gen(Number(userSummary.claimable_payout) / 1e18) : gen(0) },
    { label: "Payouts received", value: userSummary ? gen(Number(userSummary.payouts) / 1e18) : gen(0) },
  ];

  const attention = allProtections.filter((p) => getSettlementAction(p) !== "NONE" || canClaimProtection(p) || canCancelProtection(p));

  return (
    <div className="bg-porcelain">
      <div className="mx-auto w-full max-w-[1320px] px-5 py-14 sm:px-8 md:py-20">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow text-slate">Dashboard</p>
            <h1 className="mt-2 truncate text-3xl font-semibold text-navy-deep sm:text-4xl">
              My protections
            </h1>
          </div>
          <Button asChild variant="accent" className="shrink-0">
            <Link to="/protect">Get Protection</Link>
          </Button>
        </header>

        <div className="mt-10 grid overflow-hidden border border-border bg-card sm:grid-cols-2 lg:grid-cols-5">
          {isPending
            ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)
            : summary.map((s) => (
                <div key={s.label} className="border-b border-r border-border p-4 last:border-r-0 lg:p-5">
                  <p className="text-xs font-medium text-slate">{s.label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-navy-deep">
                    {s.value}
                  </p>
                </div>
              ))}
        </div>

        <div className="mt-10">
          {!wallet.address ? (
            <div className="border border-border bg-card p-14 text-center">
              <h2 className="text-lg font-semibold text-navy-deep">Connect your wallet to view your protections.</h2>
              <Button variant="accent" className="mt-6" onClick={wallet.connect}>Connect Wallet</Button>
            </div>
          ) : isError ? (
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
              {attention.length > 0 ? (
                <section className="mb-10 border border-border bg-card p-5">
                  <p className="eyebrow text-slate">Needs attention</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {attention.map((p) => {
                      const action = getSettlementAction(p);
                      const cancellation = canCancelProtection(p);
                      const label = canClaimProtection(p)
                        ? "Payout ready"
                        : cancellation
                          ? "Resolution refund"
                        : action === "RETRY"
                          ? "Settlement retry"
                          : "Settlement ready";
                      return (
                        <button key={p.id} onClick={() => setSelectedId(p.id)} className="border border-border p-4 text-left hover:border-navy/35">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">{label}</p>
                        <p className="mt-2 font-semibold text-navy-deep">{MARKETS[p.market].name}</p>
                          <p className="mt-3 text-sm text-amber">{canClaimProtection(p) ? "Claim Payout" : cancellation ? "Cancel & Refund" : action === "RETRY" ? "Retry Settlement" : "Settle Now"}</p>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
                <h2 className="text-xl font-semibold text-navy-deep">Your protections</h2>
                <div className="flex flex-wrap gap-1">
                  {(["ALL", "ACTIVE", "READY_TO_SETTLE", "CLAIMABLE", "EXPIRED", "CLAIMED", "CANCELLED"] as const).map((value) => <button key={value} onClick={() => setFilter(value)} className={`px-3 py-1.5 text-xs font-semibold transition-colors ${filter === value ? "bg-navy-deep text-porcelain" : "text-slate hover:bg-sand hover:text-ink"}`}>{value === "ALL" ? "All" : value === "ACTIVE" ? "Active" : value === "READY_TO_SETTLE" ? "Ready to settle" : value === "CLAIMABLE" ? "Ready to claim" : value === "EXPIRED" ? "Ended" : value === "CLAIMED" ? "Claimed" : "Cancelled"}</button>)}
                </div>
              </div>
              <div className="space-y-3">
              {protections.map((p) => (
                <ProtectionRow
                  key={p.id}
                  protection={p}
                  onOpen={() => setSelectedId(p.id)}
                  onSettle={() => settle.mutate(p.id)}
                  onCancel={() => cancel.mutate(p.id)}
                  onClaim={() => claim.mutate(p.id)}
                  pendingAction={pendingAction}
                />
              ))}
              </div>
            </div>
          )}
        </div>

        <p className="mt-8 text-xs text-slate">
          Protection data and actions come from the Commoda contract.
        </p>
      </div>

      <ProtectionDrawer
        protection={selected ? { ...selected, ...(selectedDetail ?? {}) } : null}
        open={Boolean(selected)}
        onOpenChange={(v) => !v && setSelectedId(null)}
        onSettle={(id) => settle.mutate(id)}
        onCancel={(id) => cancel.mutate(id)}
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
  onCancel,
  onClaim,
  pendingAction,
}: {
  protection: Protection;
  onOpen: () => void;
  onSettle: () => void;
  onCancel: () => void;
  onClaim: () => void;
  pendingAction: { id: string; kind: "settle" | "cancel" | "claim" } | null;
}) {
  const market = MARKETS[p.market];
  const digits = priceDigits(p.market);
  const settled = p.settledDays;
  const nextDay = p.state === "ACTIVE" ? p.days.find((d) => d.result === "INCONCLUSIVE") ?? p.days.find((d) => d.result === "UNPROCESSED") : undefined;
  const action = getSettlementAction(p);
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
              {market.name}
            </button>
            <StateBadge state={p.state} />
            {lastResult ? <ResultBadge result={lastResult.result} /> : null}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <Cell label="Market" value={market.shortName} />
            <Cell label="Drop" value={`${p.drop}%`} />
            <Cell label="Starting price" value={usd(p.referencePrice, digits)} />
            <Cell label="Protected price" value={usd(p.triggerPrice, digits)} />
            <Cell label="Days checked" value={`${settled}/${p.duration}`} />
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
          {action !== "NONE" ? <Button variant="outline" disabled={busy} onClick={onSettle}>{busy && pendingAction?.kind === "settle" ? <><Loader2 className="animate-spin" /> Checking…</> : action === "RETRY" ? "Retry Settlement" : "Settle Now"}</Button> : null}
          {canCancelProtection(p) ? <Button variant="outline" disabled={busy} onClick={onCancel}>{busy && pendingAction?.kind === "cancel" ? <><Loader2 className="animate-spin" /> Refunding…</> : "Cancel & Refund"}</Button> : null}
          {canClaimProtection(p) ? <Button variant="accent" disabled={busy} onClick={onClaim}>{busy && pendingAction?.kind === "claim" ? <><Loader2 className="animate-spin" /> Claiming…</> : "Claim Payout"}</Button> : null}
          {p.state === "CLAIMED" ? <span className="self-center text-sm font-semibold text-success">Paid</span> : null}
          {p.state === "CANCELLED" ? <span className="self-center text-sm font-semibold text-warning">Premium refunded</span> : null}
          {p.state === "ACTIVE" && action === "NONE" && nextDay ? <span className="self-center text-xs text-slate">Next check: {dateLabel(nextDay.date)}</span> : null}
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
