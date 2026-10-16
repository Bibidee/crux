import { describe, expect, it } from "vitest";
import { requireSuccessfulExecution } from "./transactionReceipt";

const successfulReceipt = {
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

describe("GenLayer transaction confirmation", () => {
  it("accepts only finalized successful consensus execution", () => {
    expect(requireSuccessfulExecution(successfulReceipt, "0xabc")).toBe(successfulReceipt);
  });

  it("does not turn finality with a failed execution into a success", () => {
    const failed = {
      ...successfulReceipt,
      result: 4,
      result_name: "MAJORITY_DISAGREE",
      consensus_data: {
        ...successfulReceipt.consensus_data,
        leader_receipt: [{ execution_result: "ERROR" }],
      },
    };

    expect(() => requireSuccessfulExecution(failed, "0xfailed"))
      .toThrow("did not produce a finalized successful GenVM execution");
  });

  it("rejects receipts that have not reached finality", () => {
    expect(() => requireSuccessfulExecution({
      ...successfulReceipt,
      status: 5,
      status_name: "ACCEPTED",
    }, "0xpending")).toThrow("did not produce a finalized successful GenVM execution");
  });
});
