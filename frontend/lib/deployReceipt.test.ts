import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getConfiguredRpc, isFinalizedSuccessfulReceipt } from "../../scripts/receiptSafety.js";

describe("V2 deployment receipt safety", () => {
  it("keeps helper modules out of GenLayer CLI's auto-executed deploy folder", () => {
    const deployDirectory = fileURLToPath(new URL("../../deploy/", import.meta.url));
    const scripts = readdirSync(deployDirectory)
      .filter((file) => file.endsWith(".ts") || file.endsWith(".js"))
      .sort();

    expect(scripts).toEqual(["deployChallengeV2.ts", "deployChallengeV2_1.ts", "deployCrux.ts"]);
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
    expect(readFileSync(v1Path, "utf8")).toContain("process.env.CRUX_DEPLOY_V2_1_ONLY === \"1\"");
    expect(readFileSync(v2Path, "utf8")).toContain("process.env.CRUX_DEPLOY_V2_1_ONLY === \"1\"");
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
