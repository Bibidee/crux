import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DecodedDeployData, GenLayerClient, TransactionHash } from "genlayer-js/types";
import { TransactionHashVariant, TransactionStatus } from "genlayer-js/types";
import { getConfiguredRpc, isFinalizedSuccessfulReceipt } from "../scripts/receiptSafety.js";
import { assertChallengeV2_1Manifest, CHALLENGE_V2_1_PLAN, challengeV2_1RunMode } from "../scripts/challengeV2_1Safety.js";

const RPC = "https://studio.genlayer.com/api";
const MANIFEST_PATH = "deployments/challenge-v2-1-studionet.json";
const MANIFEST_PRODUCT = "Crux Challenge V2.1";

function sha256(contents: string | Uint8Array): string {
  return createHash("sha256").update(contents).digest("hex");
}

function normalize(value: unknown): any {
  if (value instanceof Map) return Object.fromEntries(Array.from(value.entries()).map(([key, item]) => [String(key), normalize(item)]));
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  }
  if (typeof value === "bigint") return value.toString();
  return value;
}

function activeAccount(client: GenLayerClient<any>): string {
  const account = (client as any)?.account;
  return String(typeof account === "string" ? account : account?.address ?? "").toLowerCase();
}

function persist(manifest: Record<string, any>): void {
  writeFileSync(path.resolve(process.cwd(), MANIFEST_PATH), JSON.stringify(manifest, null, 2) + "\n");
}

async function waitSuccessful(client: GenLayerClient<any>, txHash: string, stage: string): Promise<any> {
  const receipt: any = await client.waitForTransactionReceipt({
    hash: txHash as TransactionHash,
    status: TransactionStatus.FINALIZED,
    retries: 240,
    interval: 5000,
  } as any);
  if (!isFinalizedSuccessfulReceipt(receipt)) {
    throw new Error(`${stage} did not finalize with successful GenVM execution; hash retained in ${MANIFEST_PATH}: ${JSON.stringify(receipt)}`);
  }
  const sender = String(receipt?.from_address ?? receipt?.sender ?? "").toLowerCase();
  if (!sender || sender !== activeAccount(client)) {
    throw new Error(`${stage} receipt sender does not match the active deployment account; hash retained in ${MANIFEST_PATH}.`);
  }
  return receipt;
}

async function verifyDeployReceipt(client: GenLayerClient<any>, txHash: string, sourceFile: string,
                                   sourceSha256: string, expectedAddress?: string) {
  const receipt = await waitSuccessful(client, txHash, sourceFile);
  const address = (receipt?.txDataDecoded as DecodedDeployData | undefined)?.contractAddress
    || receipt?.data?.contract_address || receipt?.contract_address || receipt?.recipient;
  if (!address || expectedAddress && String(address).toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error(`${sourceFile} successful receipt does not contain its expected contract address.`);
  }
  const deployedSource = await (client as any).getContractCode(String(address));
  if (typeof deployedSource !== "string" || sha256(deployedSource) !== sourceSha256) {
    throw new Error(`${sourceFile} deployed source does not match its reviewed SHA-256.`);
  }
  return { address: String(address), txHash, sourceFile, sourceSha256 };
}

