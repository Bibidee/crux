// Studionet allows roughly 30 RPC requests per minute. Keep a shared budget
// so read polling and state-changing submissions do not stampede the endpoint.
const RPC_WINDOW_MS = 60_000;
const RPC_BUDGET = 24;
const rpcTimes: number[] = [];

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

export async function withReadRpcBudget<T>(operation: () => Promise<T>): Promise<T> {
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

function isAmbiguousWriteError(error: unknown): boolean {
  const text = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return text.includes("rate limit") || text.includes("too many requests") || text.includes("429")
    || text.includes("fetch failed") || text.includes("network") || text.includes("timeout")
    || text.includes("timed out") || text.includes("connection");
}

/** Send a state-changing transaction exactly once; never retry an ambiguous broadcast. */
export async function submitWriteOnce<T>(operation: () => Promise<T>): Promise<T> {
  await reserveRpc();
  try {
    return await operation();
  } catch (error) {
    if (isAmbiguousWriteError(error)) {
      throw new Error(
        "Transaction submission status is unknown; it may already be broadcast. Check the wallet and authoritative contract state before retrying.",
        { cause: error },
      );
    }
    throw error;
  }
}
