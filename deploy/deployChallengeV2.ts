import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DecodedDeployData, GenLayerClient, TransactionHash } from "genlayer-js/types";
import { TransactionStatus } from "genlayer-js/types";
import { isFinalizedSuccessfulReceipt } from "../scripts/receiptSafety.js";

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
  if (process.env.CRUX_DEPLOY_V2_ONLY !== "1") {
    console.log("Skipping Challenge V2 deployment. Set CRUX_DEPLOY_V2_ONLY=1 for the isolated V2 deployment workflow.");
    return { skipped: true };
  }
  const chainId = Number((client as any)?.chain?.id);
  if (chainId !== 61999) throw new Error(`Refusing V2 deployment: expected Studionet 61999, got ${chainId}`);
  const configuredRpc = String((client as any)?.transport?.url || "").replace(/\/$/, "");
  if (configuredRpc !== "https://studio.genlayer.com/api") {
    throw new Error(`Refusing V2 deployment: expected https://studio.genlayer.com/api, got ${configuredRpc || "an unknown RPC endpoint"}`);
  }
  console.log("Crux Challenge V2 deployment target: Studionet 61999");

  const manifestPath = path.resolve(process.cwd(), "deployments/challenge-v2-studionet.json");
  if (existsSync(manifestPath)) {
    throw new Error(`Refusing to redeploy Challenge V2 because ${manifestPath} already exists. Inspect its saved transaction hashes and receipts first.`);
  }
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  const contracts: Record<string, unknown> = {};
  const partialManifest = (stage: string,
                           pendingTransaction?: { file: string; txHash: string; sourceSha256?: string }) => {
    writeFileSync(manifestPath, JSON.stringify({
      product: "Crux Challenge V2", network: "studionet", chainId: 61999,
      rpc: "https://studio.genlayer.com/api", status: stage, deployedAt: new Date().toISOString(),
      contracts, ...(pendingTransaction ? { pendingTransaction } : {}),
    }, null, 2) + "\n");
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

  const registry = await deployAndRecord("registry", "contracts/crux_challenge_registry.py", ["", "", ""]);
  const verifier = await deployAndRecord("verifier", "contracts/challenge_evidence_verifier.py", [registry.address]);
  const judge = await deployAndRecord("judge", "contracts/challenge_closure_judge.py", [registry.address]);
  const challengeAdjudicator = await deployAndRecord("challengeAdjudicator", "contracts/challenge_adjudicator.py", [registry.address]);
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