async function deployOne(client: GenLayerClient<any>, manifest: Record<string, any>, key: string,
                         file: string, args: unknown[]) {
  const source = readFileSync(path.resolve(process.cwd(), file));
  const sourceSha256 = sha256(source);
  const saved = manifest.contracts[key];
  if (saved) {
    if (saved.sourceFile !== file || saved.sourceSha256 !== sourceSha256
      || !/^0x[0-9a-fA-F]{64}$/.test(saved.txHash || "") || saved.hash !== saved.txHash) {
      throw new Error(`Refusing to resume: the saved ${key} deployment record is incomplete or source has changed.`);
    }
    await verifyDeployReceipt(client, saved.txHash, file, sourceSha256, saved.address);
    return saved;
  }

  const pending = manifest.pendingTransaction;
  if (pending) {
    if (pending.step !== key || pending.sourceFile !== file || pending.sourceSha256 !== sourceSha256
      || !/^0x[0-9a-fA-F]{64}$/.test(pending.txHash || "")) {
      throw new Error(`Refusing to resume: pending transaction is not the expected ${key} deployment.`);
    }
    const verified = await verifyDeployReceipt(client, pending.txHash, file, sourceSha256);
    manifest.contracts[key] = { ...verified, hash: verified.txHash };
    delete manifest.pendingTransaction;
    manifest.status = `${key.toUpperCase()}_FINALIZED`;
    persist(manifest);
    console.log(`Resumed finalized ${key} from ${verified.txHash}; no duplicate transaction submitted.`);
    return manifest.contracts[key];
  }

  if (manifest.status === `${key.toUpperCase()}_DEPLOYING`) {
    throw new Error(`Refusing blind redeployment: ${key} was marked DEPLOYING without a saved hash. Inspect Studionet before continuing.`);
  }
  manifest.status = `${key.toUpperCase()}_DEPLOYING`;
  persist(manifest);
  const txHash = String(await client.deployContract({ code: new Uint8Array(source), args } as any));
  manifest.pendingTransaction = { step: key, sourceFile: file, txHash, sourceSha256 };
  manifest.status = `${key.toUpperCase()}_SUBMITTED`;
  persist(manifest);
  console.log(`Submitted V2.1 ${key}: ${txHash}`);
  const verified = await verifyDeployReceipt(client, txHash, file, sourceSha256);
  manifest.contracts[key] = { ...verified, hash: verified.txHash };
  delete manifest.pendingTransaction;
  manifest.status = `${key.toUpperCase()}_FINALIZED`;
  persist(manifest);
  return manifest.contracts[key];
}

async function configureComponents(client: GenLayerClient<any>, manifest: Record<string, any>) {
  const saved = manifest.transactions.configureComponents;
  if (saved) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(saved.txHash || "")) {
      throw new Error("Refusing to resume: component configuration transaction hash is invalid.");
    }
    await waitSuccessful(client, saved.txHash, "V2.1 configure_components");
    return saved.txHash;
  }
  if (manifest.pendingTransaction) {
    const pending = manifest.pendingTransaction;
    if (pending.step !== "configureComponents" || !/^0x[0-9a-fA-F]{64}$/.test(pending.txHash || "")) {
      throw new Error("Refusing to resume: unexpected pending configuration transaction.");
    }
    await waitSuccessful(client, pending.txHash, "V2.1 configure_components");
    manifest.transactions.configureComponents = { txHash: pending.txHash };
    delete manifest.pendingTransaction;
    manifest.status = "CONFIGURATION_FINALIZED";
    persist(manifest);
    return pending.txHash;
  }
  if (manifest.status === "CONFIGURATION_SUBMITTING") {
    throw new Error("Refusing blind configuration retry: inspect Studionet because the saved manifest has no configuration hash.");
  }

  manifest.status = "CONFIGURATION_SUBMITTING";
  persist(manifest);
  const registry = manifest.contracts.registry.address;
  const verifier = manifest.contracts.verifier.address;
  const judge = manifest.contracts.judge.address;
  const challengeAdjudicator = manifest.contracts.challengeAdjudicator.address;
  const txHash = String(await (client as any).writeContract({
    address: registry,
    functionName: "configure_components",
    args: [verifier, judge, challengeAdjudicator],
    value: 0n,
  }));
  manifest.pendingTransaction = { step: "configureComponents", txHash };
  manifest.status = "CONFIGURATION_SUBMITTED";
  persist(manifest);
  console.log(`Submitted V2.1 configure_components: ${txHash}`);
  await waitSuccessful(client, txHash, "V2.1 configure_components");
  manifest.transactions.configureComponents = { txHash };
  delete manifest.pendingTransaction;
  manifest.status = "CONFIGURATION_FINALIZED";
  persist(manifest);
  return txHash;
}

