"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CircleDot, WalletCards, ChevronDown } from "lucide-react";
import { useInjectedWallet } from "@/lib/wallet";
import { shortAddress } from "@/lib/format";

export function WalletButton() {
  const wallet = useInjectedWallet();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function connectOrSwitch() {
    setBusy(true);
    try {
      if (!wallet.connected) await wallet.connect();
      else if (!wallet.correctNetwork) await wallet.switchNetwork();
      toast.success("Studionet wallet ready");
    } catch (error: any) {
      toast.error(error?.message || "Wallet request failed");
    } finally { setBusy(false); }
  }

  function disconnect() {
    wallet.disconnect();
    setOpen(false);
    toast.success("Wallet disconnected from this app");
  }

  if (!wallet.ready) return <button className="wallet-button muted" disabled>Checking wallet…</button>;
  if (!wallet.connected) return <button className="wallet-button" onClick={connectOrSwitch} disabled={busy}><WalletCards size={15}/><span>{busy ? "Opening…" : "Connect wallet"}</span></button>;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 4 }}>
        <button aria-label={wallet.correctNetwork ? `Connected wallet ${shortAddress(wallet.address)}` : "Switch wallet to Studionet chain 61999"} className={`wallet-button ${wallet.correctNetwork ? "" : "wrong-network"}`} onClick={connectOrSwitch} disabled={busy}>
          <CircleDot size={14}/><span>{wallet.correctNetwork ? shortAddress(wallet.address) : "Switch to 61999"}</span>
        </button>
        <button className="wallet-button" aria-label="Wallet menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}><ChevronDown size={14}/></button>
      </div>
      {open ? <div role="menu" aria-label="Wallet actions" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 10, minWidth: 180, padding: 8, background: "var(--paper)", border: "1px solid var(--ink)", boxShadow: "4px 4px 0 var(--ink)" }}>
        <div style={{ padding: "6px 8px", fontSize: 11, color: "var(--muted)" }}>{shortAddress(wallet.address)}</div>
        <button role="menuitem" className="secondary-button" style={{ width: "100%" }} onClick={disconnect}>Disconnect</button>
      </div> : null}
    </div>
  );
}
