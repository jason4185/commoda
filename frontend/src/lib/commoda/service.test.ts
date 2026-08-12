// @ts-nocheck — executed by Bun's test runner, not the frontend TypeScript build.
import { describe, expect, test } from "bun:test";
import { resolveLatestOwnerProtectionId } from "./service";

describe("owner-index purchase ID resolution", () => {
  test("uses the actual global ID at the final owner index", () => {
    expect(resolveLatestOwnerProtectionId([0n, 2n])).toBe("2");
    expect(resolveLatestOwnerProtectionId([1n])).toBe("1");
  });
});
