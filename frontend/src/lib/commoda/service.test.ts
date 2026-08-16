// @ts-nocheck — executed by Bun's test runner, not the frontend TypeScript build.
import { describe, expect, test } from "bun:test";
import { canCancelProtection, getCancellationAction, getProtectionStatusLabel, resolveLatestOwnerProtectionId } from "./service";
import { MARKETS } from "./markets";

describe("owner-index purchase ID resolution", () => {
  test("uses the actual global ID at the final owner index", () => {
    expect(resolveLatestOwnerProtectionId([0n, 2n])).toBe("2");
    expect(resolveLatestOwnerProtectionId([1n])).toBe("1");
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
