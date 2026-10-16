import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DecodedDeployData, GenLayerClient, TransactionHash } from "genlayer-js/types";
import { TransactionStatus } from "genlayer-js/types";
import { assertManifestWriteAllowed, assertNoAmbiguousResume, assertStudionetTarget, deploymentRunMode } from "../scripts/deploymentSafety.js";
import { getConfiguredRpc, isFinalizedSuccessfulReceipt } from "../scripts/receiptSafety.js";

async function deploy(client: GenLayerClient<any>, file: string, args: unknown[] = [],
                      onSubmitted?: (hash: string, sourceSha256: string) => void) {
  const source = readFileSync(path.resolve(process.cwd(), file));
  const sourceSha256 = createHash("sha256").update(source).digest("hex");
  const code = new Uint8Array(source);
  const hash = await client.deployContract({ code, args } as any);
  onSubmitted?.(String(hash), sourceSha256);
  console.log(`Submitted ${file}: ${String(hash)}`);
  const receipt: any = await client.waitForTransactionReceipt({
    hash: hash as TransactionHash,
    status: TransactionStatus.FINALIZED,
    retries: 240,
    interval: 5000,
  } as any);
  if (!isFinalizedSuccessfulReceipt(receipt)) {
    throw new Error(`Deployment did not finalize with a successful execution for ${file}: ${JSON.stringify(receipt)}`);
  }
  const address = (receipt?.txDataDecoded as DecodedDeployData | undefined)?.contractAddress
    || receipt?.data?.contract_address || receipt?.contract_address || receipt?.recipient;
  if (!address) throw new Error(`No contract address returned for ${file}`);
  return { address: String(address), hash: String(hash), txHash: String(hash),
    sourceFile: file, sourceSha256 };
}

