import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertManifestWriteAllowed,
  assertNoAmbiguousResume,
  assertFrontendEnvWriteAllowed,
  assertStudionetTarget,
  deploymentRunMode,
} from "../../scripts/deploymentSafety.js";
import { getConfiguredRpc, isFinalizedSuccessfulReceipt } from "../../scripts/receiptSafety.js";

describe("V2 deployment receipt safety", () => {
  it("does not let an ordinary genlayer deploy invocation write any release", () => {
    expect(deploymentRunMode({}, "v1")).toBe("skip");
    expect(deploymentRunMode({}, "v2")).toBe("skip");
    expect(deploymentRunMode({ CRUX_DEPLOY_V2_2_ONLY: "1", CRUX_DEPLOY_V2_2_AUTHORIZED: "YES" }, "v1")).toBe("skip");
    expect(deploymentRunMode({ CRUX_DEPLOY_V2_2_ONLY: "1", CRUX_DEPLOY_V2_2_AUTHORIZED: "YES" }, "v2")).toBe("skip");
  });

  it("requires matching version-specific authorization", () => {
    expect(() => deploymentRunMode({ CRUX_DEPLOY_V1_ONLY: "1" }, "v1")).toThrow("CRUX_DEPLOY_V1_AUTHORIZED=YES");
    expect(deploymentRunMode({ CRUX_DEPLOY_V1_ONLY: "1", CRUX_DEPLOY_V1_AUTHORIZED: "YES" }, "v1")).toBe("run");
    expect(() => deploymentRunMode({ CRUX_DEPLOY_V2_ONLY: "1" }, "v2")).toThrow("CRUX_DEPLOY_V2_AUTHORIZED=YES");
    expect(deploymentRunMode({ CRUX_DEPLOY_V2_ONLY: "1", CRUX_DEPLOY_V2_AUTHORIZED: "YES" }, "v2")).toBe("run");
  });

  it("refuses a wrong chain or RPC before a release write", () => {
    expect(() => assertStudionetTarget({ chainId: 61997, rpc: "https://studio.genlayer.com/api" })).toThrow("61999");
    expect(() => assertStudionetTarget({ chainId: 61999, rpc: "https://wrong.example/api" })).toThrow("studio.genlayer.com/api");
    expect(() => assertStudionetTarget({ chainId: 61999, rpc: "https://studio.genlayer.com/api" })).not.toThrow();
  });

  it("does not overwrite a historical manifest by default", () => {
    const manifestPath = fileURLToPath(new URL("../../deployments/challenge-v2-studionet.json", import.meta.url));
    expect(() => assertManifestWriteAllowed(manifestPath, {}, "v2")).toThrow("already exists");
    expect(() => assertManifestWriteAllowed(manifestPath, {
      CRUX_DEPLOY_V2_ALLOW_MANIFEST_OVERWRITE: "YES",
    }, "v2")).not.toThrow();
  });

  it("does not replace the existing V1 frontend environment by default", () => {
    const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
    expect(existsSync(envPath)).toBe(true);
    expect(() => assertFrontendEnvWriteAllowed(envPath, {})).toThrow("already exists");
    expect(() => assertFrontendEnvWriteAllowed(envPath, {
      CRUX_DEPLOY_V1_ALLOW_ENV_WRITE: "YES",
    })).not.toThrow();
  });

  it("rejects ambiguous resume stages and accepts only a recorded submitted hash", () => {
    expect(() => assertNoAmbiguousResume("REGISTRY_DEPLOYING", undefined)).toThrow("ambiguous");
    expect(() => assertNoAmbiguousResume("REGISTRY_SUBMITTED", undefined)).toThrow("valid submitted transaction hash");
    expect(() => assertNoAmbiguousResume("REGISTRY_SUBMITTED", {
      txHash: `0x${"a".repeat(64)}`,
    })).not.toThrow();
  });

  it("keeps the legacy V1 and superseded V2 entrypoints explicitly gated", () => {
    const v1Path = fileURLToPath(new URL("../../deploy/deployCrux.ts", import.meta.url));
    const v2Path = fileURLToPath(new URL("../../deploy/deployChallengeV2.ts", import.meta.url));
    const v21Path = fileURLToPath(new URL("../../deploy/deployChallengeV2_1.ts", import.meta.url));
    const v22Path = fileURLToPath(new URL("../../deploy/deployChallengeV2_2.ts", import.meta.url));
    expect(readFileSync(v1Path, "utf8")).toContain("CRUX_DEPLOY_V1_AUTHORIZED");
    expect(readFileSync(v1Path, "utf8")).toContain("assertManifestWriteAllowed");
    expect(readFileSync(v1Path, "utf8")).toContain("assertFrontendEnvWriteAllowed");
    expect(readFileSync(fileURLToPath(new URL("../../scripts/deploymentSafety.js", import.meta.url)), "utf8"))
      .toContain("ALLOW_MANIFEST_OVERWRITE");
    expect(readFileSync(fileURLToPath(new URL("../../scripts/deploymentSafety.js", import.meta.url)), "utf8"))
      .toContain("CRUX_DEPLOY_V1_ALLOW_ENV_WRITE");
    expect(readFileSync(v2Path, "utf8")).toContain("CRUX_DEPLOY_V2_AUTHORIZED");
    expect(readFileSync(v2Path, "utf8")).toContain("CRUX_DEPLOY_V2_LEGACY_ACK");
    expect(readFileSync(v2Path, "utf8")).toContain("CRUX_DEPLOY_V2_SOURCE_COMMIT");
    expect(readFileSync(v21Path, "utf8")).toContain("challengeV2_1RunMode");
    expect(readFileSync(fileURLToPath(new URL("../../scripts/challengeV2_1Safety.js", import.meta.url)), "utf8"))
      .toContain("CRUX_DEPLOY_V2_1_AUTHORIZED");
    expect(readFileSync(v22Path, "utf8")).toContain("CRUX_DEPLOY_V2_2_AUTHORIZED");
    expect(readFileSync(v22Path, "utf8")).toContain("CRUX_DEPLOY_V2_2_SOURCE_COMMIT");
  });

  it("keeps historical deployment records readable without activating them", () => {
    const historical = JSON.parse(readFileSync(
      fileURLToPath(new URL("../../deployments/challenge-v2-studionet.json", import.meta.url)),
      "utf8",
    ));
    expect(historical.product).toBe("Crux Challenge V2");
    expect(historical.chainId).toBe(61999);
    expect(historical.contracts.registry.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("keeps helper modules out of GenLayer CLI's auto-executed deploy folder", () => {
    const deployDirectory = fileURLToPath(new URL("../../deploy/", import.meta.url));
    const scripts = readdirSync(deployDirectory)
      .filter((file) => file.endsWith(".ts") || file.endsWith(".js"))
      .sort();

    expect(scripts).toEqual(["deployChallengeV2.ts", "deployChallengeV2_1.ts", "deployChallengeV2_2.ts", "deployCrux.ts"]);
  });

  it("keeps the JavaScript receipt helper available outside the CLI auto-entrypoint directory", () => {
    const helperPath = fileURLToPath(new URL("../../scripts/receiptSafety.js", import.meta.url));
    const entrypointPath = fileURLToPath(new URL("../../deploy/deployChallengeV2.ts", import.meta.url));

    expect(existsSync(helperPath)).toBe(true);
    expect(readFileSync(entrypointPath, "utf8")).toContain('../scripts/receiptSafety.js');
  });

  it("makes the versioned V2.1 entrypoint exclusive from the existing V1 and V2 scripts", () => {
    const v1Path = fileURLToPath(new URL("../../deploy/deployCrux.ts", import.meta.url));
    const v2Path = fileURLToPath(new URL("../../deploy/deployChallengeV2.ts", import.meta.url));
    const v21Path = fileURLToPath(new URL("../../deploy/deployChallengeV2_1.ts", import.meta.url));
    const safetyPath = fileURLToPath(new URL("../../scripts/challengeV2_1Safety.js", import.meta.url));
    expect(readFileSync(v1Path, "utf8")).toContain("deploymentRunMode(process.env, \"v1\")");
    expect(readFileSync(v2Path, "utf8")).toContain("deploymentRunMode(process.env, \"v2\")");
    expect(readFileSync(safetyPath, "utf8")).toContain("CRUX_DEPLOY_V2_1_AUTHORIZED");
    expect(readFileSync(v21Path, "utf8")).toContain("challenge-v2-1-studionet.json");
  });

  it("resolves the RPC from GenLayer CLI's effective chain configuration", () => {
    expect(getConfiguredRpc({
      chain: { rpcUrls: { default: { http: ["https://studio.genlayer.com/api"] } } },
    })).toBe("https://studio.genlayer.com/api");
    expect(getConfiguredRpc({
      chain: { rpcUrls: { default: { http: ["https://studio.genlayer.com/api/"] } } },
    })).toBe("https://studio.genlayer.com/api");
    expect(getConfiguredRpc({
      transport: { url: "https://wrong.example/api" },
      chain: { rpcUrls: { default: { http: ["https://studio.genlayer.com/api"] } } },
    })).toBe("https://wrong.example/api");
  });
  it("requires finalized status and a successful contract execution", () => {
    expect(isFinalizedSuccessfulReceipt({
      statusName: "FINALIZED",
      txExecutionResultName: "FINISHED_WITH_RETURN",
    })).toBe(true);
  });

  it("rejects an accepted but not finalized transaction", () => {
    expect(isFinalizedSuccessfulReceipt({
      statusName: "ACCEPTED",
      txExecutionResultName: "FINISHED_WITH_RETURN",
    })).toBe(false);
  });

  it("rejects a finalized transaction whose execution failed", () => {
    expect(isFinalizedSuccessfulReceipt({
      status: 7,
      txExecutionResultName: "FINISHED_WITH_ERROR",
    })).toBe(false);
  });

  it("rejects a finalized receipt with no execution outcome", () => {
    expect(isFinalizedSuccessfulReceipt({ statusName: "FINALIZED" })).toBe(false);
  });

  it("accepts a finalized Studionet majority receipt only with successful executions", () => {
    const receipt = {
      status: 7,
      status_name: "FINALIZED",
      result: 6,
      result_name: "MAJORITY_AGREE",
      consensus_data: {
        votes: { a: "agree", b: "agree", c: "agree", d: "idle", e: "idle" },
        leader_receipt: [
          { mode: "leader", execution_result: "SUCCESS" },
          { mode: "validator", vote: "idle", execution_result: "ERROR", genvm_result: { raw_error: { fatal: false, causes: ["VALIDATOR_QUORUM_REACHED"] } } },
        ],
        validators: [
          { execution_result: "SUCCESS", vote: "agree" },
          { execution_result: "SUCCESS", vote: "agree" },
          { execution_result: "ERROR", vote: "idle", genvm_result: { raw_error: { fatal: false, causes: ["VALIDATOR_QUORUM_REACHED"] } } },
          { execution_result: "SUCCESS", vote: "agree" },
          { execution_result: "ERROR", vote: "idle", genvm_result: { raw_error: { fatal: false, causes: ["VALIDATOR_QUORUM_REACHED"] } } },
        ],
      },
    };
    expect(isFinalizedSuccessfulReceipt(receipt)).toBe(true);
    expect(isFinalizedSuccessfulReceipt({
      ...receipt,
      consensus_data: { ...receipt.consensus_data, leader_receipt: [{ execution_result: "ERROR" }] },
    })).toBe(false);
    expect(isFinalizedSuccessfulReceipt({ ...receipt, result_name: "MAJORITY_DISAGREE" })).toBe(false);
    expect(isFinalizedSuccessfulReceipt({ ...receipt, status_name: "ACCEPTED" })).toBe(false);
    expect(isFinalizedSuccessfulReceipt({
      ...receipt,
      consensus_data: {
        ...receipt.consensus_data,
        validators: receipt.consensus_data.validators.map((item, index) => index === 0
          ? { ...item, execution_result: "ERROR" }
          : item),
      },
    })).toBe(false);
    expect(isFinalizedSuccessfulReceipt({
      ...receipt,
      consensus_data: {
        ...receipt.consensus_data,
        votes: { a: "agree", b: "agree", c: "idle", d: "idle", e: "idle" },
      },
    })).toBe(false);
  });

  it("accepts a finalized write receipt when stable Studionet omits the top-level execution result", () => {
    const receipt = {
      status: 7,
      status_name: "FINALIZED",
      result: 6,
      result_name: "MAJORITY_AGREE",
      consensus_data: {
        votes: { a: "agree", b: "agree", c: "agree", d: "idle", e: "idle" },
        leader_receipt: [{ execution_result: "SUCCESS" }],
        validators: [
          { execution_result: "SUCCESS", vote: "agree" },
          { execution_result: "SUCCESS", vote: "agree" },
          { execution_result: "SUCCESS", vote: "agree" },
          { execution_result: "ERROR", vote: "idle", genvm_result: { raw_error: { fatal: false, causes: ["VALIDATOR_QUORUM_REACHED"] } } },
          { execution_result: "ERROR", vote: "idle", genvm_result: { raw_error: { fatal: false, causes: ["VALIDATOR_QUORUM_REACHED"] } } },
        ],
      },
    };

    expect(isFinalizedSuccessfulReceipt(receipt)).toBe(true);
  });

  it("rejects contradictory status signals and accepts numeric success fields", () => {
    expect(isFinalizedSuccessfulReceipt({
      statusName: "PENDING",
      status: 7,
      txExecutionResult: 1,
    })).toBe(false);
    expect(isFinalizedSuccessfulReceipt({ status: "7", txExecutionResult: "1" })).toBe(true);
  });
});
