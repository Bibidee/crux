"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from "react";
import { errorCode } from "./errors";

export const CHAIN_ID = 61999;
export const CHAIN_HEX = `0x${CHAIN_ID.toString(16)}`;
export const RPC_URL = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
export const EXPLORER_URL = process.env.NEXT_PUBLIC_GENLAYER_EXPLORER || "https://explorer-studio.genlayer.com";

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
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

export function walletSessionIsCurrent(
  session: { address: string | null; chainId: number | null; revision: number; disconnected: boolean },
  candidate: string,
  expectedRevision?: number,
): boolean {
  return !session.disconnected && sameWallet(session.address, candidate) && session.chainId === CHAIN_ID
    && (expectedRevision === undefined || expectedRevision === session.revision);
}

export function createSingleFlight<T>() {
  let pending: Promise<T> | null = null;
  return {
    run(operation: () => Promise<T>): Promise<T> {
      if (pending) return pending;
      const current = Promise.resolve().then(operation).finally(() => {
        if (pending === current) pending = null;
      });
      pending = current;
      return current;
    },
    clear() { pending = null; },
    getPending() { return pending; },
  };
}

function parseChainId(value: unknown): number | null {
  if (typeof value !== "string" || !/^0x[\da-f]+$/i.test(value)) return null;
  return Number.parseInt(value, 16);
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
  } catch (error: unknown) {
    if (errorCode(error) !== 4902) throw error;
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
  const verifiedChain = parseChainId(await provider.request({ method: "eth_chainId" }));
  if (verifiedChain !== CHAIN_ID) throw new Error("Wallet did not switch to GenLayer Studionet (61999)");
}

export type InjectedWallet = {
  address: string | null; chainId: number | null; ready: boolean; connecting: boolean; connected: boolean; correctNetwork: boolean; revision: number;
  hasProvider: boolean; connect: () => Promise<string>; disconnect: () => void; refresh: () => Promise<void>;
  switchNetwork: () => Promise<void>; isCurrent: (address: string, revision?: number) => boolean; getRevision: () => number;
};

