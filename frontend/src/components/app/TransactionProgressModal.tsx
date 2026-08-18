import { Check, CircleAlert, ExternalLink, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requiresFinality, type TransactionProgress, type TransactionStage } from "@/lib/commoda/transaction-types";

const STEPS: { id: TransactionStage; label: string; hint: string }[] = [
  { id: "preparing", label: "Preparing", hint: "Checking your wallet and protection terms." },
  { id: "awaiting_wallet", label: "Awaiting wallet", hint: "Confirm the transaction in your wallet." },
  { id: "submitted", label: "Submitted", hint: "Your transaction has been submitted." },
  { id: "processing", label: "Processing", hint: "GenLayer validators are processing the transaction." },
  { id: "accepted", label: "Accepted", hint: "The transaction was accepted." },
  { id: "awaiting_finality", label: "Awaiting Finality", hint: "The accepted transaction is waiting for GenLayer finality." },
  { id: "finalized", label: "Finalized", hint: "The transfer is complete." },
];

const ORDER = STEPS.map((step) => step.id);

export function TransactionProgressModal({ open, onOpenChange, progress, title }: { open: boolean; onOpenChange: (open: boolean) => void; progress: TransactionProgress; title: string }) {
  const failed = progress.stage === "failed";
  const financial = requiresFinality(progress.method);
  const accepted = progress.stage === "accepted" && !financial;
  const awaitingFinality = progress.stage === "awaiting_finality";
  const finalized = progress.stage === "finalized";
  const currentIndex = failed ? Math.max(0, ORDER.indexOf("submitted")) : Math.max(0, ORDER.indexOf(progress.stage));
  const canClose = accepted || awaitingFinality || finalized || failed;
  const completeTitle = progress.method === "claim_payout" ? "Payout complete" : progress.method === "cancel_unresolved_protection" && progress.outcome?.startsWith("Original premium") ? "Refund complete" : progress.method === "cancel_unresolved_protection" ? "Settlement finalized" : "Finalized";
  return (
    <Dialog open={open} onOpenChange={(value) => canClose && onOpenChange(value)}>
      <DialogContent
        className={cn("sm:max-w-md", !canClose && "[&>button:last-child]:hidden")}
        onEscapeKeyDown={(event) => !canClose && event.preventDefault()}
        onInteractOutside={(event) => !canClose && event.preventDefault()}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="flex flex-col items-center pt-2 text-center">
          <div className={cn("flex size-14 items-center justify-center rounded-2xl", (accepted || finalized) ? "bg-success/12 text-success" : failed ? "bg-danger/10 text-danger" : "bg-amber/10 text-amber")}>
            {(accepted || finalized) ? <Check className="size-7" /> : failed ? <CircleAlert className="size-6" /> : <Loader2 className="size-6 animate-spin" />}
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-navy-deep">{failed ? "Transaction not accepted" : finalized ? completeTitle : accepted ? "Accepted" : awaitingFinality ? "Awaiting Finality" : title}</h2>
          <p className="mt-1.5 max-w-xs text-sm text-slate">{failed ? (progress.error ?? "Something went wrong. You can close this window and try again.") : finalized ? (progress.outcome ?? "The transaction was finalized by GenLayer.") : accepted ? (progress.outcome ?? "The transaction was accepted by GenLayer.") : awaitingFinality ? (progress.outcome ?? "Accepted — awaiting finality. The financial result is not complete yet.") : STEPS[currentIndex]?.hint}</p>
        </div>
        <ol className="mt-6 space-y-1">
          {STEPS.map((step, index) => {
            const state = accepted || finalized || index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
            return <li key={step.id} className={cn("flex gap-3 rounded-lg px-3 py-3", state === "current" && "bg-sand/60")}>
              <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.6rem]", state === "done" && "border-success bg-success text-white", state === "current" && !failed && "border-amber text-amber", state === "current" && failed && "border-danger text-danger", state === "todo" && "border-border text-slate")}>
                {state === "done" ? <Check className="size-3" /> : state === "current" && !failed ? <Loader2 className="size-3 animate-spin" /> : index + 1}
              </span>
              <span className={cn("text-sm font-medium", state === "todo" && "text-slate")}>{step.label}</span>
            </li>;
          })}
        </ol>
        {progress.hash ? <details className="rounded-lg border border-border bg-sand/40 p-3 text-xs"><summary className="cursor-pointer font-medium">Transaction details</summary><p className="mt-2 break-all text-slate">{progress.hash}</p><a className="mt-2 inline-flex items-center gap-1 text-amber hover:underline" href={`https://explorer-bradbury.genlayer.com/tx/${progress.hash}`} target="_blank" rel="noreferrer">View in explorer <ExternalLink className="size-3" /></a></details> : null}
        {canClose ? <Button className="w-full" variant={accepted ? "accent" : "outline"} onClick={() => onOpenChange(false)}>Close</Button> : null}
      </DialogContent>
    </Dialog>
  );
}
