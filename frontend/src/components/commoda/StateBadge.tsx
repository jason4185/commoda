import type { DayResult, ProtectionState } from "@/lib/commoda/types";
import type { FinancialFinality } from "@/lib/commoda/types";
import { getProtectionStatusLabel } from "@/lib/commoda/service";

const base =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-tight";

const stateStyles: Record<ProtectionState, string> = {
  ACTIVE: "border-navy/20 bg-navy/8 text-navy",
  CLAIMABLE: "border-success/30 bg-success/10 text-success",
  EXPIRED: "border-border bg-muted text-slate",
  CLAIMED: "border-amber/40 bg-amber/15 text-[oklch(0.45_0.11_74)]",
  CANCELLED: "border-warning/35 bg-warning/12 text-warning",
};

export function StateBadge({ state, financialFinality = "UNKNOWN" }: { state: ProtectionState; financialFinality?: FinancialFinality }) {
  return (
    <span className={`${base} ${stateStyles[state]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {getProtectionStatusLabel(state, financialFinality)}
    </span>
  );
}

const resultStyles: Record<DayResult, string> = {
  UNPROCESSED: "border-border bg-muted text-slate",
  BREACHED: "border-danger/30 bg-danger/10 text-danger",
  NOT_BREACHED: "border-success/25 bg-success/10 text-success",
  INCONCLUSIVE: "border-warning/35 bg-warning/12 text-warning",
  UNAVAILABLE: "border-warning/35 bg-warning/12 text-warning",
};

const resultLabels: Record<DayResult, string> = {
  UNPROCESSED: "Waiting to be checked",
  BREACHED: "Protected price reached",
  NOT_BREACHED: "No protected drop",
  INCONCLUSIVE: "Sources disagree",
  UNAVAILABLE: "Source data unavailable",
};

export function ResultBadge({ result }: { result: DayResult }) {
  return <span className={`${base} ${resultStyles[result]}`}>{resultLabels[result]}</span>;
}
