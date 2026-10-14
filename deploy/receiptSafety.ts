type ReceiptLike = Record<string, unknown>;

/** A write is safe to build on only after protocol finality and successful execution. */
export function isFinalizedSuccessfulReceipt(receipt: unknown): boolean {
  if (typeof receipt !== "object" || receipt === null) return false;

  const value = receipt as ReceiptLike;
  const statusSignals: boolean[] = [];
  const statusName = value.statusName ?? value.status_name;
  if (statusName !== undefined && statusName !== null) {
    statusSignals.push(statusName === "FINALIZED");
  }
  if (value.status !== undefined && value.status !== null) {
    statusSignals.push(Number(value.status) === 7);
  }
  if (statusSignals.length === 0 || statusSignals.some((isFinalized) => !isFinalized)) {
    return false;
  }

  const executionSignals: boolean[] = [];
  const executionName = value.txExecutionResultName ?? value.tx_execution_result_name;
  if (executionName !== undefined && executionName !== null) {
    executionSignals.push(executionName === "FINISHED_WITH_RETURN");
  }
  const executionCode = value.txExecutionResult ?? value.tx_execution_result;
  if (executionCode !== undefined && executionCode !== null) {
    executionSignals.push(Number(executionCode) === 1);
  }
  return executionSignals.length > 0 && executionSignals.every(Boolean);
}
