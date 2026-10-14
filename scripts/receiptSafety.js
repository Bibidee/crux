/** @typedef {Record<string, unknown>} ReceiptLike */

/** Finality is insufficient: require successful GenVM execution and coherent consensus evidence. */
export function isFinalizedSuccessfulReceipt(receipt) {
  if (typeof receipt !== "object" || receipt === null) return false;

  /** @type {ReceiptLike} */
  const value = receipt;
  const statusSignals = [];
  const statusName = value.statusName ?? value.status_name;
  if (statusName !== undefined && statusName !== null) statusSignals.push(statusName === "FINALIZED");
  if (value.status !== undefined && value.status !== null) {
    statusSignals.push(value.status === "FINALIZED" || Number(value.status) === 7);
  }
  if (statusSignals.length === 0 || statusSignals.some((signal) => !signal)) return false;

  const executionSignals = [];
  const executionName = value.txExecutionResultName ?? value.tx_execution_result_name;
  if (executionName !== undefined && executionName !== null) {
    executionSignals.push(executionName === "FINISHED_WITH_RETURN");
  }
  const executionCode = value.txExecutionResult ?? value.tx_execution_result;
  if (executionCode !== undefined && executionCode !== null) executionSignals.push(Number(executionCode) === 1);
  if (executionSignals.some((signal) => !signal)) return false;

  const consensus = value.consensus_data ?? value.consensusData;
  if (typeof consensus === "object" && consensus !== null) {
    /** @type {ReceiptLike} */
    const data = consensus;
    const numericResult = value.result === undefined || value.result === null ? undefined : Number(value.result);
    const numericResultName = numericResult === 1 ? "AGREE" : numericResult === 6 ? "MAJORITY_AGREE" : undefined;
    const resultName = value.resultName ?? value.result_name ?? numericResultName;
    if ((resultName !== "AGREE" && resultName !== "MAJORITY_AGREE")
      || (numericResult !== undefined && numericResultName !== resultName)) return false;

    const asReceiptList = (candidate) => {
      if (Array.isArray(candidate)) return candidate;
      return typeof candidate === "object" && candidate !== null ? [candidate] : [];
    };
    const leaders = asReceiptList(data.leader_receipt ?? data.leaderReceipt);
    const validators = asReceiptList(data.validators);
    const votes = typeof data.votes === "object" && data.votes !== null
      ? Object.values(data.votes).map((vote) => String(vote).toLowerCase())
      : [];
    const agreeVotes = votes.filter((vote) => vote === "agree").length;
    if (leaders.length === 0 || validators.length === 0 || votes.length === 0) return false;
    if (resultName === "MAJORITY_AGREE" && agreeVotes <= votes.length / 2) return false;
    if (resultName === "AGREE" && agreeVotes !== votes.length) return false;
    if (!leaders.every((leader) => leader?.execution_result === "SUCCESS")) return false;

    return validators.every((validator) => {
      if (validator?.execution_result === "SUCCESS") return true;
      if (validator?.execution_result !== "ERROR" || String(validator.vote).toLowerCase() !== "idle") return false;
      const genvmResult = typeof validator.genvm_result === "object" && validator.genvm_result !== null
        ? /** @type {ReceiptLike} */ (validator.genvm_result)
        : {};
      const rawError = typeof genvmResult.raw_error === "object" && genvmResult.raw_error !== null
        ? /** @type {ReceiptLike} */ (genvmResult.raw_error)
        : {};
      const causes = Array.isArray(rawError.causes) ? rawError.causes : [];
      return rawError.fatal === false && causes.includes("VALIDATOR_QUORUM_REACHED");
    });
  }

  return executionSignals.length > 0;
}

/** Resolve the endpoint configured on GenLayer CLI's viem-compatible client. */
export function getConfiguredRpc(client) {
  if (typeof client !== "object" || client === null) return "";
  /** @type {ReceiptLike} */
  const value = client;
  const transportUrl = value.transport?.url;
  const chainRpcUrl = value.chain?.rpcUrls?.default?.http?.[0];
  const endpoint = typeof transportUrl === "string" ? transportUrl : chainRpcUrl;
  return typeof endpoint === "string" ? endpoint.replace(/\/$/, "") : "";
}
