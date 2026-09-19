import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DecodedDeployData, GenLayerClient, TransactionHash } from "genlayer-js/types";
import { TransactionStatus } from "genlayer-js/types";

async function deploy(client: GenLayerClient<any>, file: string, args: unknown[] = []) {
  const code = new Uint8Array(readFileSync(path.resolve(process.cwd(), file)));
  const hash = await client.deployContract({ code, args } as any);
  const receipt: any = await client.waitForTransactionReceipt({
    hash: hash as TransactionHash,
    status: TransactionStatus.FINALIZED,
    retries: 240,
    interval: 5000,
  } as any);
  const statusName = receipt?.statusName ?? receipt?.status_name;
  const ok = statusName === "FINALIZED" || statusName === "ACCEPTED"
    || receipt?.status === 5 || receipt?.status === 6 || receipt?.status === 7
    || receipt?.result === 6;
  if (!ok) throw new Error(`Deployment failed for ${file}: ${JSON.stringify(receipt)}`);
  const address = (receipt?.txDataDecoded as DecodedDeployData | undefined)?.contractAddress
    || receipt?.data?.contract_address || receipt?.contract_address || receipt?.recipient;
  if (!address) throw new Error(`No contract address returned for ${file}`);
  const txHash = String(hash);
  return { address: String(address), hash: txHash, txHash };
}

export default async function main(client: GenLayerClient<any>) {
  const chainId = Number((client as any)?.chain?.id);
  if (chainId !== 61999) throw new Error(`Refusing deployment: Crux is locked to Studionet 61999, client is ${chainId}`);
  console.log("Crux deployment target: Studionet 61999 only");
  // Bootstrap order is intentional: children authenticate one fixed Registry,
  // while Registry binds those child addresses exactly once after deployment.
  const registry = await deploy(client, "contracts/crux_registry.py", ["", ""]);
  const verifier = await deploy(client, "contracts/evidence_verifier.py", [registry.address]);
  console.log("EvidenceVerifier", verifier);
  const judge = await deploy(client, "contracts/closure_judge.py", [registry.address]);
  console.log("ClosureJudge", judge);
  const configureHash = await (client as any).writeContract({
    address: registry.address,
    functionName: "configure_components",
    args: [verifier.address, judge.address],
    value: 0n,
  });
  const configureReceipt: any = await client.waitForTransactionReceipt({
    hash: configureHash as TransactionHash,
    status: TransactionStatus.FINALIZED,
    retries: 240,
    interval: 5000,
  } as any);
  const configureStatusName = configureReceipt?.statusName ?? configureReceipt?.status_name;
  const configureOk = configureStatusName === "FINALIZED" || configureStatusName === "ACCEPTED"
    || configureReceipt?.status === 5 || configureReceipt?.status === 6 || configureReceipt?.status === 7
    || configureReceipt?.result === 6;
  if (!configureOk) throw new Error(`Component binding failed: ${JSON.stringify(configureReceipt)}`);
  console.log("CruxRegistry", registry);

  const manifest = {
    product: "Crux",
    network: "studionet",
    chainId: 61999,
    rpc: "https://studio.genlayer.com/api",
    explorer: "https://explorer-studio.genlayer.com",
    deployedAt: new Date().toISOString(),
    contracts: {
      verifier,
      judge,
      registry,
      configureHash: String(configureHash),
      configureTxHash: String(configureHash),
    },
  };
  mkdirSync(path.resolve(process.cwd(), "deployments"), { recursive: true });
  writeFileSync(path.resolve(process.cwd(), "deployments/studionet.json"), JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(path.resolve(process.cwd(), "frontend/.env.local"), [
    "NEXT_PUBLIC_GENLAYER_CHAIN_ID=61999",
    "NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api",
    "NEXT_PUBLIC_GENLAYER_EXPLORER=https://explorer-studio.genlayer.com",
    `NEXT_PUBLIC_REGISTRY_ADDRESS=${registry.address}`,
    `NEXT_PUBLIC_VERIFIER_ADDRESS=${verifier.address}`,
    `NEXT_PUBLIC_JUDGE_ADDRESS=${judge.address}`,
    "",
  ].join("\n"));
  console.log("Wrote deployments/studionet.json and frontend/.env.local");
  return manifest;
}
