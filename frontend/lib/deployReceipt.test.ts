import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isFinalizedSuccessfulReceipt } from "../../scripts/receiptSafety";

describe("V2 deployment receipt safety", () => {
  it("keeps helper modules out of GenLayer CLI's auto-executed deploy folder", () => {
    const deployDirectory = fileURLToPath(new URL("../../deploy/", import.meta.url));
    const scripts = readdirSync(deployDirectory)
      .filter((file) => file.endsWith(".ts") || file.endsWith(".js"))
      .sort();

    expect(scripts).toEqual(["deployChallengeV2.ts", "deployCrux.ts"]);
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

  it("rejects contradictory status signals and accepts numeric success fields", () => {
    expect(isFinalizedSuccessfulReceipt({
      statusName: "PENDING",
      status: 7,
      txExecutionResult: 1,
    })).toBe(false);
    expect(isFinalizedSuccessfulReceipt({ status: "7", txExecutionResult: "1" })).toBe(true);
  });
});
