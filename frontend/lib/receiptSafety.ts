type ReceiptLike = Record<string, unknown>;

function asReceiptList(candidate: unknown): ReceiptLike[] {
  if (Array.isArray(candidate)) return candidate.filter((value): value is ReceiptLike => typeof value === "object" && value !== null);
  return typeof candidate === "object" && candidate !== null ? [candidate as ReceiptLike] : [];
}

/** Finality is insufficient: require successful GenVM execution and coherent consensus evidence. */
export function isFinalizedSuccessfulReceipt(receipt: unknown): boolean {
  if (typeof receipt !== "object" || receipt === null) return false;

  const value = receipt as ReceiptLike;
  const statusSignals: boolean[] = [];
  const statusName = value.statusName ?? value.status_name;
  if (statusName !== undefined && statusName !== null) statusSignals.push(statusName === "FINALIZED");
  if (value.status !== undefined && value.status !== null) {
    statusSignals.push(value.status === "FINALIZED" || Number(value.status) === 7);
  }
  if (statusSignals.length === 0 || statusSignals.some((signal) => !signal)) return false;

  const executionSignals: boolean[] = [];
  const executionName = value.txExecutionResultName ?? value.tx_execution_result_name;
  if (executionName !== undefined && executionName !== null) executionSignals.push(executionName === "FINISHED_WITH_RETURN");
  const executionCode = value.txExecutionResult ?? value.tx_execution_result;
  if (executionCode !== undefined && executionCode !== null) executionSignals.push(Number(executionCode) === 1);
  if (executionSignals.some((signal) => !signal)) return false;

  const consensus = value.consensus_data ?? value.consensusData;
  if (typeof consensus === "object" && consensus !== null) {
    const data = consensus as ReceiptLike;
    const numericResult = value.result === undefined || value.result === null ? undefined : Number(value.result);
    const numericResultName = numericResult === 1 ? "AGREE" : numericResult === 6 ? "MAJORITY_AGREE" : undefined;
    const resultName = value.resultName ?? value.result_name ?? numericResultName;
    if ((resultName !== "AGREE" && resultName !== "MAJORITY_AGREE")
      || (numericResult !== undefined && numericResultName !== resultName)) return false;

    const leaders = asReceiptList(data.leader_receipt ?? data.leaderReceipt);
    const validators = asReceiptList(data.validators);
    const votes = typeof data.votes === "object" && data.votes !== null
      ? Object.values(data.votes as Record<string, unknown>).map((vote) => String(vote).toLowerCase()) : [];
    const agreeVotes = votes.filter((vote) => vote === "agree").length;
    const leaderRecords = leaders.filter((leader) => leader.mode === "leader"
      || (leader.mode === undefined && leader.vote === undefined));
    if (leaderRecords.length === 0 || validators.length === 0 || votes.length === 0) return false;
    if (resultName === "MAJORITY_AGREE" && agreeVotes <= votes.length / 2) return false;
    if (resultName === "AGREE" && agreeVotes !== votes.length) return false;
    if (!leaderRecords.every((leader) => leader.execution_result === "SUCCESS")) return false;

    return validators.every((validator) => {
      if (validator.execution_result === "SUCCESS") return true;
      if (validator.execution_result !== "ERROR" || String(validator.vote).toLowerCase() !== "idle") return false;
      const genvmResult = typeof validator.genvm_result === "object" && validator.genvm_result !== null
        ? validator.genvm_result as ReceiptLike : {};
      const rawError = typeof genvmResult.raw_error === "object" && genvmResult.raw_error !== null
        ? genvmResult.raw_error as ReceiptLike : {};
      const causes = Array.isArray(rawError.causes) ? rawError.causes : [];
      return rawError.fatal === false && causes.includes("VALIDATOR_QUORUM_REACHED");
    });
  }

  return executionSignals.length > 0;
}
