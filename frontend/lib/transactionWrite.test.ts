import { describe, expect, it } from "vitest";
import { submitWriteOnce } from "./rpcBudget";

describe("state-changing RPC writes", () => {
  it("does not retry an ambiguous broadcast failure", async () => {
    let calls = 0;
    await expect(submitWriteOnce(async () => {
      calls += 1;
      throw new Error("fetch failed after the wallet broadcast");
    })).rejects.toThrow(/status is unknown/);
    expect(calls).toBe(1);
  });

  it("does not retry a rejected wallet request", async () => {
    let calls = 0;
    await expect(submitWriteOnce(async () => {
      calls += 1;
      throw Object.assign(new Error("User rejected the request"), { code: 4001 });
    })).rejects.toThrow(/User rejected/);
    expect(calls).toBe(1);
  });

  it("captures a successful hash through the one-shot path", async () => {
    let calls = 0;
    await expect(submitWriteOnce(async () => {
      calls += 1;
      return "0xabc";
    })).resolves.toBe("0xabc");
    expect(calls).toBe(1);
  });
});
