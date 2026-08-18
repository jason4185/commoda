// @ts-nocheck — executed by Bun's test runner, not the frontend TypeScript build.
import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StateBadge } from "../../components/commoda/StateBadge";
import { canCancelProtection, canPurchaseFromQuote, getCancellationAction, getFinancialTransferLabel, getProtectionStatusLabel, resolveLatestOwnerProtectionId } from "./service";
import { MARKETS } from "./markets";
import { COMMODA_CONTRACT_ADDRESS } from "./config";
import { requiresFinality } from "./transaction-types";
import { clearPendingFinancialTransaction, getPendingFinancialTransactions, rememberPendingFinancialTransaction } from "./contract";

describe("owner-index purchase ID resolution", () => {
  test("uses the actual global ID at the final owner index", () => {
    expect(resolveLatestOwnerProtectionId([0n, 2n])).toBe("2");
    expect(resolveLatestOwnerProtectionId([1n])).toBe("1");
  });
});

describe("production deployment configuration", () => {
  test("uses the current Commoda Bradbury contract", () => {
    expect(COMMODA_CONTRACT_ADDRESS).toBe("0x35D3a7EbF3c76d4bAF531d87191dAe9859854b1e");
  });
});

describe("terminal resolution UI mappings", () => {
  test("maps cancelled protections and exposes only ready cancellation", () => {
    expect(getProtectionStatusLabel("CANCELLED")).toBe("Cancelled");
    expect(getCancellationAction({ canCancel: true } as any)).toBe("CANCEL");
    expect(canCancelProtection({ canCancel: false } as any)).toBe(false);
  });

  test("shows the contract settlement symbols", () => {
    expect(MARKETS.WTI.binanceSymbol).toBe("CLUSDT");
    expect(MARKETS.WTI.gateSymbol).toBe("CL_USDT");
    expect(MARKETS.BRENT.binanceSymbol).toBe("BZUSDT");
    expect(MARKETS.BRENT.gateSymbol).toBe("BZ_USDT");
    expect(MARKETS.NATGAS.binanceSymbol).toBe("NATGASUSDT");
    expect(MARKETS.NATGAS.gateSymbol).toBe("NG_USDT");
  });
});

describe("purchase liquidity UI mapping", () => {
  test("does not enable purchase when the contract quote reports insufficient liquidity", () => {
    expect(canPurchaseFromQuote({ enoughLiquidity: false })).toBe(false);
    expect(canPurchaseFromQuote({ enoughLiquidity: true })).toBe(true);
    expect(canPurchaseFromQuote(null)).toBe(false);
  });
});

describe("financial transaction finality", () => {
  test("waits for finality only for payout and refund writes", () => {
    expect(requiresFinality("claim_payout")).toBe(true);
    expect(requiresFinality("cancel_unresolved_protection")).toBe(true);
    expect(requiresFinality("settle_protection")).toBe(false);
    expect(requiresFinality("purchase_protection")).toBe(false);
  });

  test("pending claim/refund records survive reload and stay account-scoped", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    let value = null;
    const storage = {
      getItem: () => value,
      setItem: (_key: string, next: string) => { value = next; },
      removeItem: () => { value = null; },
    };
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    const pending = { txHash: "0xclaim", action: "CLAIM", protectionId: "7", account: "0x0000000000000000000000000000000000000001", chainId: 4221 } as const;
    rememberPendingFinancialTransaction(pending);
    expect(getPendingFinancialTransactions(pending.account)).toEqual([pending]);
    expect(getPendingFinancialTransactions("0x0000000000000000000000000000000000000002")).toEqual([]);
    clearPendingFinancialTransaction(pending.txHash);
    expect(getPendingFinancialTransactions(pending.account)).toEqual([]);
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete (globalThis as any).localStorage;
  });

  test("failed financial finality stays separate from completed wording", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    let value = null;
    const storage = {
      getItem: () => value,
      setItem: (_key: string, next: string) => { value = next; },
      removeItem: () => { value = null; },
    };
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    const pending = { txHash: "0xfailed", action: "REFUND", protectionId: "8", account: "0x0000000000000000000000000000000000000001", chainId: 4221, status: "FAILED" as const };
    rememberPendingFinancialTransaction(pending);
    expect(getPendingFinancialTransactions(pending.account)[0]?.status).toBe("FAILED");
    clearPendingFinancialTransaction(pending.txHash);
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete (globalThis as any).localStorage;
  });

  test("lifecycle badges stay conservative without finalized receipt proof", () => {
    const claimed = renderToStaticMarkup(createElement(StateBadge, { state: "CLAIMED" }));
    const cancelled = renderToStaticMarkup(createElement(StateBadge, { state: "CANCELLED" }));
    expect(claimed).toContain("Claim accepted");
    expect(claimed).not.toContain("Paid");
    expect(cancelled).toContain("Cancelled");
    expect(cancelled).not.toContain("Premium refunded");
  });

  test("pending, unavailable, and finalized financial wording is explicit", () => {
    expect(getFinancialTransferLabel("CLAIM", "PENDING")).toBe("Payout awaiting finality");
    expect(getFinancialTransferLabel("REFUND", "PENDING")).toBe("Refund awaiting finality");
    expect(getFinancialTransferLabel("CLAIM", "UNAVAILABLE")).toBe("Transfer status unavailable");
    expect(getFinancialTransferLabel("REFUND", "UNAVAILABLE")).toBe("Transfer status unavailable");
    expect(getFinancialTransferLabel("CLAIM", "FINALIZED")).toBe("Paid");
    expect(getFinancialTransferLabel("REFUND", "FINALIZED")).toBe("Premium refunded");
    expect(renderToStaticMarkup(createElement(StateBadge, { state: "CLAIMED", financialFinality: "PENDING" }))).not.toContain("Paid");
    expect(renderToStaticMarkup(createElement(StateBadge, { state: "CANCELLED", financialFinality: "FINALIZED" }))).toContain("Premium refunded");
  });

  test("multiple financial records remain isolated by protection", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    let value = null;
    const storage = {
      getItem: () => value,
      setItem: (_key: string, next: string) => { value = next; },
      removeItem: () => { value = null; },
    };
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    const account = "0x0000000000000000000000000000000000000001";
    rememberPendingFinancialTransaction({ txHash: "0xa", action: "CLAIM", protectionId: "10", account, chainId: 4221, status: "PENDING" });
    rememberPendingFinancialTransaction({ txHash: "0xb", action: "REFUND", protectionId: "11", account, chainId: 4221, status: "UNAVAILABLE" });
    expect(getPendingFinancialTransactions(account).map((item) => item.protectionId)).toEqual(["10", "11"]);
    clearPendingFinancialTransaction("0xa");
    expect(getPendingFinancialTransactions(account).map((item) => item.protectionId)).toEqual(["11"]);
    clearPendingFinancialTransaction("0xb");
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete (globalThis as any).localStorage;
  });
});
