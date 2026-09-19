import { afterEach, describe, expect, it } from "vitest";
import { CHAIN_HEX, CHAIN_ID, ensureStudionet, normalizeAccounts, sameWallet } from "./wallet";

afterEach(() => { delete (globalThis as any).window; });

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

  it("switches to Studionet through standard EIP-1193 methods", async () => {
    const calls: { method: string; params?: unknown }[] = [];
    (globalThis as any).window = { ethereum: { request: async (args: any) => {
      calls.push(args);
      if (args.method === "eth_chainId") return "0x1";
      if (args.method === "wallet_switchEthereumChain") return null;
      throw new Error(`unexpected ${args.method}`);
    } } };
    await ensureStudionet();
    expect(calls.map((x) => x.method)).toEqual(["eth_chainId", "wallet_switchEthereumChain"]);
    expect(calls[1].params).toEqual([{ chainId: CHAIN_HEX }]);
    expect(CHAIN_ID).toBe(61999);
  });

  it("adds the network only when the wallet reports an unknown chain", async () => {
    const methods: string[] = [];
    (globalThis as any).window = { ethereum: { request: async (args: any) => {
      methods.push(args.method);
      if (args.method === "eth_chainId") return "0x1";
      if (args.method === "wallet_switchEthereumChain") throw { code: 4902 };
      return null;
    } } };
    await ensureStudionet();
    expect(methods).toEqual(["eth_chainId", "wallet_switchEthereumChain", "wallet_addEthereumChain"]);
  });
});
