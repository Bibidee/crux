"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/StatusPill";
import { EmptyState } from "@/components/EmptyState";
import { getCase, getSubmission, getSubmissionForCommitment, listSubmissions, REGISTRY_ADDRESS, submitRegistryWrite, waitForDecision, waitForFinalization } from "@/lib/crux";
import { EXPLORER_URL, useInjectedWallet } from "@/lib/wallet";
import { absoluteDate, formatGen, outcomeLabel, shortAddress, timeLeft } from "@/lib/format";
import { loadPendingReveals, makeCommitment, randomSalt, removePendingReveal, savePendingReveal } from "@/lib/commitment";
import type { CruxCase, PendingReveal, Submission } from "@/lib/types";

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const wallet = useInjectedWallet();
  const [item, setItem] = useState<CruxCase | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [url, setUrl] = useState("");
  const [fact, setFact] = useState("");
  const [pending, setPending] = useState<PendingReveal | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async (latest = false) => {
    try {
      const [c, s] = await Promise.all([getCase(id, latest), listSubmissions(id, latest)]);
      setItem(c); setSubmissions([...s].reverse()); setError("");
      const local = loadPendingReveals().find((x) => x.caseId === id);
      setPending(local || null);
    } catch (e: any) { setError(e?.message || "Could not read this case"); }
  }, [id]);

  useEffect(() => { refresh(false); }, [refresh]);

  const mine = useMemo(() => submissions.filter((x) => x.contributor?.toLowerCase() === wallet.address?.toLowerCase()), [submissions, wallet.address]);
  const sponsor = !!item && !!wallet.address && item.sponsor.toLowerCase() === wallet.address.toLowerCase();

  async function ensureWallet(): Promise<string> {
    if (!wallet.address) return wallet.connect();
    if (!wallet.correctNetwork) await wallet.switchNetwork();
    return wallet.address;
  }

  async function commitEvidence() {
    if (!item) return;
    if (!url.trim().startsWith("https://")) return toast.error("Use a public https:// source");
    if (fact.trim().length < 8) return toast.error("State the exact fact the source establishes");
    setBusy("commit");
    let commitment = "";
    try {
      const address = await ensureWallet();
      const salt = randomSalt();
      commitment = await makeCommitment({ registry: REGISTRY_ADDRESS, caseId: item.id, contributor: address, evidenceUrl: url.trim(), claimedFact: fact.trim(), salt });
      const local: PendingReveal = { caseId: item.id, commitment, evidenceUrl: url.trim(), claimedFact: fact.trim(), salt, createdAt: new Date().toISOString(), commitState: "READY" };
      savePendingReveal(local); setPending(local);
      const hash = await submitRegistryWrite(address, { functionName: "commit_evidence", args: [item.id, commitment], value: BigInt(item.bond_atto) });
      savePendingReveal({ ...local, commitTxHash: hash, commitState: "SUBMITTED" }); setPending({ ...local, commitTxHash: hash, commitState: "SUBMITTED" });
      toast.message("Evidence committed", { description: "Waiting for the commitment to settle before reveal.", action: { label: "Explorer", onClick: () => window.open(`${EXPLORER_URL}/tx/${hash}`, "_blank") } });
      await waitForFinalization(hash);
      savePendingReveal({ ...local, commitTxHash: hash, commitState: "FINALIZED" }); setPending({ ...local, commitTxHash: hash, commitState: "FINALIZED" });
      await refresh(false);
      toast.success("Commitment finalised", { description: "Reveal with the second signature to start verification." });
    } catch (e: any) {
      toast.error(e?.message || "Commit did not finalize. The sealed evidence remains saved so you can reconcile or retry safely.");
    } finally { setBusy(""); }
  }

  async function revealEvidence() {
    if (!pending) return;
    setBusy("reveal");
    try {
      const address = await ensureWallet();
      let submissionId = await getSubmissionForCommitment(pending.commitment, false);
      if (!submissionId) submissionId = await getSubmissionForCommitment(pending.commitment, true);
      if (!submissionId) throw new Error("Commitment is not final yet. Try reveal again in a moment.");
      const hash = await submitRegistryWrite(address, { functionName: "reveal_evidence", args: [submissionId, pending.evidenceUrl, pending.claimedFact, pending.salt] });
      savePendingReveal({ ...pending, revealTxHash: hash, revealState: "SUBMITTED" }); setPending({ ...pending, revealTxHash: hash, revealState: "SUBMITTED" });
      toast.message("Evidence revealed", { description: "GenLayer will now fetch the source and verify the claim.", action: { label: "Explorer", onClick: () => window.open(`${EXPLORER_URL}/tx/${hash}`, "_blank") } });
      await waitForDecision(hash);
      const finalized = await getSubmission(submissionId, true);
      if (["COMMITTED", "REVEAL_QUEUED"].includes(finalized.status)) throw new Error("Reveal transaction finalized without changing the submission; the saved salt was retained.");
      removePendingReveal(pending.commitment); setPending(null); setUrl(""); setFact("");
      await refresh(true);
    } catch (e: any) { toast.error(e?.message || "Reveal failed"); }
    finally { setBusy(""); }
  }

  async function retryBaseline() {
    setBusy("retry");
    try {
      const address = await ensureWallet();
      const hash = await submitRegistryWrite(address, { functionName: "retry_baseline", args: [id] });
      toast.message("Baseline retry submitted", { action: { label: "Explorer", onClick: () => window.open(`${EXPLORER_URL}/tx/${hash}`, "_blank") } }); await waitForDecision(hash); await refresh(true);
    } catch (e: any) { toast.error(e?.message || "Retry failed"); }
    finally { setBusy(""); }
  }

  async function expireCase() {
    setBusy("expire");
    try {
      const address = await ensureWallet();
      const hash = await submitRegistryWrite(address, { functionName: "expire_case", args: [id] });
      toast.message("Expiry submitted", { action: { label: "Explorer", onClick: () => window.open(`${EXPLORER_URL}/tx/${hash}`, "_blank") } }); await waitForDecision(hash); await refresh(true);
    } catch (e: any) { toast.error(e?.message || "Expiry failed"); }
    finally { setBusy(""); }
  }

  if (error) return <div className="page-shell"><div className="error-box">{error}</div></div>;
  if (!item) return <div className="page-shell"><div className="loading-line"/></div>;

  return (
    <div className="page-shell">
      <section className="case-detail-head">
        <div>
          <div className="eyebrow">{item.id} · evidence bounty</div>
          <h1>{item.title}</h1>
          <p className="case-question">{item.question}</p>
          <div style={{display:"flex",gap:10,alignItems:"center",marginTop:20,flexWrap:"wrap"}}><StatusPill status={item.status}/><span style={{fontSize:12,color:"var(--muted)"}}>{timeLeft(item.closes_at)}</span></div>
        </div>
        <aside className="case-meta-card">
          <div><label>Bounty</label><strong>{formatGen(item.bounty_atto)} GEN</strong></div>
          <div><label>Evidence bond</label><strong>{formatGen(item.bond_atto)} GEN</strong></div>
          <div><label>Sponsor</label><strong>{shortAddress(item.sponsor)}</strong></div>
          <div><label>Closes</label><strong>{absoluteDate(item.closes_at)}</strong></div>
          {item.status === "CLOSED" ? <div><label>Final result</label><strong>{outcomeLabel(item, item.final_outcome)}</strong></div> : null}
        </aside>
      </section>

      <div className="case-tabs"><a href="#case" className="active">Case</a><a href="#evidence">Evidence</a><a href="#submissions">Submissions</a></div>

      <section className="case-content-grid" id="case">
        <div>
          <div className="rule-panel">
            <h2>Decision rule</h2><p>{item.decision_rule || "Decision rule unavailable in the list view."}</p>
            <div className="decision-box"><div className="outcome-box"><small>Outcome A</small><strong>{item.outcome_a}</strong></div><div className="outcome-vs">OR</div><div className="outcome-box"><small>Outcome B</small><strong>{item.outcome_b}</strong></div></div>
          </div>
          <div className="rule-panel"><h2>Admissible sources</h2><p>{item.source_policy}</p></div>
          {item.baseline_review?.basis ? <div className="rule-panel"><h2>Why it opened unresolved</h2><p>{item.baseline_review.basis}</p></div> : null}

          <div className="evidence-section" id="evidence" style={{marginTop:42}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h2 style={{margin:0}}>Accepted evidence graph</h2><span style={{font:"10px ui-monospace,monospace",color:"var(--muted)"}}>{item.accepted_evidence?.length || 0} facts</span></div>
            {item.accepted_evidence?.length ? <div className="evidence-stack">{item.accepted_evidence.map((e) => <div className={`evidence-node ${e.kind === "CONTRIBUTED" ? "contributed" : ""}`} key={`${e.id}-${e.url}`}><div className="evidence-node-head"><span>{e.kind}</span><span>{e.id}</span></div><p>{e.fact}</p><a href={e.url} target="_blank" rel="noreferrer">{e.url} <ExternalLink size={10}/></a></div>)}</div> : <EmptyState title="No accepted facts." text="The baseline evidence has not been established yet."/>}
          </div>

          <div className="submission-section" id="submissions" style={{marginTop:54}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h2 style={{margin:0}}>Submissions</h2><button className="icon-button" onClick={() => refresh(true)} title="Refresh"><RefreshCw size={16}/></button></div>
            {!submissions.length ? <EmptyState title="No evidence submitted yet." text="A contributor can reserve an evidence packet with commit-reveal and become the first to test the gap."/> : <div className="submission-list">{submissions.map((s) => <div className="submission-row" key={s.id}><div><span style={{font:"10px ui-monospace,monospace",color:"var(--muted)"}}>{s.id}</span><div style={{marginTop:6}}><StatusPill status={s.status}/></div></div><div><strong style={{fontSize:13}}>{s.claimed_fact || "Committed evidence is still sealed."}</strong>{s.evidence_url ? <p><a href={s.evidence_url} target="_blank" rel="noreferrer">{s.evidence_url}</a></p> : <p>Waiting for reveal.</p>}</div><div className="submission-row-right"><span style={{fontSize:11,color:"var(--muted)"}}>{shortAddress(s.contributor)}</span>{BigInt(s.reward_atto || "0") > 0n ? <p style={{color:"var(--ink)"}}>+{formatGen(s.reward_atto)} GEN</p> : null}</div></div>)}</div>}
          </div>
        </div>

        <aside>
          {item.status === "OPEN" && !sponsor ? <div className="submit-panel">
            <div style={{display:"flex",alignItems:"center",gap:8}}><ShieldCheck size={17}/><strong>Submit the missing fact</strong></div>
            <p>Commit first. Your source and fact stay private until your reservation is on-chain. The reveal starts verification.</p>
            {pending ? <>
              <div className="field"><label>Reserved source</label><input value={pending.evidenceUrl} disabled/></div>
              <div className="field"><label>Reserved fact</label><textarea value={pending.claimedFact} disabled/></div>
              <button className="primary-button" onClick={revealEvidence} disabled={!!busy}>{busy === "reveal" ? "Opening wallet…" : "Reveal + verify · step 2/2"}</button>
              <p>Your salt is stored only in this browser until reveal. Do not clear site data before signing step 2.</p>
            </> : <>
              <div className="field"><label>Public source URL</label><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…"/></div>
              <div className="field"><label>Exact fact it establishes</label><textarea value={fact} onChange={(e) => setFact(e.target.value)} placeholder="State one checkable fact. Do not argue the final outcome here."/></div>
              <button className="primary-button" onClick={commitEvidence} disabled={!!busy}>{busy === "commit" ? "Committing…" : "Commit evidence · step 1/2"}</button>
            </>}
            <div className="bond-line"><span>Refundable if verified or inconclusive</span><strong>{formatGen(item.bond_atto)} GEN</strong></div>
          </div> : null}

          {sponsor && item.status === "BASELINE_RETRYABLE" ? <div className="submit-panel"><strong>Baseline needs another pass.</strong><p>The source stage did not produce a durable decision. Retrying does not change the case terms.</p><button className="primary-button" onClick={retryBaseline} disabled={!!busy}>Retry baseline</button></div> : null}
          {item.can_expire ? <div className="info-panel" style={{marginTop:20}}><h3>Case window ended.</h3><p>Anyone can release the remaining bounty back to the sponsor.</p><button className="secondary-button" style={{marginTop:12}} onClick={expireCase} disabled={!!busy}>Expire case</button></div> : null}
          {item.status === "CLOSED" ? <div className="submit-panel"><strong>Case closed.</strong><p>The accepted evidence graph crossed the decision rule. The bounty was allocated to {shortAddress(item.winner)}.</p><a className="primary-button" style={{marginTop:12}} href={`${EXPLORER_URL}/address/${REGISTRY_ADDRESS}`} target="_blank" rel="noreferrer">Registry on explorer <ExternalLink size={14}/></a></div> : null}
          {mine.length ? <div className="info-panel" style={{marginTop:24}}><h3>Your submissions</h3><p>{mine.length} submission{mine.length === 1 ? "" : "s"} from this wallet.</p></div> : null}
        </aside>
      </section>
    </div>
  );
}
