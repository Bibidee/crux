"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { formatGen, shortAddress } from "@/lib/format";
import { getCredit, getSubmissionForCommitment, listCases, listSubmissions, submitRegistryWrite, waitForDecision } from "@/lib/crux";
import { EXPLORER_URL, useInjectedWallet } from "@/lib/wallet";
import { loadPendingReveals, removePendingReveal } from "@/lib/commitment";
import type { PendingReveal, Submission } from "@/lib/types";

export default function ActivityPage() {
  const wallet = useInjectedWallet();
  const [credit, setCredit] = useState("0");
  const [pending, setPending] = useState<PendingReveal[]>([]);
  const [mine, setMine] = useState<Submission[]>([]);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setPending(loadPendingReveals());
    if (!wallet.address) { setMine([]); setCredit("0"); return; }
    setLoading(true);
    try {
      const [balance, cases] = await Promise.all([getCredit(wallet.address, true), listCases(0, 24)]);
      setCredit(balance);
      const groups = await Promise.all(cases.items.map((c) => listSubmissions(c.id, true).catch(() => [])));
      setMine(groups.flat().filter((s) => s.contributor?.toLowerCase() === wallet.address?.toLowerCase()).reverse());
    } finally { setLoading(false); }
  }, [wallet.address]);

  useEffect(() => { refresh(); }, [refresh]);

  async function ensureWallet(): Promise<string> {
    const address = wallet.address || await wallet.connect();
    if (!wallet.correctNetwork) await wallet.switchNetwork();
    return address;
  }

  async function withdraw() {
    setBusy("withdraw");
    try {
      const address = await ensureWallet();
      const hash = await submitRegistryWrite(address, { functionName: "withdraw_credit", args: [address] });
      toast.message("Withdrawal submitted", { action: { label: "Explorer", onClick: () => window.open(`${EXPLORER_URL}/tx/${hash}`, "_blank") } }); await waitForDecision(hash); await refresh(); toast.success("Credit withdrawal accepted");
    } catch (e: any) { toast.error(e?.message || "Withdrawal failed"); }
    finally { setBusy(""); }
  }

  async function reveal(item: PendingReveal) {
    setBusy(item.commitment);
    try {
      const address = await ensureWallet();
      let submissionId = await getSubmissionForCommitment(item.commitment, false);
      if (!submissionId) submissionId = await getSubmissionForCommitment(item.commitment, true);
      if (!submissionId) throw new Error("Commitment is not visible yet. Wait for finality and try again.");
      const hash = await submitRegistryWrite(address, { functionName: "reveal_evidence", args: [submissionId, item.evidenceUrl, item.claimedFact, item.salt] });
      removePendingReveal(item.commitment); toast.message("Reveal submitted", { action: { label: "Explorer", onClick: () => window.open(`${EXPLORER_URL}/tx/${hash}`, "_blank") } }); await waitForDecision(hash); await refresh();
    } catch (e: any) { toast.error(e?.message || "Reveal failed"); }
    finally { setBusy(""); }
  }

  return (
    <div className="page-shell">
      <div className="page-heading"><div><div className="eyebrow">Wallet activity</div><h1>Your trail.</h1></div><p>Pending reveals live in this browser. Credits and submission results live in the Registry contract.</p></div>
      {!wallet.connected ? <EmptyState title="Connect an injected wallet." text="Your Crux activity is indexed by the connected address. No account system sits in between."/> : <div className="activity-grid">
        <aside>
          <div className="credit-card"><small>Claimable Registry credit</small><strong>{formatGen(credit)} GEN</strong><button className="primary-button" onClick={withdraw} disabled={BigInt(credit) === 0n || !!busy}>{busy === "withdraw" ? "Withdrawing…" : "Withdraw credit"}</button></div>
          <div className="info-panel" style={{marginTop:24}}><h3>{shortAddress(wallet.address)}</h3><p>Credits can include bounty winnings, refunded bonds, or returned sponsor escrow.</p></div>
        </aside>
        <section>
          <h2 style={{fontSize:22,margin:"0 0 15px"}}>Reveal queue</h2>
          {!pending.length ? <EmptyState title="No sealed evidence waiting." text="A commitment appears here between the first and second signatures."/> : pending.map((p) => <div className="pending-card" key={p.commitment}><span style={{font:"10px ui-monospace,monospace",color:"var(--muted)"}}>{p.caseId} · sealed</span><h3>{p.claimedFact}</h3><p>{p.evidenceUrl}</p><div style={{display:"flex",gap:9,flexWrap:"wrap"}}><button className="primary-button acid" onClick={() => reveal(p)} disabled={!!busy}>{busy === p.commitment ? "Revealing…" : "Reveal + verify"}</button><Link className="secondary-button" href={`/cases/${p.caseId}`}>Open case</Link></div></div>)}

          <h2 style={{fontSize:22,margin:"48px 0 15px"}}>On-chain submissions</h2>
          {loading ? <div className="loading-line"/> : !mine.length ? <EmptyState title="No submissions from this wallet." text="Browse an open case and submit a source that establishes one missing fact." action="Browse cases" href="/cases"/> : <div className="submission-list">{mine.map((s) => <Link className="submission-row" href={`/cases/${s.case_id}`} key={s.id}><div><span style={{font:"10px ui-monospace,monospace",color:"var(--muted)"}}>{s.id}</span><div style={{marginTop:6}}><StatusPill status={s.status}/></div></div><div><strong style={{fontSize:13}}>{s.claimed_fact || "Sealed commitment"}</strong><p>{s.case_id}</p></div><div className="submission-row-right">{BigInt(s.reward_atto || "0") > 0n ? <strong>+{formatGen(s.reward_atto)} GEN</strong> : <span style={{fontSize:11,color:"var(--muted)"}}>no bounty allocation</span>}</div></Link>)}</div>}
        </section>
      </div>}
    </div>
  );
}
