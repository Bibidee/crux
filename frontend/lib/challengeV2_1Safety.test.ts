import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assertChallengeV2_1Manifest, canonicalSourceSha256, CHALLENGE_V2_1_PLAN, challengeV2_1RunMode } from "../../scripts/challengeV2_1Safety.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, "deployments/challenge-v2-1-studionet.json"), "utf8"));
const sourceHashes = Object.fromEntries(CHALLENGE_V2_1_PLAN.map(({ key, file }) => [
  key,
  canonicalSourceSha256(readFileSync(path.join(root, file))),
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

  it("accepts the independently verified Studionet manifest with exact reviewed source hashes", () => {
    expect(() => assertChallengeV2_1Manifest(manifest, sourceHashes)).not.toThrow();
    expect(manifest.status).toBe("READY_CONTRACT_LAYER");
    expect(Object.keys(manifest.contracts).sort()).toEqual(["challengeAdjudicator", "judge", "registry", "verifier"]);
    expect(manifest.transactions).toHaveProperty("configureComponents");
    expect(manifest.chainId).toBe(61999);
    expect(manifest.rpc).toBe("https://studio.genlayer.com/api");
  });

  it("keeps reviewed source hashes stable across checkout line endings", () => {
    const source = "alpha\r\nbeta\r\n";
    expect(canonicalSourceSha256(source)).toBe(canonicalSourceSha256(source.replace(/\r\n/g, "\n")));
  });

  it("rejects a changed source, wrong network, unknown stage, or a false empty-history claim", () => {
    expect(() => assertChallengeV2_1Manifest(manifest, { ...sourceHashes, registry: "0".repeat(64) }))
      .toThrow(/source hash differs/);
    expect(() => assertChallengeV2_1Manifest({ ...manifest, chainId: 61997 }, sourceHashes))
      .toThrow(/wrong release or network/);
    expect(() => assertChallengeV2_1Manifest({ ...manifest, status: "READY" }, sourceHashes))
      .toThrow(/unknown manifest stage/);
    const unspent = { ...manifest, status: "NOT_DEPLOYED", contracts: {}, transactions: {} };
    expect(() => assertChallengeV2_1Manifest({ ...unspent, contracts: { registry: {} } }, sourceHashes))
      .toThrow(/NOT_DEPLOYED manifest already contains transaction history/);
  });
});
