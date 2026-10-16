import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DecodedDeployData, GenLayerClient, TransactionHash } from "genlayer-js/types";
import { TransactionHashVariant, TransactionStatus } from "genlayer-js/types";
import { getConfiguredRpc, isFinalizedSuccessfulReceipt } from "../scripts/receiptSafety.js";
import { canonicalSourceSha256 } from "../scripts/challengeV2_1Safety.js";

const RPC = "https://studio.genlayer.com/api";
const MANIFEST_PATH = "deployments/challenge-v2-2-studionet.json";
const PRODUCT = "Crux Challenge V2.2";
const PLAN = [
  { key: "registry", file: "contracts/crux_challenge_registry.py" },
  { key: "verifier", file: "contracts/challenge_evidence_verifier.py" },
  { key: "judge", file: "contracts/challenge_closure_judge.py" },
  { key: "challengeAdjudicator", file: "contracts/challenge_adjudicator.py" },
] as const;

function normalize(value: unknown): any {
  if (value instanceof Map) return Object.fromEntries(Array.from(value.entries()).map(([key, item]) => [String(key), normalize(item)]));
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
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

function sourceHashes(): Record<string, string> {
  return Object.fromEntries(PLAN.map(({ key, file }) => [
    key, canonicalSourceSha256(readFileSync(path.resolve(process.cwd(), file))),
  ]));
}

function assertCandidate(manifest: Record<string, any>, hashes: Record<string, string>): void {
  if (manifest.product !== PRODUCT || manifest.network !== "studionet"
    || manifest.chainId !== 61999 || manifest.rpc !== RPC) {
    throw new Error("Refusing V2.2 deployment from a manifest with the wrong release or network identity.");
  }
  for (const { key, file } of PLAN) {
    if (manifest.sourceHashes?.[key] !== hashes[key]) {
      throw new Error(`Refusing V2.2 deployment: ${file} source hash differs from the candidate manifest.`);
    }
  }
  if (!manifest.contracts || !manifest.transactions) throw new Error("V2.2 manifest is missing deployment sections.");
}

async function waitSuccessful(client: GenLayerClient<any>, txHash: string, stage: string): Promise<any> {
  const receipt: any = await client.waitForTransactionReceipt({
    hash: txHash as TransactionHash, status: TransactionStatus.FINALIZED, retries: 240, interval: 5000,
  } as any);
  if (!isFinalizedSuccessfulReceipt(receipt)) {
    throw new Error(`${stage} did not finalize successfully; inspect ${txHash} before retrying.`);
  }
  const sender = String(receipt?.from_address ?? receipt?.sender ?? "").toLowerCase();
  if (!sender || sender !== activeAccount(client)) throw new Error(`${stage} receipt sender does not match the active deployment account.`);
  return receipt;
}

async function verifyDeployReceipt(client: GenLayerClient<any>, txHash: string, sourceFile: string, sourceSha256: string,
                                   expectedAddress?: string) {
  const receipt = await waitSuccessful(client, txHash, sourceFile);
  const address = (receipt?.txDataDecoded as DecodedDeployData | undefined)?.contractAddress
    || receipt?.data?.contract_address || receipt?.contract_address || receipt?.recipient;
  if (!address || expectedAddress && String(address).toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error(`${sourceFile} successful receipt did not contain its expected contract address.`);
  }
  const deployedSource = await (client as any).getContractCode(String(address));
  if (typeof deployedSource !== "string" || canonicalSourceSha256(deployedSource) !== sourceSha256) {
    throw new Error(`${sourceFile} deployed source does not match the candidate hash.`);
  }
  return { address: String(address), txHash, sourceFile, sourceSha256, hash: txHash };
}

async function deployOne(client: GenLayerClient<any>, manifest: Record<string, any>, key: string,
                         file: string, args: unknown[], hash: string) {
  const saved = manifest.contracts[key];
  if (saved) {
    await verifyDeployReceipt(client, saved.txHash, file, hash, saved.address);
    return saved;
  }
  const pending = manifest.pendingTransaction;
  if (pending) {
    if (pending.step !== key || pending.sourceFile !== file || pending.sourceSha256 !== hash
      || !/^0x[0-9a-fA-F]{64}$/.test(pending.txHash || "")) {
      throw new Error("Refusing to resume an unexpected V2.2 deployment transaction.");
    }
    const verified = await verifyDeployReceipt(client, pending.txHash, file, hash);
    manifest.contracts[key] = verified;
    delete manifest.pendingTransaction;
    manifest.status = `${key.toUpperCase()}_FINALIZED`;
    persist(manifest);
    return verified;
  }
  manifest.status = `${key.toUpperCase()}_DEPLOYING`;
  persist(manifest);
  const txHash = String(await client.deployContract({ code: new Uint8Array(readFileSync(path.resolve(process.cwd(), file))), args } as any));
  manifest.pendingTransaction = { step: key, sourceFile: file, txHash, sourceSha256: hash };
  manifest.status = `${key.toUpperCase()}_SUBMITTED`;
  persist(manifest);
  console.log(`Submitted V2.2 ${key}: ${txHash}`);
  const verified = await verifyDeployReceipt(client, txHash, file, hash);
  manifest.contracts[key] = verified;
  delete manifest.pendingTransaction;
  manifest.status = `${key.toUpperCase()}_FINALIZED`;
  persist(manifest);
  return verified;
}

async function configureComponents(client: GenLayerClient<any>, manifest: Record<string, any>) {
  if (manifest.transactions.configureComponents?.txHash) {
    await waitSuccessful(client, manifest.transactions.configureComponents.txHash, "V2.2 configure_components");
    return manifest.transactions.configureComponents.txHash;
  }
  if (manifest.pendingTransaction) {
    if (manifest.pendingTransaction.step !== "configureComponents") throw new Error("Refusing to resume an unexpected V2.2 configuration transaction.");
    await waitSuccessful(client, manifest.pendingTransaction.txHash, "V2.2 configure_components");
    manifest.transactions.configureComponents = { txHash: manifest.pendingTransaction.txHash };
    delete manifest.pendingTransaction;
    manifest.status = "CONFIGURATION_FINALIZED";
    persist(manifest);
    return manifest.transactions.configureComponents.txHash;
  }
  manifest.status = "CONFIGURATION_SUBMITTING";
  persist(manifest);
  const txHash = String(await (client as any).writeContract({
    address: manifest.contracts.registry.address,
    functionName: "configure_components",
    args: [manifest.contracts.verifier.address, manifest.contracts.judge.address, manifest.contracts.challengeAdjudicator.address],
    value: 0n,
  }));
  manifest.pendingTransaction = { step: "configureComponents", txHash };
  manifest.status = "CONFIGURATION_SUBMITTED";
  persist(manifest);
  console.log(`Submitted V2.2 configure_components: ${txHash}`);
  await waitSuccessful(client, txHash, "V2.2 configure_components");
  manifest.transactions.configureComponents = { txHash };
  delete manifest.pendingTransaction;
  manifest.status = "CONFIGURATION_FINALIZED";
  persist(manifest);
  return txHash;
}

async function verifyConfiguredRegistry(client: GenLayerClient<any>, manifest: Record<string, any>) {
  const raw = await (client as any).readContract({
    address: manifest.contracts.registry.address,
    functionName: "get_stats", args: [], transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  });
  const stats = normalize(raw);
  const expected = {
    chain_id: "61999", rpc: RPC, verifier: manifest.contracts.verifier.address,
    judge: manifest.contracts.judge.address, challenge_adjudicator: manifest.contracts.challengeAdjudicator.address,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (String(stats[key]).toLowerCase() !== value.toLowerCase()) throw new Error(`V2.2 readback mismatch for ${key}.`);
  }
  if (stats.components_configured !== true || stats.admin_controls !== false || stats.accounting_balanced !== true) {
    throw new Error("V2.2 readback did not confirm configured components, disabled admin controls, and balanced accounting.");
  }
  return stats;
}

export default async function main(client: GenLayerClient<any>) {
  if (process.env.CRUX_DEPLOY_V2_2_ONLY !== "1") {
    console.log("Skipping Challenge V2.2 deployment. Set CRUX_DEPLOY_V2_2_ONLY=1 for the isolated V2.2 workflow.");
    return { skipped: true };
  }
  if (process.env.CRUX_DEPLOY_V2_2_AUTHORIZED !== "YES") throw new Error("V2.2 deployment requires explicit authorization.");
  if (Number((client as any)?.chain?.id) !== 61999) throw new Error(`Refusing V2.2 deployment: expected Studionet 61999, got ${String((client as any)?.chain?.id)}`);
  if (getConfiguredRpc(client) !== RPC) throw new Error(`Refusing V2.2 deployment: expected ${RPC}, got ${getConfiguredRpc(client) || "unknown RPC"}`);
  const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
  const currentCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim().toLowerCase();
  if (branch !== "challenge-v2" || currentCommit !== String(process.env.CRUX_DEPLOY_V2_2_SOURCE_COMMIT || "").toLowerCase()) {
    throw new Error(`Refusing V2.2 deployment: expected challenge-v2 at the explicitly approved commit.`);
  }
  const account = activeAccount(client);
  if (!/^0x[0-9a-f]{40}$/.test(account)) throw new Error("Refusing V2.2 deployment: no active deployment account.");
  const manifestPath = path.resolve(process.cwd(), MANIFEST_PATH);
  if (!existsSync(manifestPath)) throw new Error(`Missing ${MANIFEST_PATH}.`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, any>;
  manifest.contracts ??= {};
  manifest.transactions ??= {};
  const hashes = sourceHashes();
  assertCandidate(manifest, hashes);
  manifest.deploymentSourceCommit = currentCommit;
  manifest.deployer = account;
  persist(manifest);

  const deployed: Record<string, any> = { ...manifest.contracts };
  for (const step of PLAN) {
    const args = step.key === "registry" ? ["", "", ""] : [deployed.registry.address];
    deployed[step.key] = await deployOne(client, manifest, step.key, step.file, args, hashes[step.key]);
  }
  const configureTxHash = await configureComponents(client, manifest);
  const stats = await verifyConfiguredRegistry(client, manifest);
  manifest.status = "DEPLOYED_PENDING_INDEPENDENT_VERIFICATION";
  manifest.verification = {
    deployed: true, finalizedAndSuccessful: true, componentBindingsVerified: true,
    sourceHashesMatch: true, adminControls: false, accountingBalanced: true,
    independentReadback: false, liveVerified: false, fundedLifecycleVerified: false,
    productionPublished: false, getStatsReadback: stats,
  };
  manifest.transactions.configureComponents = { txHash: configureTxHash };
  persist(manifest);
  writeFileSync(path.resolve(process.cwd(), "frontend/.env.local"), [
    "NEXT_PUBLIC_GENLAYER_CHAIN_ID=61999",
    `NEXT_PUBLIC_GENLAYER_RPC_URL=${RPC}`,
    "NEXT_PUBLIC_GENLAYER_EXPLORER=https://explorer-studio.genlayer.com",
    `NEXT_PUBLIC_CHALLENGE_REGISTRY_ADDRESS=${manifest.contracts.registry.address}`,
    `NEXT_PUBLIC_VERIFIER_ADDRESS=${manifest.contracts.verifier.address}`,
    `NEXT_PUBLIC_JUDGE_ADDRESS=${manifest.contracts.judge.address}`,
    "NEXT_PUBLIC_CHALLENGE_V2_WRITES_ENABLED=true",
    "",
  ].join("\n"));
  console.log(`V2.2 deployment finalized on Studionet. Registry: ${manifest.contracts.registry.address}`);
  return manifest;
}