export default async function main(client: GenLayerClient<any>) {
  const runMode = deploymentRunMode(process.env, "v2");
  if (runMode === "skip") {
    console.log("Skipping Challenge V2 deployment. Set CRUX_DEPLOY_V2_ONLY=1 and CRUX_DEPLOY_V2_AUTHORIZED=YES for an explicitly approved legacy V2 deployment.");
    return { skipped: true };
  }
  if (process.env.CRUX_DEPLOY_V2_LEGACY_ACK !== "YES") {
    throw new Error("Refusing superseded Challenge V2 deployment: set CRUX_DEPLOY_V2_LEGACY_ACK=YES only after explicitly accepting the historical V2 release boundary; use V2.2 for new deployments.");
  }
  const requestedSourceCommit = process.env.CRUX_DEPLOY_V2_SOURCE_COMMIT;
  if (!requestedSourceCommit || !/^[0-9a-fA-F]{40}$/.test(requestedSourceCommit)) {
    throw new Error("Refusing superseded Challenge V2 deployment: CRUX_DEPLOY_V2_SOURCE_COMMIT must be the exact approved 40-character source commit.");
  }
  const chainId = Number((client as any)?.chain?.id);
  const configuredRpc = getConfiguredRpc(client);
  assertStudionetTarget({ chainId, rpc: configuredRpc }, "Challenge V2");
  console.log("Crux Challenge V2 deployment target: Studionet 61999");

  const manifestPath = path.resolve(process.cwd(), "deployments/challenge-v2-studionet.json");
  const deploymentPlan = [
    { key: "registry", file: "contracts/crux_challenge_registry.py" },
    { key: "verifier", file: "contracts/challenge_evidence_verifier.py" },
    { key: "judge", file: "contracts/challenge_closure_judge.py" },
    { key: "challengeAdjudicator", file: "contracts/challenge_adjudicator.py" },
  ] as const;
  assertManifestWriteAllowed(manifestPath, process.env, "v2");
  const savedManifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, any>
    : undefined;
  if (savedManifest?.deploymentSourceCommit
    && savedManifest.deploymentSourceCommit.toLowerCase() !== requestedSourceCommit.toLowerCase()) {
    throw new Error(`Refusing superseded Challenge V2 deployment: requested source ${requestedSourceCommit} does not match the historical manifest source ${savedManifest.deploymentSourceCommit}.`);
  }
  let resumeCompletedKeys: string[] = [];
  let resumePendingKey: string | undefined;
  if (savedManifest) {
    const pending = savedManifest.pendingTransaction;
    if (savedManifest.product !== "Crux Challenge V2"
      || savedManifest.network !== "studionet"
      || savedManifest.chainId !== 61999
      || savedManifest.rpc !== "https://studio.genlayer.com/api") {
      throw new Error(`Refusing to continue from an unrecognized or later V2 deployment stage in ${manifestPath}. Inspect saved receipts before any further write.`);
    }

    assertNoAmbiguousResume(savedManifest.status, pending);
    const submittedIndex = deploymentPlan.findIndex(({ key }) => savedManifest.status === `${key.toUpperCase()}_SUBMITTED`);
    const finalizedIndex = deploymentPlan.findIndex(({ key }) => savedManifest.status === `${key.toUpperCase()}_FINALIZED`);
    if (submittedIndex >= 0) {
      resumeCompletedKeys = deploymentPlan.slice(0, submittedIndex).map(({ key }) => key);
      resumePendingKey = deploymentPlan[submittedIndex].key;
      const expectedPending = deploymentPlan[submittedIndex];
      if (pending?.file !== expectedPending.file
        || typeof pending?.txHash !== "string"
        || !/^0x[0-9a-fA-F]{64}$/.test(pending.txHash)
        || typeof pending?.sourceSha256 !== "string") {
        throw new Error(`Refusing to resume: ${savedManifest.status} does not contain the expected submitted transaction.`);
      }
      const localPendingSourceSha256 = createHash("sha256")
        .update(readFileSync(path.resolve(process.cwd(), pending.file))).digest("hex");
      if (pending.sourceSha256 !== localPendingSourceSha256) {
        throw new Error(`Refusing to resume: submitted ${resumePendingKey} source hash does not match the current local source.`);
      }
    } else if (finalizedIndex >= 0) {
      resumeCompletedKeys = deploymentPlan.slice(0, finalizedIndex + 1).map(({ key }) => key);
      if (pending !== undefined) {
        throw new Error(`Refusing to resume: ${savedManifest.status} unexpectedly contains a pending transaction.`);
      }
    } else {
      throw new Error(`Refusing to continue from an ambiguous V2 deployment stage in ${manifestPath}. Inspect saved receipts before any further write.`);
    }

    const actualCompletedKeys = Object.keys(savedManifest.contracts ?? {}).sort();
    if (actualCompletedKeys.join(",") !== [...resumeCompletedKeys].sort().join(",")) {
      throw new Error(`Refusing to resume: saved ${savedManifest.status} contract records do not match the completed deployment stages.`);
    }
    for (const key of resumeCompletedKeys) {
      const contract = savedManifest.contracts[key];
      const expected = deploymentPlan.find((item) => item.key === key)!;
      if (contract?.sourceFile !== expected.file
        || typeof contract?.address !== "string"
        || typeof contract?.sourceSha256 !== "string"
        || typeof contract?.txHash !== "string"
        || contract.hash !== contract.txHash
        || !/^0x[0-9a-fA-F]{64}$/.test(contract.txHash)) {
        throw new Error(`Refusing to resume: saved ${key} record is incomplete or inconsistent.`);
      }
      const localSourceSha256 = createHash("sha256")
        .update(readFileSync(path.resolve(process.cwd(), expected.file))).digest("hex");
      if (contract.sourceSha256 !== localSourceSha256) {
        throw new Error(`Refusing to resume: saved ${key} source hash does not match the current local source.`);
      }
    }
  } else {
    mkdirSync(path.dirname(manifestPath), { recursive: true });
  }
  const contracts: Record<string, unknown> = { ...(savedManifest?.contracts ?? {}) };
  const partialManifest = (stage: string,
                           pendingTransaction?: { file: string; txHash: string; sourceSha256?: string }) => {
    writeFileSync(manifestPath, JSON.stringify({
      product: "Crux Challenge V2", network: "studionet", chainId: 61999,
      rpc: "https://studio.genlayer.com/api", status: stage,
      deployedAt: savedManifest?.deployedAt ?? new Date().toISOString(),
      contracts, ...(pendingTransaction ? { pendingTransaction } : {}),
    }, null, 2) + "\n");
  };
  const verifyDeploymentReceipt = async (txHash: string, sourceFile: string, sourceSha256: string,
                                         expectedAddress?: string) => {
    const receipt: any = await client.waitForTransactionReceipt({
      hash: txHash as TransactionHash,
      status: TransactionStatus.FINALIZED,
      retries: 240,
      interval: 5000,
    } as any);
    if (!isFinalizedSuccessfulReceipt(receipt)) {
      throw new Error(`Refusing to continue: saved ${sourceFile} transaction is not a finalized successful GenLayer receipt: ${JSON.stringify(receipt)}`);
    }
    const address = (receipt?.txDataDecoded as DecodedDeployData | undefined)?.contractAddress
      || receipt?.data?.contract_address || receipt?.contract_address || receipt?.recipient;
    if (!address || expectedAddress && String(address).toLowerCase() !== expectedAddress.toLowerCase()) {
      throw new Error(`Refusing to continue: finalized ${sourceFile} receipt has a missing or unexpected contract address.`);
    }
    const receiptSender = String(receipt?.from_address ?? receipt?.sender ?? "").toLowerCase();
    const account = (client as any)?.account;
    const activeAccount = String(typeof account === "string" ? account : account?.address ?? "").toLowerCase();
    if (!receiptSender || !activeAccount || receiptSender !== activeAccount) {
      throw new Error(`Refusing to continue: ${sourceFile} receipt sender does not match the currently unlocked deployment account.`);
    }
    const deployedSource = await (client as any).getContractCode(String(address));
    if (typeof deployedSource !== "string"
      || createHash("sha256").update(deployedSource).digest("hex") !== sourceSha256) {
      throw new Error(`Refusing to continue: deployed ${sourceFile} source does not match its recorded submission hash.`);
    }
    return {
      address: String(address), hash: txHash, txHash, sourceFile, sourceSha256,
    };
  };
  const deployAndRecord = async (key: string, file: string, args: unknown[] = []) => {
    partialManifest(`${key.toUpperCase()}_DEPLOYING`);
    const result = await deploy(client, file, args, (txHash, sourceSha256) => partialManifest(
      `${key.toUpperCase()}_SUBMITTED`, { file, txHash, sourceSha256 },
    ));
    contracts[key] = result;
    partialManifest(`${key.toUpperCase()}_FINALIZED`);
    return result;
  };

  if (savedManifest) {
    for (const key of resumeCompletedKeys) {
      const saved = savedManifest.contracts[key];
      contracts[key] = await verifyDeploymentReceipt(saved.txHash, saved.sourceFile,
        saved.sourceSha256, saved.address);
    }
    if (resumePendingKey) {
      const pending = savedManifest.pendingTransaction;
      contracts[resumePendingKey] = await verifyDeploymentReceipt(pending.txHash,
        pending.file, pending.sourceSha256);
      partialManifest(`${resumePendingKey.toUpperCase()}_FINALIZED`);
      console.log(`Verified and resumed finalized ${resumePendingKey} from ${pending.txHash}; no duplicate deployment submitted.`);
    } else {
      partialManifest(`${resumeCompletedKeys.at(-1)!.toUpperCase()}_FINALIZED`);
      console.log(`Verified saved finalized deployment stages: ${resumeCompletedKeys.join(", ")}.`);
    }
  }
  const registry = (contracts.registry as Awaited<ReturnType<typeof deploy>> | undefined)
    ?? await deployAndRecord("registry", "contracts/crux_challenge_registry.py", ["", "", ""]);
  const verifier = (contracts.verifier as Awaited<ReturnType<typeof deploy>> | undefined)
    ?? await deployAndRecord("verifier", "contracts/challenge_evidence_verifier.py", [registry.address]);
  const judge = (contracts.judge as Awaited<ReturnType<typeof deploy>> | undefined)
    ?? await deployAndRecord("judge", "contracts/challenge_closure_judge.py", [registry.address]);
  const challengeAdjudicator = (contracts.challengeAdjudicator as Awaited<ReturnType<typeof deploy>> | undefined)
    ?? await deployAndRecord("challengeAdjudicator", "contracts/challenge_adjudicator.py", [registry.address]);
  partialManifest("CONFIGURATION_SUBMITTING");
  const configureHash = await (client as any).writeContract({
    address: registry.address,
    functionName: "configure_components",
    args: [verifier.address, judge.address, challengeAdjudicator.address],
    value: 0n,
  });
  partialManifest("CONFIGURATION_SUBMITTED", { file: "configure_components", txHash: String(configureHash) });
  const configureReceipt: any = await client.waitForTransactionReceipt({
    hash: configureHash as TransactionHash,
    status: TransactionStatus.FINALIZED,
    retries: 240,
    interval: 5000,
  } as any);
  if (!isFinalizedSuccessfulReceipt(configureReceipt)) {
    throw new Error(`V2 component binding did not finalize with a successful execution: ${JSON.stringify(configureReceipt)}`);
  }

  const manifest = {
    product: "Crux Challenge V2",
    network: "studionet",
    chainId: 61999,
    rpc: "https://studio.genlayer.com/api",
    status: "DEPLOYED_PENDING_VERIFICATION",
    explorer: "https://explorer-studio.genlayer.com",
    deployedAt: new Date().toISOString(),
    contracts: { registry, verifier, judge, challengeAdjudicator,
      configureHash: String(configureHash), configureTxHash: String(configureHash) },
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Wrote ${manifestPath} for independent readback verification; V1 deployment files and frontend environment were not touched.`);
  return manifest;
}
