import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assertChallengeV2_1Manifest, CHALLENGE_V2_1_PLAN, challengeV2_1RunMode } from "../../scripts/challengeV2_1Safety.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, "deployments/challenge-v2-1-studionet.json"), "utf8"));
const sourceHashes = Object.fromEntries(CHALLENGE_V2_1_PLAN.map(({ key, file }) => [
  key,
  createHash("sha256").update(readFileSync(path.join(root, file))).digest("hex"),
]));

describe("V2.1 deployment safety", () => {
  it("skips automatically loaded entrypoints unless the version-specific flag is set", () => {
    expect(challengeV2_1RunMode({})).toBe("skip");
    expect(() => challengeV2_1RunMode({ CRUX_DEPLOY_V2_1_ONLY: "1" })).toThrow(/explicit CRUX_DEPLOY_V2_1_AUTHORIZED/);
  });

  it("requires a separate authorization and exact source commit before deployment", () => {
    expect(() => challengeV2_1RunMode({
      CRUX_DEPLOY_V2_1_ONLY: "1", CRUX_DEPLOY_V2_1_AUTHORIZED: "YES",
    })).toThrow(/exact 40-character commit SHA/);
    expect(challengeV2_1RunMode({
      CRUX_DEPLOY_V2_1_ONLY: "1", CRUX_DEPLOY_V2_1_AUTHORIZED: "YES",
      CRUX_DEPLOY_V2_1_SOURCE_COMMIT: "a".repeat(40),
    })).toBe("run");
  });

  it("uses an unspent Studionet-only manifest with exact reviewed source hashes", () => {
    expect(() => assertChallengeV2_1Manifest(manifest, sourceHashes)).not.toThrow();
    expect(manifest.status).toBe("NOT_DEPLOYED");
    expect(manifest.contracts).toEqual({});
    expect(manifest.transactions).toEqual({});
    expect(manifest.chainId).toBe(61999);
    expect(manifest.rpc).toBe("https://studio.genlayer.com/api");
  });

  it("rejects a changed source, wrong network, unknown stage, or a false empty-history claim", () => {
    expect(() => assertChallengeV2_1Manifest(manifest, { ...sourceHashes, registry: "0".repeat(64) }))
      .toThrow(/source hash differs/);
    expect(() => assertChallengeV2_1Manifest({ ...manifest, chainId: 61997 }, sourceHashes))
      .toThrow(/wrong release or network/);
    expect(() => assertChallengeV2_1Manifest({ ...manifest, status: "READY" }, sourceHashes))
      .toThrow(/unknown manifest stage/);
    expect(() => assertChallengeV2_1Manifest({ ...manifest, contracts: { registry: {} } }, sourceHashes))
      .toThrow(/NOT_DEPLOYED manifest already contains transaction history/);
  });
});
