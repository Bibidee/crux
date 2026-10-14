import { afterEach, describe, expect, it } from "vitest";
import { CHAIN_HEX, CHAIN_ID, createSingleFlight, ensureStudionet, normalizeAccounts, sameWallet, walletSessionIsCurrent } from "./wallet";
import type { Eip1193Provider } from "./wallet";

function installProvider(provider: Eip1193Provider): void {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { ethereum: provider } as unknown as Window });
}

afterEach(() => { Reflect.deleteProperty(globalThis, "window"); });

describe("injected wallet integration", () => {
  it("normalizes accounts without calling wallet-specific snap methods", () => {
    expect(normalizeAccounts(["0xabc", 1, null])).toEqual(["0xabc"]);
    expect(normalizeAccounts(undefined)).toEqual([]);
  });

  it("treats account changes as a new wallet and preserves no stale match", () => {
    expect(sameWallet("0xAbC", "0xabc")).toBe(true);
    expect(sameWallet("0xAbC", "0xdef")).toBe(false);
    expect(sameWallet(null, "0xabc")).toBe(false);
  });

  it("shares one pending connect request across repeated clicks", async () => {
    const flight = createSingleFlight<string>();
    let finish!: (address: string) => void;
    const request = () => new Promise<string>((resolve) => { finish = resolve; });
    const first = flight.run(request);
    const second = flight.run(request);
    expect(second).toBe(first);
    await Promise.resolve();
    finish("0xalice");
    await expect(first).resolves.toBe("0xalice");
    await expect(flight.run(async () => "0xbob")).resolves.toBe("0xbob");
  });

  it("does not let an invalidated connection clear a newer pending request", async () => {
    const flight = createSingleFlight<string>();
    let finishOld!: (address: string) => void;
    const old = flight.run(() => new Promise<string>((resolve) => { finishOld = resolve; }));
    flight.clear();
    const current = flight.run(async () => "0xbob");
    await expect(current).resolves.toBe("0xbob");
    await Promise.resolve();
    finishOld("0xalice");
    await expect(old).resolves.toBe("0xalice");
    await expect(flight.run(async () => "0xnext")).resolves.toBe("0xnext");
  });

  it("invalidates stale writes across disconnect, reconnect, account, and network changes", () => {
    let session: { address: string | null; chainId: number | null; revision: number; disconnected: boolean } = {
      address: "0xalice", chainId: CHAIN_ID, revision: 1, disconnected: false,
    };
    expect(walletSessionIsCurrent(session, "0xalice", 1)).toBe(true);
    session = { address: null, chainId: null, revision: 2, disconnected: true };
    expect(walletSessionIsCurrent(session, "0xalice", 1)).toBe(false);
    session = { address: "0xbob", chainId: CHAIN_ID, revision: 3, disconnected: false };
    expect(walletSessionIsCurrent(session, "0xalice", 1)).toBe(false);
    expect(walletSessionIsCurrent(session, "0xbob", 3)).toBe(true);
    session = { ...session, chainId: 1, revision: 4 };
    expect(walletSessionIsCurrent(session, "0xbob", 3)).toBe(false);
    session = { ...session, chainId: CHAIN_ID, revision: 5 };
    expect(walletSessionIsCurrent(session, "0xbob", 5)).toBe(true);
  });

  it("switches to Studionet through standard EIP-1193 methods", async () => {
    const calls: { method: string; params?: unknown }[] = [];
    let chainId = "0x1";
    installProvider({ request: async ({ method, params }) => {
      calls.push({ method, params });
      if (method === "eth_chainId") return chainId;
      if (method === "wallet_switchEthereumChain") { chainId = CHAIN_HEX; return null; }
      throw new Error(`unexpected ${method}`);
    } });
    await ensureStudionet();
    expect(calls.map((x) => x.method)).toEqual(["eth_chainId", "wallet_switchEthereumChain", "eth_chainId"]);
    expect(calls[1].params).toEqual([{ chainId: CHAIN_HEX }]);
    expect(CHAIN_ID).toBe(61999);
  });

  it("adds the network only when the wallet reports an unknown chain", async () => {
    const methods: string[] = [];
    let chainId = "0x1";
    installProvider({ request: async ({ method }) => {
      methods.push(method);
      if (method === "eth_chainId") return chainId;
      if (method === "wallet_switchEthereumChain") throw { code: 4902 };
      if (method === "wallet_addEthereumChain") { chainId = CHAIN_HEX; return null; }
      return null;
    } });
    await ensureStudionet();
    expect(methods).toEqual(["eth_chainId", "wallet_switchEthereumChain", "wallet_addEthereumChain", "eth_chainId"]);
  });
});