function useWalletState(): InjectedWallet {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [revision, setRevision] = useState(0);
  const disconnectedRef = useRef(false);
  const addressRef = useRef<string | null>(null);
  const chainIdRef = useRef<number | null>(null);
  const revisionRef = useRef(0);
  const sessionGeneration = useRef(0);
  const refreshGeneration = useRef(0);
  const accountGeneration = useRef(0);
  const chainGeneration = useRef(0);
  const [connectFlight] = useState(() => createSingleFlight<string>());

  const bumpRevision = useCallback(() => {
    revisionRef.current += 1;
    setRevision(revisionRef.current);
  }, []);

  const refresh = useCallback(async () => {
    const requestGeneration = ++refreshGeneration.current;
    const provider = injectedProvider();
    if (!provider) {
      await Promise.resolve();
      if (requestGeneration !== refreshGeneration.current) return;
      if (addressRef.current !== null || chainIdRef.current !== null) bumpRevision();
      addressRef.current = null; chainIdRef.current = null;
      setAddress(null); setChainId(null); setReady(true); return;
    }
    try {
      const [xs, rawChain] = await Promise.all([accounts(false), provider.request({ method: "eth_chainId" })]);
      if (requestGeneration !== refreshGeneration.current) return;
      const nextAddress = disconnectedRef.current ? null : (xs[0] || null);
      const nextChainId = parseChainId(rawChain);
      if (!sameWallet(addressRef.current, nextAddress) || chainIdRef.current !== nextChainId) bumpRevision();
      addressRef.current = nextAddress; chainIdRef.current = nextChainId;
      setAddress(nextAddress);
      chainGeneration.current += 1;
      setChainId(nextChainId);
    } catch {
      if (requestGeneration === refreshGeneration.current) {
        if (addressRef.current !== null || chainIdRef.current !== null) bumpRevision();
        addressRef.current = null; chainIdRef.current = null;
        setAddress(null);
        setChainId(null);
      }
    } finally { setReady(true); }
  }, [bumpRevision]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    const provider = injectedProvider();
    if (!provider?.on) return () => { refreshGeneration.current += 1; };
    const onAccounts = (value: unknown) => {
      accountGeneration.current += 1;
      refreshGeneration.current += 1;
      const xs = normalizeAccounts(value);
      const nextAddress = disconnectedRef.current ? null : (xs[0] || null);
      if (!sameWallet(addressRef.current, nextAddress)) bumpRevision();
      addressRef.current = nextAddress;
      setAddress(nextAddress);
      const requestGeneration = ++chainGeneration.current;
      void provider.request({ method: "eth_chainId" }).then((rawChain) => {
        if (requestGeneration === chainGeneration.current) {
          const nextChainId = parseChainId(rawChain);
          if (chainIdRef.current !== nextChainId) bumpRevision();
          chainIdRef.current = nextChainId; setChainId(nextChainId);
        }
      }).catch(() => { if (requestGeneration === chainGeneration.current) { chainIdRef.current = null; setChainId(null); bumpRevision(); } });
    };
    const onChain = (value: unknown) => {
      refreshGeneration.current += 1;
      chainGeneration.current += 1;
      const nextChainId = parseChainId(value);
      if (chainIdRef.current !== nextChainId) bumpRevision();
      chainIdRef.current = nextChainId; setChainId(nextChainId);
    };
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      refreshGeneration.current += 1;
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [refresh, bumpRevision]);

  const connect = useCallback(() => {
    const flight = connectFlight;
    const pending = flight.getPending();
    if (pending) return pending;
    const requestGeneration = ++sessionGeneration.current;
    refreshGeneration.current += 1;
    disconnectedRef.current = false;
    setConnecting(true);
    const provider = injectedProvider();
    if (!provider) {
      setConnecting(false);
      return Promise.reject(new Error("Install or open an injected EIP-1193 wallet to continue"));
    }
    return flight.run(async () => {
      try {
        if (requestGeneration !== sessionGeneration.current) throw new Error("Wallet connection was superseded");
        const xs = await accounts(true);
        if (!xs[0]) throw new Error("No wallet account was returned");
        if (requestGeneration !== sessionGeneration.current) throw new Error("Wallet connection was superseded");
        await ensureStudionet();
        if (requestGeneration !== sessionGeneration.current) throw new Error("Wallet connection was superseded");
        const activeProvider = injectedProvider();
        if (!activeProvider || activeProvider !== provider) throw new Error("Injected wallet provider changed during connection; try again");
        let latestAccounts: string[] = [];
        let rawChain: unknown;
        let stable = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const generation = accountGeneration.current;
          [latestAccounts, rawChain] = await Promise.all([
            accounts(false), activeProvider.request({ method: "eth_chainId" }),
          ]);
          if (requestGeneration !== sessionGeneration.current) throw new Error("Wallet connection was superseded");
          if (generation === accountGeneration.current) { stable = true; break; }
        }
        if (!stable) throw new Error("Wallet account kept changing during connection; try again");
        const selectedAccount = latestAccounts[0];
        if (!selectedAccount) throw new Error("Wallet account changed during connection; reconnect and try again");
        const selectedChain = parseChainId(rawChain);
        if (selectedChain !== CHAIN_ID) throw new Error("Wallet changed networks during connection; reconnect to Studionet");
        if (!sameWallet(addressRef.current, selectedAccount) || chainIdRef.current !== selectedChain) bumpRevision();
        addressRef.current = selectedAccount; chainIdRef.current = selectedChain;
        setAddress(selectedAccount);
        chainGeneration.current += 1;
        setChainId(selectedChain);
        setReady(true);
        return selectedAccount;
      } finally {
        if (requestGeneration === sessionGeneration.current) setConnecting(false);
      }
    });
  }, [connectFlight, bumpRevision]);

  const disconnect = useCallback(() => {
    sessionGeneration.current += 1;
    refreshGeneration.current += 1;
    connectFlight.clear();
    setConnecting(false);
    disconnectedRef.current = true;
    if (addressRef.current !== null || chainIdRef.current !== null) bumpRevision();
    addressRef.current = null; chainIdRef.current = null;
    setAddress(null);
    setChainId(null);
  }, [connectFlight, bumpRevision]);

  const switchNetwork = useCallback(async () => {
    await ensureStudionet();
    await refresh();
  }, [refresh]);

  const isCurrent = useCallback((candidate: string, expectedRevision?: number) => walletSessionIsCurrent({
    address: addressRef.current, chainId: chainIdRef.current, revision: revisionRef.current, disconnected: disconnectedRef.current,
  }, candidate, expectedRevision), []);
  const getRevision = useCallback(() => revisionRef.current, []);

  return {
    address, chainId, ready, connecting, connected: !!address, correctNetwork: chainId === CHAIN_ID, revision,
    hasProvider: !!injectedProvider(), connect, disconnect, refresh, switchNetwork,
    isCurrent, getRevision,
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
