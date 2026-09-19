"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { findLatestCaseBySponsor, submitRegistryWrite, waitForFinalization } from "@/lib/crux";
import { parseGen } from "@/lib/format";
import { EXPLORER_URL, useInjectedWallet } from "@/lib/wallet";
import { TransactionNotice } from "@/components/TransactionNotice";

type Source = { url: string; fact: string };

export default function CreatePage() {
  const router = useRouter();
  const wallet = useInjectedWallet();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [rule, setRule] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [policy, setPolicy] = useState("Use official project documentation, primary-source registries, upstream repositories, vendor advisories, standards bodies, or other public first-party sources. Exclude social posts, anonymous claims, mirrors, and search-result snippets.");
  const [sources, setSources] = useState<Source[]>([{ url: "", fact: "" }]);
  const [bounty, setBounty] = useState("0.10");
  const [hours, setHours] = useState("48");
  const [phase, setPhase] = useState("");
  const [txHash, setTxHash] = useState("");

  function updateSource(index: number, key: keyof Source, value: string) { setSources((xs) => xs.map((x, i) => i === index ? { ...x, [key]: value } : x)); }
  function removeSource(index: number) { setSources((xs) => xs.filter((_, i) => i !== index)); }

  async function submit() {
    if (!title.trim() || !question.trim() || !rule.trim() || !a.trim() || !b.trim() || !policy.trim()) return toast.error("Complete the case definition first");
    if (sources.some((s) => !s.url.startsWith("https://") || s.fact.trim().length < 8)) return toast.error("Every baseline item needs an https source and a clear fact");
    let value: bigint;
    try { value = parseGen(bounty); } catch (e: any) { return toast.error(e.message); }
    const duration = Number(hours);
    if (!Number.isFinite(duration) || duration < .5 || duration > 336) return toast.error("Choose a window from 0.5 to 336 hours");
    setBusy(true);
    try {
      const address = wallet.address || await wallet.connect();
      if (!wallet.correctNetwork) await wallet.switchNetwork();
      const closesAt = BigInt(Math.floor(Date.now() / 1000 + duration * 3600));
      setPhase("Requesting wallet signature…");
      const hash = await submitRegistryWrite(address, {
        functionName: "create_case",
        args: [title.trim(), question.trim(), rule.trim(), a.trim(), b.trim(), policy.trim(), JSON.stringify(sources), closesAt],
        value,
      });
      setTxHash(hash); setPhase("Transaction submitted — waiting for Studionet finality…");
      toast.message("Case submitted", { description: "The funded baseline must finalize before the market can open.", action: { label: "Explorer", onClick: () => window.open(`${EXPLORER_URL}/tx/${hash}`, "_blank") } });
      await waitForFinalization(hash);
      const caseId = await findLatestCaseBySponsor(address, false);
      setPhase("Case finalized — baseline verification queued.");
      toast.success("Case finalised", { description: "Baseline verification is now queued." });
      router.push(caseId ? `/cases/${caseId}` : "/cases");
    } catch (e: any) { setPhase(e?.message || "Case creation failed"); toast.error(e?.message || "Case creation failed"); }
    finally { setBusy(false); }
  }

  const estimatedBond = (() => { try { const amount = parseGen(bounty); const min = 10n ** 14n; return amount / 100n > min ? amount / 100n : min; } catch { return 0n; } })();

  return (
    <div className="page-shell">
      <div className="page-heading"><div><div className="eyebrow">Create evidence bounty</div><h1>Open a gap.</h1></div><p>A valid Crux case begins with evidence that is real but incomplete. If the baseline already decides the rule, the market refunds instead of opening.</p></div>
      <div className="form-layout">
        <div className="form-card">
          <section className="form-section">
            <div className="form-section-head"><span>01</span><div><h2>Name the unresolved decision</h2><p>Write a bounded question. The answer must map cleanly to two labelled outcomes.</p></div></div>
            <div className="field"><label>Short title</label><input maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Commercial redistribution of package X"/></div>
            <div className="field"><label>Question</label><textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Can package X, version 4.2, be redistributed inside a paid commercial product under the stated policy?"/></div>
            <div className="two-col"><div className="field"><label>Outcome A</label><input value={a} onChange={(e) => setA(e.target.value)} placeholder="Allowed"/></div><div className="field"><label>Outcome B</label><input value={b} onChange={(e) => setB(e.target.value)} placeholder="Not allowed"/></div></div>
          </section>

          <section className="form-section">
            <div className="form-section-head"><span>02</span><div><h2>Write the decision rule</h2><p>The closure judge applies this rule to verified facts only. Missing facts stay missing.</p></div></div>
            <div className="field"><label>Decision rule</label><textarea value={rule} onChange={(e) => setRule(e.target.value)} placeholder="Return Allowed only if the upstream licence for version 4.2 explicitly permits commercial redistribution without a conflicting restriction. Return Not allowed if it explicitly prohibits the required redistribution. Otherwise remain insufficient."/></div>
          </section>

          <section className="form-section">
            <div className="form-section-head"><span>03</span><div><h2>Set the source boundary</h2><p>Decide what counts before anyone hunts for the evidence.</p></div></div>
            <div className="field"><label>Source policy</label><textarea value={policy} onChange={(e) => setPolicy(e.target.value)}/></div>
          </section>

          <section className="form-section">
            <div className="form-section-head"><span>04</span><div><h2>Prove the starting point</h2><p>Add one to three public baseline sources. GenLayer will fetch them and confirm the case is genuinely unresolved.</p></div></div>
            {sources.map((source, index) => <div className="source-row" key={index}><div className="source-row-top"><span style={{font:"10px ui-monospace,monospace"}}>BASELINE {index + 1}</span>{sources.length > 1 ? <button className="icon-button" onClick={() => removeSource(index)} aria-label="Remove source"><Trash2 size={15}/></button> : null}</div><div className="field"><label>Source URL</label><input value={source.url} onChange={(e) => updateSource(index,"url",e.target.value)} placeholder="https://…"/></div><div className="field"><label>Fact already established</label><textarea style={{minHeight:78}} value={source.fact} onChange={(e) => updateSource(index,"fact",e.target.value)} placeholder="State only what this source directly establishes."/></div></div>)}
            {sources.length < 3 ? <button className="secondary-button" onClick={() => setSources((xs) => [...xs, {url:"",fact:""}])}><Plus size={15}/> Add baseline source</button> : null}
          </section>

          <section className="form-section">
            <div className="form-section-head"><span>05</span><div><h2>Fund the close</h2><p>The bounty stays in Registry escrow. The closing contributor gets it; expiry or an invalid baseline returns it as sponsor credit.</p></div></div>
            <div className="two-col"><div className="field"><label>Bounty · GEN</label><input inputMode="decimal" value={bounty} onChange={(e) => setBounty(e.target.value)}/><span className="field-help">0.001 to 10 GEN</span></div><div className="field"><label>Open window · hours</label><input inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)}/><span className="field-help">0.5 to 336 hours</span></div></div>
          </section>
        </div>

        <aside className="form-aside">
          <div className="summary-box"><small>Bounty locked on create</small><strong>{bounty || "0"} GEN</strong><p>The market opens only if validators verify every baseline fact and still return insufficient evidence.</p><button className="primary-button acid" style={{width:"100%",marginTop:8}} onClick={submit} disabled={busy}>{busy ? "Finalising case…" : "Fund + open case"}</button></div>
          <TransactionNotice phase={phase} hash={txHash}/>
          <div className="info-panel"><h3>Contributor bond</h3><p>Set automatically to 1% of the bounty with a 0.0001 GEN floor. Verified and inconclusive submissions get it back; rejected or unrevealed submissions allocate it to the sponsor.</p></div>
          <div className="info-panel"><h3>Not a poll.</h3><p>Crux never pays the most popular answer. It pays evidence that survives source verification and changes the rule from unknown to decidable.</p></div>
        </aside>
      </div>
    </div>
  );
}