async function verifyConfiguredRegistry(client: GenLayerClient<any>, manifest: Record<string, any>) {
  const raw = await (client as any).readContract({
    address: manifest.contracts.registry.address,
    functionName: "get_stats",
    args: [],
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });
  const stats = normalize(raw);
  const expected = {
    chain_id: "61999",
    rpc: RPC,
    verifier: manifest.contracts.verifier.address,
    judge: manifest.contracts.judge.address,
    challenge_adjudicator: manifest.contracts.challengeAdjudicator.address,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (String(stats[key]).toLowerCase() !== value.toLowerCase()) {
      throw new Error(`V2.1 Registry readback mismatch for ${key}; deployment remains pending verification.`);
    }
  }
  if (stats.components_configured !== true || stats.admin_controls !== false
    || stats.accounting_balanced !== true) {
    throw new Error("V2.1 Registry readback does not confirm configured components, disabled admin controls, and balanced accounting.");
  }
  return stats;
}

export default async function main(client: GenLayerClient<any>) {
  if (challengeV2_1RunMode(process.env) === "skip") {
    console.log("Skipping Challenge V2.1 deployment. An explicit isolated mode and separate authorization are required.");
    return { skipped: true };
  }
  if (Number((client as any)?.chain?.id) !== 61999) {
    throw new Error(`Refusing V2.1 deployment: expected Studionet 61999, got ${String((client as any)?.chain?.id)}`);
  }
  if (getConfiguredRpc(client) !== RPC) {
    throw new Error(`Refusing V2.1 deployment: expected ${RPC}, got ${getConfiguredRpc(client) || "an unknown RPC endpoint"}`);
  }
  const account = activeAccount(client);
  if (!/^0x[0-9a-f]{40}$/.test(account)) throw new Error("Refusing V2.1 deployment: CLI has no identifiable active deployment account.");
  const requestedCommit = (process.env.CRUX_DEPLOY_V2_1_SOURCE_COMMIT || "").toLowerCase();
  const currentCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim().toLowerCase();
  const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
  if (branch !== "challenge-v2" || currentCommit !== requestedCommit) {
    throw new Error(`Refusing V2.1 deployment: require challenge-v2 at approved commit ${requestedCommit}; found ${branch || "detached HEAD"} ${currentCommit}.`);
  }

  const manifestPath = path.resolve(process.cwd(), MANIFEST_PATH);
  if (!existsSync(manifestPath)) throw new Error(`Refusing V2.1 deployment: reviewed candidate manifest ${MANIFEST_PATH} is missing.`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, any>;
  manifest.contracts ??= {};
  manifest.transactions ??= {};
  const sourceHashes = Object.fromEntries(CHALLENGE_V2_1_PLAN.map(({ key, file }) => [
    key, sha256(readFileSync(path.resolve(process.cwd(), file))),
  ]));
  assertChallengeV2_1Manifest(manifest, sourceHashes);
  if (manifest.deploymentSourceCommit && manifest.deploymentSourceCommit !== requestedCommit) {
    throw new Error("Refusing V2.1 deployment: manifest belongs to a different source commit.");
  }
  manifest.deploymentSourceCommit = requestedCommit;
  manifest.deployer = account;
  persist(manifest);

  const deployed: Record<string, any> = { ...manifest.contracts };
  for (const step of CHALLENGE_V2_1_PLAN) {
    const args = step.key === "registry" ? ["", "", ""]
      : [deployed.registry.address];
    deployed[step.key] = await deployOne(client, manifest, step.key, step.file, args);
  }
  const configureTxHash = await configureComponents(client, manifest);
  const stats = await verifyConfiguredRegistry(client, manifest);
  manifest.status = "DEPLOYED_PENDING_INDEPENDENT_VERIFICATION";
  manifest.verification = {
    finalizedAndSuccessful: true,
    componentBindingsVerified: true,
    adminControls: false,
    accountingBalanced: true,
    getStatsReadback: stats,
  };
  manifest.transactions.configureComponents = { txHash: configureTxHash };
  persist(manifest);
  console.log(`V2.1 deployment transactions finalized successfully. Independent release verification remains required. Manifest: ${MANIFEST_PATH}`);
  return manifest;
}
