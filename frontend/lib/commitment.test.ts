import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPendingReveals, savePendingReveal } from "./commitment";

afterEach(() => { vi.unstubAllGlobals(); });

describe("pending reveal persistence", () => {
  it("keeps sealed evidence available across wallet changes", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    };
    vi.stubGlobal("window", { localStorage: storage } as unknown as Window);
    const pending = { caseId: "cx-test", commitment: "0xcommit", evidenceUrl: "https://example.com", claimedFact: "A sealed fact", salt: "salt", createdAt: new Date().toISOString() };
    savePendingReveal(pending);
    expect(loadPendingReveals()).toEqual([pending]);
    expect(loadPendingReveals()[0].salt).toBe("salt");
    expect(loadPendingReveals()[0].caseId).toBe("cx-test");
  });
});
