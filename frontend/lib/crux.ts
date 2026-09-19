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

// Studionet currently allows roughly 30 RPC requests per minute. Keep a
// client-wide budget so multiple pages/components share one polite queue
// instead of stampeding the endpoint during consensus polling.
const RPC_WINDOW_MS = 60_000;
const RPC_BUDGET = 24;
const rpcTimes: number[] = [];
const readCache = new Map<string, { expires: number; value: unknown }>();
const readInflight = new Map<string, Promise<unknown>>();

async function reserveRpc(): Promise<void> {
  while (true) {
    const now = Date.now();
    while (rpcTimes.length && now - rpcTimes[0] >= RPC_WINDOW_MS) rpcTimes.shift();
    if (rpcTimes.length < RPC_BUDGET) { rpcTimes.push(now); return; }
    await new Promise((resolve) => setTimeout(resolve, Math.max(500, RPC_WINDOW_MS - (now - rpcTimes[0]) + 50)));
  }
}

function isRateLimited(error: any): boolean {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("rate limit") || text.includes("too many requests") || text.includes("429") || text.includes("fetch failed");
}

async function withRpcBudget<T>(operation: () => Promise<T>): Promise<T> {
  let delay = 1500;
  for (let attempt = 0; ; attempt += 1) {
    await reserveRpc();
    try { return await operation(); }
    catch (error) {
      if (!isRateLimited(error) || attempt >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 12_000);
    }
  }
}

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
  const key = JSON.stringify([functionName, args, latest]);
  const cached = readCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value as T;
  const pending = readInflight.get(key);
  if (pending) return pending as Promise<T>;
  const request = withRpcBudget(() => readClient().readContract({
    address: assertRegistry(), functionName, args,
    transactionHashVariant: latest ? TransactionHashVariant.LATEST_NONFINAL : TransactionHashVariant.LATEST_FINAL,
  } as any)).then(normalize).then((value) => {
    readCache.set(key, { value, expires: Date.now() + (latest ? 2_000 : 8_000) });
    return value as T;
  }).finally(() => readInflight.delete(key));
  readInflight.set(key, request);
  return request;
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
  const hash = await withRpcBudget(() => client.writeContract({ ...call, value: request.value ?? 0n }));
  return String(hash);
}

export async function waitForDecision(hash: string): Promise<unknown> {
  const client = readClient();
  return client.waitForTransactionReceipt({ hash: hash as any, status: "FINALIZED" as any, retries: 240, interval: 15_000 });
}

export async function waitForFinalization(hash: string): Promise<unknown> {
  const client = readClient();
  return client.waitForTransactionReceipt({ hash: hash as any, status: "FINALIZED" as any, retries: 240, interval: 15_000 });
}
