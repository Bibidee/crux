import { createHash } from "node:crypto";

export const CHALLENGE_V2_1_PLAN = Object.freeze([
  { key: "registry", file: "contracts/crux_challenge_registry.py" },
  { key: "verifier", file: "contracts/challenge_evidence_verifier.py" },
  { key: "judge", file: "contracts/challenge_closure_judge.py" },
  { key: "challengeAdjudicator", file: "contracts/challenge_adjudicator.py" },
]);

export function canonicalSourceSha256(contents) {
  const source = (typeof contents === "string"
    ? contents
    : Buffer.from(contents).toString("utf8"))
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  return createHash("sha256").update(source, "utf8").digest("hex");
}

export function challengeV2_1RunMode(env) {
  if (env.CRUX_DEPLOY_V2_1_ONLY !== "1") return "skip";
  if (env.CRUX_DEPLOY_V2_1_AUTHORIZED !== "YES") {
    throw new Error("V2.1 deployment is gated: require explicit CRUX_DEPLOY_V2_1_AUTHORIZED=YES after user approval.");
  }
  if (!/^[0-9a-f]{40}$/i.test(env.CRUX_DEPLOY_V2_1_SOURCE_COMMIT || "")) {
    throw new Error("V2.1 deployment is gated: set CRUX_DEPLOY_V2_1_SOURCE_COMMIT to the approved exact 40-character commit SHA.");
  }
  return "run";
}

export function assertChallengeV2_1Manifest(manifest, sourceHashes) {
  if (manifest?.product !== "Crux Challenge V2.1"
    || manifest?.network !== "studionet"
    || manifest?.chainId !== 61999
    || manifest?.rpc !== "https://studio.genlayer.com/api") {
    throw new Error("Refusing V2.1 deployment from a manifest with the wrong release or network identity.");
  }
  const knownStatuses = new Set([
    "NOT_DEPLOYED", "REGISTRY_DEPLOYING", "REGISTRY_SUBMITTED", "REGISTRY_FINALIZED",
    "VERIFIER_DEPLOYING", "VERIFIER_SUBMITTED", "VERIFIER_FINALIZED",
    "JUDGE_DEPLOYING", "JUDGE_SUBMITTED", "JUDGE_FINALIZED",
    "CHALLENGEADJUDICATOR_DEPLOYING", "CHALLENGEADJUDICATOR_SUBMITTED", "CHALLENGEADJUDICATOR_FINALIZED",
    "CONFIGURATION_SUBMITTING", "CONFIGURATION_SUBMITTED", "CONFIGURATION_FINALIZED",
    "DEPLOYED_PENDING_INDEPENDENT_VERIFICATION", "READY_CONTRACT_LAYER",
  ]);
  if (!knownStatuses.has(manifest.status)) {
    throw new Error(`Refusing V2.1 deployment from unknown manifest stage ${String(manifest.status)}.`);
  }
  for (const { key, file } of CHALLENGE_V2_1_PLAN) {
    if (manifest.sourceHashes?.[key] !== sourceHashes[key]) {
      throw new Error(`Refusing V2.1 deployment: ${file} source hash differs from its reviewed manifest.`);
    }
  }
  const contractKeys = Object.keys(manifest.contracts || {});
  if (contractKeys.some((key) => !CHALLENGE_V2_1_PLAN.some((step) => step.key === key))) {
    throw new Error("Refusing V2.1 deployment: manifest contains an unknown contract record.");
  }
  const transactionKeys = Object.keys(manifest.transactions || {});
  if (transactionKeys.some((key) => key !== "configureComponents")) {
    throw new Error("Refusing V2.1 deployment: manifest contains an unknown setup transaction.");
  }
  if (manifest.status === "NOT_DEPLOYED" && manifest.pendingTransaction) {
    throw new Error("Refusing V2.1 deployment: NOT_DEPLOYED manifest already contains pending transaction history.");
  }
  if (manifest.status === "NOT_DEPLOYED" && (contractKeys.length || transactionKeys.length)) {
    throw new Error("Refusing V2.1 deployment: NOT_DEPLOYED manifest already contains transaction history.");
  }
  const statusStages = {
    NOT_DEPLOYED: { completed: 0 },
    REGISTRY_DEPLOYING: { completed: 0, current: "registry", phase: "deploying" },
    REGISTRY_SUBMITTED: { completed: 0, current: "registry", phase: "submitted" },
    REGISTRY_FINALIZED: { completed: 1 },
    VERIFIER_DEPLOYING: { completed: 1, current: "verifier", phase: "deploying" },
    VERIFIER_SUBMITTED: { completed: 1, current: "verifier", phase: "submitted" },
    VERIFIER_FINALIZED: { completed: 2 },
    JUDGE_DEPLOYING: { completed: 2, current: "judge", phase: "deploying" },
    JUDGE_SUBMITTED: { completed: 2, current: "judge", phase: "submitted" },
    JUDGE_FINALIZED: { completed: 3 },
    CHALLENGEADJUDICATOR_DEPLOYING: { completed: 3, current: "challengeAdjudicator", phase: "deploying" },
    CHALLENGEADJUDICATOR_SUBMITTED: { completed: 3, current: "challengeAdjudicator", phase: "submitted" },
    CHALLENGEADJUDICATOR_FINALIZED: { completed: 4 },
    CONFIGURATION_SUBMITTING: { completed: 4, current: "configureComponents", phase: "deploying" },
    CONFIGURATION_SUBMITTED: { completed: 4, current: "configureComponents", phase: "submitted" },
    CONFIGURATION_FINALIZED: { completed: 4, configured: true },
    DEPLOYED_PENDING_INDEPENDENT_VERIFICATION: { completed: 4, configured: true },
    READY_CONTRACT_LAYER: { completed: 4, configured: true },
  };
  const stage = statusStages[manifest.status];
  const expectedContractKeys = CHALLENGE_V2_1_PLAN.slice(0, stage.completed).map(({ key }) => key).sort();
  if (contractKeys.sort().join(",") !== expectedContractKeys.join(",")) {
    throw new Error("Refusing V2.1 deployment: saved contract records do not match the sequential deployment stage.");
  }
  const expectedTransactionKeys = stage.configured ? ["configureComponents"] : [];
  if (transactionKeys.sort().join(",") !== expectedTransactionKeys.join(",")) {
    throw new Error("Refusing V2.1 deployment: saved setup transactions do not match the deployment stage.");
  }
  if (stage.phase === "submitted") {
    if (manifest.pendingTransaction?.step !== stage.current) {
      throw new Error("Refusing V2.1 deployment: submitted stage has no matching saved transaction hash.");
    }
  } else if (stage.phase === "deploying") {
    if (manifest.pendingTransaction) {
      throw new Error("Refusing V2.1 deployment: deploying stage unexpectedly contains a pending transaction.");
    }
  } else if (manifest.pendingTransaction) {
    throw new Error("Refusing V2.1 deployment: finalized stage unexpectedly contains a pending transaction.");
  }
  if (stage.configured && !/^0x[0-9a-fA-F]{64}$/.test(manifest.transactions.configureComponents?.txHash || "")) {
    throw new Error("Refusing V2.1 deployment: finalized configuration lacks its transaction hash.");
  }
}
