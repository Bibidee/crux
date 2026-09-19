"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CircleDot, WalletCards } from "lucide-react";
import { useInjectedWallet } from "@/lib/wallet";
import { shortAddress } from "@/lib/format";

export function WalletButton() {
  const wallet = useInjectedWallet();
  const [busy, setBusy] = useState(false);

  async function act() {
    setBusy(true);
    try {
      if (!wallet.connected) await wallet.connect();
      else if (!wallet.correctNetwork) await wallet.switchNetwork();
      toast.success(wallet.connected ? "Studionet ready" : "Wallet connected");
    } catch (error: any) {
      toast.error(error?.message || "Wallet request failed");
    } finally { setBusy(false); }
  }

  if (!wallet.ready) return <button className="wallet-button muted" disabled>Checking wallet…</button>;
  if (wallet.connected) {
    return (
      <button aria-label={wallet.correctNetwork ? `Connected wallet ${shortAddress(wallet.address)}` : "Switch wallet to Studionet chain 61999"} className={`wallet-button ${wallet.correctNetwork ? "" : "wrong-network"}`} onClick={act} disabled={busy}>
        <CircleDot size={14}/>
        <span>{wallet.correctNetwork ? shortAddress(wallet.address) : "Switch to 61999"}</span>
      </button>
    );
  }
  return (
    <button className="wallet-button" onClick={act} disabled={busy}>
      <WalletCards size={15}/><span>{busy ? "Opening…" : "Connect wallet"}</span>
    </button>
  );
}
