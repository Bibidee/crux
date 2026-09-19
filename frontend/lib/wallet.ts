"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from "react";

export const CHAIN_ID = 61999;
export const CHAIN_HEX = `0x${CHAIN_ID.toString(16)}`;
export const RPC_URL = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
export const EXPLORER_URL = process.env.NEXT_PUBLIC_GENLAYER_EXPLORER || "https://explorer-studio.genlayer.com";

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
};

declare global {
  interface Window { ethereum?: Eip1193Provider }
}

export function injectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum || null;
}

export function normalizeAccounts(result: unknown): string[] {
  return Array.isArray(result) ? result.filter((x): x is string => typeof x === "string") : [];
}

export function sameWallet(left: string | null | undefined, right: string | null | undefined): boolean {
  return !!left && !!right && left.toLowerCase() === right.toLowerCase();
}

async function accounts(request = false): Promise<string[]> {
  const provider = injectedProvider();
  if (!provider) return [];
  const method = request ? "eth_requestAccounts" : "eth_accounts";
  const result = await provider.request({ method });
  return normalizeAccounts(result);
}

export async function ensureStudionet(): Promise<void> {
  const provider = injectedProvider();
  if (!provider) throw new Error("No injected EIP-1193 wallet found");
  const current = await provider.request({ method: "eth_chainId" });
  if (typeof current === "string" && parseInt(current, 16) === CHAIN_ID) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  } catch (err: any) {
    if (err?.code !== 4902) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: CHAIN_HEX,
        chainName: "GenLayer Studionet",
        nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
        rpcUrls: [RPC_URL],
        blockExplorerUrls: [EXPLORER_URL],
      }],
    });
  }
}

export type InjectedWallet = {
  address: string | null; chainId: number | null; ready: boolean; connected: boolean; correctNetwork: boolean;
  hasProvider: boolean; connect: () => Promise<string>; disconnect: () => void; refresh: () => Promise<void>;
  switchNetwork: () => Promise<void>; isCurrent: (address: string) => boolean;
};

function useWalletState(): InjectedWallet {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const provider = injectedProvider();
    if (!provider) { setAddress(null); setChainId(null); setReady(true); return; }
    const requestGeneration = ++generation.current;
    try {
      const [xs, rawChain] = await Promise.all([accounts(false), provider.request({ method: "eth_chainId" })]);
      if (requestGeneration !== generation.current) return;
      setAddress(disconnected ? null : (xs[0] || null));
      setChainId(typeof rawChain === "string" ? parseInt(rawChain, 16) : null);
    } finally { setReady(true); }
  }, [disconnected]);

  useEffect(() => {
    refresh();
    const provider = injectedProvider();
    if (!provider?.on) return;
    const onAccounts = () => refresh();
    const onChain = () => refresh();
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    const requestGeneration = ++generation.current;
    setDisconnected(false);
    const provider = injectedProvider();
    if (!provider) throw new Error("Install or open an injected EIP-1193 wallet to continue");
    const xs = await accounts(true);
    if (requestGeneration !== generation.current) throw new Error("Wallet connection was superseded");
    if (!xs[0]) throw new Error("No wallet account was returned");
    await ensureStudionet();
    await refresh();
    return xs[0];
  }, [refresh]);

  const disconnect = useCallback(() => {
    generation.current += 1;
    setDisconnected(true);
    setAddress(null);
  }, []);

  return {
    address, chainId, ready, connected: !!address, correctNetwork: chainId === CHAIN_ID,
    hasProvider: !!injectedProvider(), connect, disconnect, refresh, switchNetwork: ensureStudionet,
    isCurrent: (candidate: string) => !disconnected && sameWallet(address, candidate),
  };
}

const WalletContext = createContext<InjectedWallet | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const wallet = useWalletState();
  return createElement(WalletContext.Provider, { value: wallet }, children);
}

export function useInjectedWallet(): InjectedWallet {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error("useInjectedWallet must be used inside WalletProvider");
  return wallet;
}
