"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant, TransactionStatus } from "genlayer-js/types";
import type { CalldataEncodable, TransactionHash } from "genlayer-js/types";
import { injectedProvider, normalizeAccounts, RPC_URL, sameWallet, CHAIN_ID } from "./wallet";
import { serializeReadCacheKey } from "./cache-key";
import { requireSuccessfulExecution } from "./transactionReceipt";
export { serializeReadCacheKey } from "./cache-key";
import type { CruxCase, ProtocolStats, Submission } from "./types";

export const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "";
export const VERIFIER_ADDRESS = process.env.NEXT_PUBLIC_VERIFIER_ADDRESS || "";
export const JUDGE_ADDRESS = process.env.NEXT_PUBLIC_JUDGE_ADDRESS || "";
export const CHALLENGE_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_CHALLENGE_REGISTRY_ADDRESS || "";

type WriteRequest = {
  functionName: string;
  args?: CalldataEncodable[];
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

function isRateLimited(error: unknown): boolean {
  const text = (error instanceof Error ? error.message : String(error)).toLowerCase();
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

function assertRegistryAddress(address: string): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("Crux Registry address is not configured or invalid.");
  }
  return address as `0x${string}`;
}

function normalize(value: unknown): unknown {
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
  return createClient({ chain: studionet, endpoint: RPC_URL });
}

export async function writeClient(address: string) {
  const provider = injectedProvider();
  if (!provider) throw new Error("No injected EIP-1193 wallet found");
  const client = createClient({
    chain: studionet,
    endpoint: RPC_URL,
    account: address as `0x${string}`,
    provider: provider as NonNullable<NonNullable<Parameters<typeof createClient>[0]>["provider"]>,
  });
  return client;
}

async function readAt<T>(registryAddress: string, functionName: string, args: CalldataEncodable[] = [], latest = false): Promise<T> {
  const key = JSON.stringify([registryAddress.toLowerCase(), serializeReadCacheKey(functionName, args, latest)]);
  const cached = readCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value as T;
  const pending = readInflight.get(key);
  if (pending) return pending as Promise<T>;
  const request = withRpcBudget(() => readClient().readContract({
    address: assertRegistryAddress(registryAddress), functionName, args,
    transactionHashVariant: latest ? TransactionHashVariant.LATEST_NONFINAL : TransactionHashVariant.LATEST_FINAL,
  })).then(normalize).then((value) => {
    readCache.set(key, { value, expires: Date.now() + (latest ? 2_000 : 8_000) });
    return value as T;
  }).finally(() => readInflight.delete(key));
  readInflight.set(key, request);
  return request;
}

async function read<T>(functionName: string, args: CalldataEncodable[] = [], latest = false): Promise<T> {
  return readAt(REGISTRY_ADDRESS, functionName, args, latest);
}

export async function readChallengeRegistry<T>(functionName: string, args: CalldataEncodable[] = [], latest = false): Promise<T> {
  if (!CHALLENGE_REGISTRY_ADDRESS) throw new Error("Crux Challenge V2 is not deployed or configured yet.");
  return readAt(CHALLENGE_REGISTRY_ADDRESS, functionName, args, latest);
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

export async function submitContractWrite(address: string, registryAddress: string, request: WriteRequest, isWalletCurrent?: () => boolean): Promise<string> {
  const client = await writeClient(address);
  const call = {
    address: assertRegistryAddress(registryAddress),
    functionName: request.functionName,
    args: request.args || [],
  };
  // genlayer-js 1.1.x estimates gas internally; there is no fee-profile API in
  // the stable Studionet client. Always pass the required calldata value.
  const hash = await withRpcBudget(async () => {
    const activeProvider = injectedProvider();
    if (!activeProvider) throw new Error("No injected EIP-1193 wallet found");
    const [currentAccounts, rawChain] = await Promise.all([
      activeProvider.request({ method: "eth_accounts" }),
      activeProvider.request({ method: "eth_chainId" }),
    ]);
    if (!normalizeAccounts(currentAccounts).some((current) => sameWallet(current, address))) {
      throw new Error("The connected wallet changed before signing; review the account and retry.");
    }
    if (typeof rawChain !== "string" || Number.parseInt(rawChain, 16) !== CHAIN_ID) {
      throw new Error("Switch the connected wallet back to GenLayer Studionet (61999) before signing.");
    }
    if (isWalletCurrent && !isWalletCurrent()) {
      throw new Error("Wallet connection changed before signing; review the active account and retry.");
    }
    return client.writeContract({
      ...call,
      args: request.args || [],
      value: request.value ?? 0n,
    });
  });
  return String(hash);
}

export async function submitRegistryWrite(address: string, request: WriteRequest, isWalletCurrent?: () => boolean): Promise<string> {
  return submitContractWrite(address, REGISTRY_ADDRESS, request, isWalletCurrent);
}

export async function submitChallengeRegistryWrite(address: string, request: WriteRequest, isWalletCurrent?: () => boolean): Promise<string> {
  if (!CHALLENGE_REGISTRY_ADDRESS) throw new Error("Crux Challenge V2 is not deployed or configured yet.");
  return submitContractWrite(address, CHALLENGE_REGISTRY_ADDRESS, request, isWalletCurrent);
}

export async function waitForDecision(hash: string): Promise<unknown> {
  const client = readClient();
  const receipt = await client.waitForTransactionReceipt({ hash: hash as TransactionHash, status: TransactionStatus.FINALIZED, retries: 240, interval: 15_000 });
  return requireSuccessfulExecution(receipt, hash);
}

export async function waitForFinalization(hash: string): Promise<unknown> {
  const client = readClient();
  const receipt = await client.waitForTransactionReceipt({ hash: hash as TransactionHash, status: TransactionStatus.FINALIZED, retries: 240, interval: 15_000 });
  return requireSuccessfulExecution(receipt, hash);
}
