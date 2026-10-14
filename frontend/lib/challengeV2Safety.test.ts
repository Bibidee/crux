import { describe, expect, it } from "vitest";
import { isChallengeV2WriteEnabled, requireChallengeV2WriteEnabled } from "./challengeV2Safety";

describe("Challenge V2 write safety", () => {
  it("defaults writes off unless the exact explicit enable value is configured", () => {
    expect(isChallengeV2WriteEnabled(undefined)).toBe(false);
    expect(isChallengeV2WriteEnabled("false")).toBe(false);
    expect(isChallengeV2WriteEnabled("1")).toBe(false);
    expect(isChallengeV2WriteEnabled("TRUE")).toBe(false);
    expect(isChallengeV2WriteEnabled("true")).toBe(true);
  });

  it("blocks V2 writes with a clear message while preserving the V1 app", () => {
    expect(() => requireChallengeV2WriteEnabled(false)).toThrow(/V1 remains available/);
    expect(() => requireChallengeV2WriteEnabled(true)).not.toThrow();
  });
});
