"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant } from "genlayer-js/types";
import { injectedProvider, RPC_URL } from "./wallet";
import type { CruxCase, ProtocolStats, Submission } from "./types";

export const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "";
export const VERIFIER_ADDRESS = process.env.NEXT_PUBLIC_VERIFIER_ADDRESS || "";
export const JUDGE_ADDRESS = process.env.NEXT_PUBLIC_JUDGE_ADDRESS || "";

type WriteRequest = {
  functionName: string;
  args?: unknown[];
  value?: bigint;
};

function assertRegistry(): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{40}$/.test(REGISTRY_ADDRESS)) {
    throw new Error("Crux Registry is not configured. Set NEXT_PUBLIC_REGISTRY_ADDRESS.");
  }
  return REGISTRY_ADDRESS as `0x${string}`;
}

function normalize(value: any): any {
  if (value instanceof Map) return Object.fromEntries(Array.from(value.entries()).map(([k, v]) => [String(k), normalize(v)]));
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) out[key] = normalize(val);
    return out;
  }
  if (typeof value === "bigint") return value.toString();
  return value;
}

export function readClient() {
  return createClient({ chain: studionet, endpoint: RPC_URL } as any);
}

export async function writeClient(address: string) {
  const provider = injectedProvider();
  if (!provider) throw new Error("No injected EIP-1193 wallet found");
  const client = createClient({
    chain: studionet,
    endpoint: RPC_URL,
    account: address as `0x${string}`,
    provider,
  } as any);
  await client.connect("studionet");
  return client;
}

async function read<T>(functionName: string, args: unknown[] = [], latest = false): Promise<T> {
  const raw = await readClient().readContract({
    address: assertRegistry(), functionName, args,
    transactionHashVariant: latest ? TransactionHashVariant.LATEST_NONFINAL : TransactionHashVariant.LATEST_FINAL,
  } as any);
  return normalize(raw) as T;
}

export async function listCases(offset = 0, count = 24): Promise<{ items: CruxCase[]; total: string }> {
  return read("list_cases", [BigInt(offset), BigInt(count)]);
}
export async function getCase(id: string, latest = false): Promise<CruxCase> { return read("get_case", [id], latest); }
export async function listSubmissions(id: string, latest = false): Promise<Submission[]> { return read("list_submissions", [id], latest); }
export async function getSubmission(id: string, latest = false): Promise<Submission> { return read("get_submission", [id], latest); }
export async function getStats(): Promise<ProtocolStats> { return read("get_stats"); }
export async function getCredit(address: string, latest = false): Promise<string> { return read("get_credit", [address], latest); }
export async function getSubmissionForCommitment(commitment: string, latest = false): Promise<string> {
  return read("get_submission_for_commitment", [commitment], latest);
}
export async function findLatestCaseBySponsor(address: string, latest = false): Promise<string> {
  return read("find_latest_case_by_sponsor", [address], latest);
}

export async function submitRegistryWrite(address: string, request: WriteRequest): Promise<string> {
  const client = await writeClient(address);
  const call = {
    address: assertRegistry(),
    functionName: request.functionName,
    args: request.args || [],
    ...(request.value !== undefined ? { value: request.value } : {}),
  } as any;
  // genlayer-js 1.1.x estimates gas internally; there is no fee-profile API in
  // the stable Studionet client. Always pass the required calldata value.
  const hash = await client.writeContract({ ...call, value: request.value ?? 0n });
  return String(hash);
}

export async function waitForDecision(hash: string): Promise<unknown> {
  const client = readClient();
  return client.waitForTransactionReceipt({ hash: hash as any, status: "FINALIZED" as any, retries: 240, interval: 5000 });
}

export async function waitForFinalization(hash: string): Promise<unknown> {
  const client = readClient();
  return client.waitForTransactionReceipt({ hash: hash as any, status: "FINALIZED" as any, retries: 240, interval: 5000 });
}
