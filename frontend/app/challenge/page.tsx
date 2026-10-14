"use client";

import { cloneElement, FormEvent, ReactElement, useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useInjectedWallet } from "@/lib/wallet";
import { CHALLENGE_REGISTRY_ADDRESS, readChallengeRegistry, submitChallengeRegistryWrite, waitForDecision } from "@/lib/crux";
import type { CalldataEncodable } from "genlayer-js/types";
import { formatGen, shortAddress } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { TransactionNotice } from "@/components/TransactionNotice";
import type { ChallengeCase, ChallengeRecord, Submission } from "@/lib/types";

type PendingItem = {
  caseId: string;
  kind: "evidence" | "challenge";
  commitment: string;
  sourceUrl: string;
  claim: string;
  salt: string;
  recordId: string;
  wallet: string;
};

const PENDING_KEY = "crux.challenge-v2.pending.v1";
const EXPLORER = "https://explorer-studio.genlayer.com";

function currentUnixTime(): number {
  return Math.floor(Date.now() / 1000);
}

function readPending(): PendingItem[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(PENDING_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function initialCaseId(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("case") || "";
}

function genToAtto(value: string): bigint {
  if (!/^\d+(?:\.\d{1,18})?$/.test(value)) throw new Error("Enter a valid GEN amount with up to 18 decimal places.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 10n ** 18n + BigInt((fraction + "0".repeat(18)).slice(0, 18));
}

async function commitmentHash(payload: unknown[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return <div className="field"><label htmlFor={id}>{label}</label>{cloneElement(children as ReactElement<{ id?: string }>, { id })}</div>;
}

export default function ChallengeV2Page() {
  const wallet = useInjectedWallet();
  const [caseId, setCaseId] = useState(initialCaseId);
  const [caseData, setCaseData] = useState<ChallengeCase | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [challenges, setChallenges] = useState<ChallengeRecord[]>([]);
  const [cases, setCases] = useState<ChallengeCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingItem[]>(readPending);
  const [credit, setCredit] = useState("0");
  const [busy, setBusy] = useState("");
  const [phase, setPhase] = useState("");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [rule, setRule] = useState("");
  const [outcomeA, setOutcomeA] = useState("");
  const [outcomeB, setOutcomeB] = useState("");
  const [policy, setPolicy] = useState("");
  const [baseline, setBaseline] = useState("");
  const [bounty, setBounty] = useState("");
  const [durationHours, setDurationHours] = useState("24");

  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceFact, setEvidenceFact] = useState("");
  const [challengeUrl, setChallengeUrl] = useState("");
  const [counterclaim, setCounterclaim] = useState("");
  const [challengedEvidence, setChallengedEvidence] = useState("");
  const refreshSequence = useRef(0);
  const transactionLock = useRef(false);
  const packetLock = useRef(false);

  const savePending = useCallback((items: PendingItem[]) => {
    setPending(items);
    if (typeof window !== "undefined") window.localStorage.setItem(PENDING_KEY, JSON.stringify(items));
  }, []);

  const refresh = useCallback(async () => {
    if (!CHALLENGE_REGISTRY_ADDRESS) { setLoading(false); return; }
    const sequence = ++refreshSequence.current;
    setLoading(true);
    try {
      const page = await readChallengeRegistry<{ items: ChallengeCase[] }>("list_cases", [0n, 24n]);
      if (sequence !== refreshSequence.current) return;
      setError("");
      setCases(page.items || []);
      if (!caseId.trim()) {
        setCaseData(null); setSubmissions([]); setChallenges([]);
      } else {
        const [item, evidenceItems, challengeItems] = await Promise.all([
          readChallengeRegistry<ChallengeCase>("get_case", [caseId.trim()], true),
          readChallengeRegistry<Submission[]>("list_submissions", [caseId.trim()], true),
          readChallengeRegistry<ChallengeRecord[]>("list_challenges", [caseId.trim()], true),
        ]);
        if (sequence !== refreshSequence.current) return;
        setCaseData(item);
        setSubmissions(evidenceItems || []);
        setChallenges(challengeItems || []);
        setChallengedEvidence(item.provisional_submission || "");
      }
      if (wallet.address) {
        const nextCredit = await readChallengeRegistry<string>("get_credit", [wallet.address], true);
        if (sequence === refreshSequence.current) setCredit(nextCredit);
      }
    } catch (cause: unknown) {
      if (sequence !== refreshSequence.current) return;
      setCaseData(null); setError(errorMessage(cause, "Could not load Challenge V2 data from Studionet."));
    } finally {
      if (sequence === refreshSequence.current) setLoading(false);
    }
  }, [caseId, wallet.address]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) return refresh(); });
    return () => { active = false; refreshSequence.current += 1; };
  }, [refresh, refreshKey]);

  async function runWrite(name: string, functionName: string, args: CalldataEncodable[] = [], value = 0n) {
    if (transactionLock.current) throw new Error("Another transaction is already in progress. Wait for it to finish.");
    if (!wallet.connected || !wallet.address) throw new Error("Connect your injected wallet first.");
    if (!wallet.correctNetwork) throw new Error("Switch your wallet to GenLayer Studionet (chain 61999) first.");
    const submittingAddress = wallet.address;
    const walletRevision = wallet.getRevision();
    if (!wallet.isCurrent(submittingAddress, walletRevision)) throw new Error("The connected wallet changed. Reconnect and retry.");
    transactionLock.current = true;
    setBusy(name); setError(""); setTxHash("");
    try {
      const hash = await submitChallengeRegistryWrite(submittingAddress, { functionName, args, value },
        () => wallet.isCurrent(submittingAddress, walletRevision));
      setTxHash(hash); setPhase(`${name} submitted. Waiting for Studionet finality…`);
      await waitForDecision(hash);
      setPhase(`${name} finalized.`);
      toast.success(`${name} finalized`);
      setRefreshKey((n) => n + 1);
      return { hash, submittingAddress };
    } catch (cause: unknown) {
      setError(errorMessage(cause, `${name} failed.`));
      throw cause;
    } finally { transactionLock.current = false; setBusy(""); }
  }

  async function createCase(event: FormEvent) {
    event.preventDefault();
    try {
      const amount = genToAtto(bounty);
      if (amount < 10n ** 15n || amount > 10n ** 19n) throw new Error("Bounty must be between 0.001 and 10 GEN.");
      const baselineItems = JSON.parse(baseline);
      if (!Array.isArray(baselineItems) || baselineItems.length < 1 || baselineItems.length > 3) throw new Error("Provide one to three baseline source/fact objects as JSON.");
      const closeAt = BigInt(currentUnixTime() + Number(durationHours) * 3600);
      const result = await runWrite("Case creation", "create_case",
        [title, question, rule, outcomeA, outcomeB, policy, JSON.stringify(baselineItems), closeAt], amount);
      if (result?.submittingAddress) {
        const latest = await readChallengeRegistry<string>("find_latest_case_by_sponsor", [result.submittingAddress], true);
        if (latest) setCaseId(latest);
      }
      setPhase("Case transaction finalized. Baseline verification is queued on GenLayer.");
    } catch (cause: unknown) { setError(errorMessage(cause, "Case creation failed.")); }
  }

  async function commitPacket(kind: "evidence" | "challenge") {
    if (packetLock.current) return;
    if (!caseData || !wallet.address) return;
    packetLock.current = true;
    try {
      const provisionalSubmission = caseData.provisional_submission || "";
      if (kind === "challenge" && !provisionalSubmission) throw new Error("There is no provisional evidence to challenge.");
      const sourceUrl = kind === "evidence" ? evidenceUrl.trim() : challengeUrl.trim();
      const claim = kind === "evidence" ? evidenceFact.trim() : counterclaim.trim();
      if (!sourceUrl.startsWith("https://") || claim.length < 8) throw new Error("Enter an HTTPS source and a precise, checkable claim.");
      const salt = newSalt();
      const submittedWallet = wallet.address;
      const commitment = kind === "evidence"
        ? await commitmentHash(["crux-challenge-v2", "61999", CHALLENGE_REGISTRY_ADDRESS.toLowerCase(), caseData.id,
            submittedWallet.toLowerCase(), sourceUrl, claim, salt])
        : await commitmentHash(["crux-challenge-v2", "61999", CHALLENGE_REGISTRY_ADDRESS.toLowerCase(), caseData.id,
            provisionalSubmission, challengedEvidence || provisionalSubmission,
            submittedWallet.toLowerCase(), sourceUrl, claim, salt]);
      const item: PendingItem = { caseId: caseData.id, kind, commitment, sourceUrl, claim, salt, recordId: "", wallet: submittedWallet };
      const all = [...readPending().filter((old) => old.commitment !== commitment), item];
      savePending(all);
      const record = kind === "evidence"
        ? await runWrite("Evidence commitment", "commit_evidence", [caseData.id, commitment], BigInt(caseData.bond_atto))
        : await runWrite("Challenge commitment", "commit_challenge",
            [caseData.id, provisionalSubmission, challengedEvidence || provisionalSubmission, commitment],
            BigInt(caseData.bond_atto));
      const recordId = kind === "evidence"
        ? await readChallengeRegistry<string>("get_submission_for_commitment", [commitment], true)
        : await readChallengeRegistry<string>("get_challenge_for_commitment", [commitment], true);
      if (!recordId) throw new Error("Commit finalized, but the record ID is not visible yet. Keep the saved reveal and refresh shortly.");
      savePending(all.map((saved) => saved.commitment === commitment ? { ...saved, recordId } : saved));
      setPhase(`${kind === "evidence" ? "Evidence" : "Challenge"} is committed. Reveal it from this browser after the commit is finalized.`);
      setEvidenceUrl(""); setEvidenceFact(""); setChallengeUrl(""); setCounterclaim("");
      void record;
    } catch (cause: unknown) { setError(errorMessage(cause, "Evidence submission failed.")); }
    finally { packetLock.current = false; }
  }

  async function revealPacket(item: PendingItem) {
    if (packetLock.current) return;
    packetLock.current = true;
    try {
      if (!item.recordId) {
        const recordId = item.kind === "evidence"
          ? await readChallengeRegistry<string>("get_submission_for_commitment", [item.commitment], true)
          : await readChallengeRegistry<string>("get_challenge_for_commitment", [item.commitment], true);
        if (!recordId) throw new Error("Commit is not visible as finalized yet. Refresh after it settles.");
        item = { ...item, recordId };
        savePending(readPending().map((entry) => entry.commitment === item.commitment ? item : entry));
      }
      if (item.kind === "evidence") {
        await runWrite("Evidence reveal", "reveal_evidence", [item.recordId, item.sourceUrl, item.claim, item.salt]);
      } else {
        await runWrite("Challenge reveal", "reveal_challenge", [item.recordId, item.sourceUrl, item.claim, item.salt]);
      }
      savePending(readPending().filter((entry) => entry.commitment !== item.commitment));
      setPhase(`${item.kind === "evidence" ? "Evidence reveal" : "Challenge reveal"} finalized. GenLayer adjudication is now in progress.`);
    } catch (cause: unknown) { setError(errorMessage(cause, "Evidence reveal failed.")); }
    finally { packetLock.current = false; }
  }

  async function act(name: string, functionName: string, args: CalldataEncodable[] = []) {
    try { await runWrite(name, functionName, args); }
    catch { /* runWrite presents the transaction error */ }
  }

  const original = submissions.find((item) => item.id === caseData?.provisional_submission);
  const challengePending = challenges.find((item) => item.id === caseData?.pending_challenge);
  const chainReady = wallet.connected && wallet.correctNetwork;
  const deadline = caseData?.challenge_status === "REVIEW_TIMEOUT_RECOVERY"
    ? caseData.challenge_recovery_deadline : caseData?.challenge_deadline;
  const canChallenge = caseData?.status === "PROVISIONAL_CLOSURE"
    && ["OPEN", "REJECTED", "VERDICT_UPHELD", "UNREVEALED"].includes(caseData.challenge_status || "")
    && !caseData.pending_challenge;

  return <div className="page-shell challenge-v2-shell">
    <div className="page-heading">
      <div><div className="eyebrow">Crux Challenge / V2</div><h1>Can the conclusion hold?</h1></div>
      <p>A decisive fact creates a provisional verdict. During the challenge window, another contributor can submit source-backed counterevidence. GenLayer reviews whether it changes the result.</p>
    </div>

    {!CHALLENGE_REGISTRY_ADDRESS ? <div className="error-box challenge-config-note">
      Challenge V2 has not been deployed or configured on this frontend yet. This route is isolated from the live V1 Registry.
    </div> : null}

    <div className="challenge-v2-grid">
      <section className="form-card">
        <div className="challenge-section-head"><div><div className="eyebrow">01 / Market</div><h2>Find a V2 case</h2></div>
          <button className="secondary-button" onClick={() => setRefreshKey((n) => n + 1)} disabled={!CHALLENGE_REGISTRY_ADDRESS || !!busy}>Refresh</button></div>
        <div className="challenge-case-search">
          <Field label="Case ID"><input value={caseId} onChange={(event) => setCaseId(event.target.value)} placeholder="cx-1" /></Field>
          <button className="primary-button acid" onClick={() => setRefreshKey((n) => n + 1)} disabled={!CHALLENGE_REGISTRY_ADDRESS || !!busy}>Load case</button>
        </div>
        {loading ? <p className="field-help" role="status" aria-live="polite">Loading cases from the V2 Registry…</p> : cases.length ? <div className="challenge-case-list">{cases.map((item) => <button key={item.id} onClick={() => setCaseId(item.id)}>
          <span>{item.id} · {item.status}</span><strong>{item.title}</strong><small>{formatGen(item.bounty_atto)} GEN bounty</small>
        </button>)}</div> : error ? <p className="field-help">Case data could not be loaded. Review the error above and retry.</p> : <p className="field-help">No V2 cases are available yet.</p>}
      </section>

      <section className="challenge-wallet-summary">
        <div className="eyebrow">Wallet & settlement</div>
        {!wallet.connected ? <><p>Connect an injected EIP-1193 wallet to submit, challenge, finalize, or withdraw.</p><button className="primary-button acid" disabled={wallet.connecting} onClick={() => void wallet.connect()}>{wallet.connecting ? "Waiting for wallet…" : "Connect wallet"}</button></>
          : <><strong>{shortAddress(wallet.address)}</strong><p>{wallet.correctNetwork ? "Connected to Studionet · 61999" : "Switch to Studionet · 61999 before signing."}</p>
            {!wallet.correctNetwork ? <button className="primary-button acid" onClick={() => void wallet.switchNetwork()}>Switch network</button> : null}
            <small>V2 claimable credit</small><b>{formatGen(credit)} GEN</b>
            <button className="secondary-button" disabled={!chainReady || !!busy || BigInt(credit || "0") === 0n} onClick={() => void act("V2 withdrawal", "withdraw_credit", [wallet.address])}>Withdraw V2 credit</button>
          </>}
      </section>
    </div>

    {error ? <div className="error-box challenge-v2-error" role="alert">{error}</div> : null}
    <TransactionNotice phase={phase} hash={txHash} />

    <details className="form-card challenge-create-card">
      <summary><span className="eyebrow">02 / Create</span><strong>Open a V2 evidence case</strong><small>Set the decision rule and official baseline before funding.</small></summary>
      <form onSubmit={createCase}>
        <div className="two-col">
          <Field label="Short title"><input required minLength={4} maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Bounty in GEN"><input required inputMode="decimal" placeholder="0.01" value={bounty} onChange={(e) => setBounty(e.target.value)} /></Field>
        </div>
        <Field label="Bounded question"><textarea required minLength={20} value={question} onChange={(e) => setQuestion(e.target.value)} /></Field>
        <Field label="Decision rule"><textarea required minLength={30} value={rule} onChange={(e) => setRule(e.target.value)} /></Field>
        <div className="two-col">
          <Field label="Outcome A"><input required value={outcomeA} onChange={(e) => setOutcomeA(e.target.value)} /></Field>
          <Field label="Outcome B"><input required value={outcomeB} onChange={(e) => setOutcomeB(e.target.value)} /></Field>
        </div>
        <Field label="Admissible source policy"><textarea required minLength={15} value={policy} onChange={(e) => setPolicy(e.target.value)} /></Field>
        <Field label="Baseline sources and facts (JSON)"><textarea required placeholder={'[{"url":"https://official.example/source","fact":"One checkable baseline fact."}]'} value={baseline} onChange={(e) => setBaseline(e.target.value)} /></Field>
        <Field label="Case duration in hours"><input required type="number" min="0.5" max="336" step="0.5" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} /></Field>
        <button className="primary-button acid" disabled={!chainReady || !!busy}>{busy === "Case creation" ? "Waiting for finality…" : "Fund and open V2 case"}</button>
      </form>
    </details>

    {caseData ? <>
      <section className="challenge-case-heading">
        <div><div className="eyebrow">{caseData.id} / Challenge market</div><h2>{caseData.title}</h2><p>{caseData.question}</p></div>
        <div className="challenge-status-card"><small>On-chain state</small><strong>{caseData.status.replaceAll("_", " ")}</strong>
          {caseData.provisional_outcome ? <><small>Proposed conclusion</small><b>{caseData.provisional_outcome.replaceAll("_", " ")}</b></> : null}
          {deadline && Number(deadline) > 0 ? <><small>Challenge deadline</small><b>{new Date(Number(deadline) * 1000).toLocaleString()}</b></> : null}
          <small>Bounty stays locked until finalization</small><b>{formatGen(caseData.remaining_bounty_atto || caseData.bounty_atto)} GEN</b>
        </div>
      </section>

      <section className="challenge-timeline" aria-label="Challenge timeline">
        {["OPEN", "PROVISIONAL_CLOSURE", "CHALLENGE_REVIEW", caseData.challenge_status === "REOPENED" ? "REOPENED" : "FINALIZED"].map((stage, index) => {
          const active = caseData.status === stage || (stage === "PROVISIONAL_CLOSURE" && ["PROVISIONAL_CLOSURE", "CHALLENGE_REVIEW", "CHALLENGE_RESOLVED"].includes(caseData.status));
          const done = stage === "OPEN" ? caseData.status !== "BASELINE_PENDING" && caseData.status !== "OPEN"
            : stage === "PROVISIONAL_CLOSURE" ? ["CHALLENGE_REVIEW", "CHALLENGE_RESOLVED", "REOPENED", "CLOSED"].includes(caseData.status)
              : stage === "CHALLENGE_REVIEW" ? ["CHALLENGE_RESOLVED", "REOPENED", "CLOSED"].includes(caseData.status)
                : caseData.status === "CLOSED" || caseData.status === "OPEN" && caseData.challenge_status === "REOPENED";
          return <div key={stage} className={`challenge-timeline-step ${active ? "active" : ""} ${done ? "done" : ""}`}><i>{String(index + 1).padStart(2, "0")}</i><b>{stage.replaceAll("_", " ")}</b></div>;
        })}
      </section>

      <div className="challenge-v2-grid challenge-content-grid">
        <section className="form-card">
          <div className="eyebrow">Evidence comparison</div><h3>What supports or challenges the conclusion?</h3>
          <div className="challenge-compare-grid">
            <article><small>PROVISIONAL SUPPORT · {caseData.provisional_submission || "BASELINE"}</small>
              {original ? <><p>{original.claimed_fact}</p>{original.evidence_url ? <a href={original.evidence_url} target="_blank" rel="noreferrer">Open supporting source ↗</a> : null}</>
                : <p>{caseData.baseline_review?.basis || "The baseline and accepted evidence are shown in the case record."}</p>}</article>
            <article><small>COUNTEREVIDENCE</small>
              {challenges.length ? challenges.map((item) => <div key={item.id} className="challenge-evidence-item"><b>{item.id} · {item.status.replaceAll("_", " ")}</b><p>{item.counterclaim || "The source claim remains sealed until reveal."}</p>{item.source_url ? <a href={item.source_url} target="_blank" rel="noreferrer">Open challenge source ↗</a> : null}
                {item.review ? <p className="challenge-review-basis">{String(item.review.basis || "")}<br/>Material: {String(item.review.material)} · Contradicts: {String(item.review.contradicts)}</p> : null}</div>)
                : <p>No challenge has been revealed for this provisional decision.</p>}</article>
          </div>
        </section>

        <section className="submit-panel challenge-action-panel">
          {caseData.status === "OPEN" ? <>
            <div className="eyebrow">Contribute evidence</div><h3>Complete the missing fact</h3><p>Use a public source that follows the case policy. The claim stays sealed until the commitment is finalized.</p>
            <Field label="Public source URL"><input type="url" placeholder="https://" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} /></Field>
            <Field label="Exact fact"><textarea value={evidenceFact} onChange={(e) => setEvidenceFact(e.target.value)} /></Field>
            <button className="primary-button" disabled={!chainReady || !!busy} onClick={() => void commitPacket("evidence")}>Commit evidence · bond {formatGen(caseData.bond_atto)} GEN</button>
          </> : canChallenge ? <>
            <div className="eyebrow">Challenge the provisional conclusion</div><h3>Submit source-backed counterevidence</h3>
            <p>Challenge the same subject, version, and time scope. The source must materially contradict the evidence behind this outcome.</p>
            <small>Source policy: {caseData.source_policy}</small>
            <Field label="Challenged evidence ID"><input value={challengedEvidence} onChange={(e) => setChallengedEvidence(e.target.value)} /></Field>
            <Field label="Counterevidence source URL"><input type="url" placeholder="https://" value={challengeUrl} onChange={(e) => setChallengeUrl(e.target.value)} /></Field>
            <Field label="Exact counterclaim"><textarea value={counterclaim} onChange={(e) => setCounterclaim(e.target.value)} /></Field>
            <button className="primary-button" disabled={!chainReady || !!busy || !caseData.provisional_submission} onClick={() => void commitPacket("challenge")}>Commit challenge · bond {formatGen(caseData.bond_atto)} GEN</button>
            <div className="bond-line"><span>Invalid challenge bond</span><b>goes to the final beneficiary</b></div>
          </> : <>
            <div className="eyebrow">Next protocol action</div><h3>{caseData.status.replaceAll("_", " ")}</h3>
            {caseData.can_finalize ? <button className="primary-button" disabled={!chainReady || !!busy} onClick={() => void act("Provisional finalization", "finalize_provisional", [caseData.id])}>Finalize verdict</button> : null}
            {caseData.status === "REOPENED" ? <button className="primary-button" disabled={!chainReady || !!busy} onClick={() => void act("Reopen case", "reopen_case", [caseData.id])}>Reopen evidence submissions</button> : null}
            {caseData.pending_challenge && challengePending ? <><p>Challenge {challengePending.id} is under independent review. The bounty remains escrowed.</p><button className="secondary-button" disabled={!chainReady || !!busy} onClick={() => void act("Expire timed out challenge", "expire_challenge", [challengePending.id])}>Recover after review timeout</button></> : null}
            {caseData.status === "PROVISIONAL_CLOSURE" && caseData.can_finalize ? <p>Challenge window has ended. Anyone can finalize the result.</p> : null}
          </>}
          <div className="bond-line"><span>Contributor bond</span><b>{formatGen(caseData.bond_atto)} GEN</b></div>
        </section>
      </div>

      {pending.some((item) => item.caseId === caseData.id) ? <section className="form-card challenge-pending-reveals">
        <div className="eyebrow">Saved in this browser</div><h3>Pending V2 reveals</h3>
        <p>Keep this browser’s site data until each reveal is finalized. A wallet switch does not erase the saved salt.</p>
        {pending.filter((item) => item.caseId === caseData.id).map((item) => <div key={item.commitment} className="pending-card">
          <h3>{item.kind === "challenge" ? "Challenge reveal" : "Evidence reveal"} · {item.recordId || "record ID pending"}</h3>
          <p>Committed by {shortAddress(item.wallet)} · {item.sourceUrl}</p>
          <button className="primary-button acid" disabled={!chainReady || !!busy} onClick={() => void revealPacket(item)}>Reveal + verify</button>
        </div>)}
      </section> : null}

      <section className="form-card challenge-history">
        <div className="eyebrow">On-chain case activity</div><h3>Evidence and challenge history</h3>
        {submissions.map((item) => <article key={item.id} className="challenge-history-row"><span>{item.id} · {item.status.replaceAll("_", " ")}</span><p>{item.claimed_fact || "Sealed evidence"}</p>{item.evidence_url ? <a href={item.evidence_url} target="_blank" rel="noreferrer">{item.evidence_url} ↗</a> : null}</article>)}
        {challenges.map((item) => <article key={item.id} className="challenge-history-row"><span>{item.id} · {item.status.replaceAll("_", " ")}</span><p>{item.counterclaim || "Sealed challenge claim"}</p>{item.source_url ? <a href={item.source_url} target="_blank" rel="noreferrer">{item.source_url} ↗</a> : null}{item.review ? <p>{String(item.review.basis || "")}</p> : null}</article>)}
        {!submissions.length && !challenges.length ? <p>No evidence or challenges recorded yet.</p> : null}
      </section>
    </> : null}
    <p className="challenge-v2-contract-link">V2 Registry: <a href={`${EXPLORER}/address/${CHALLENGE_REGISTRY_ADDRESS}`} target="_blank" rel="noreferrer">{CHALLENGE_REGISTRY_ADDRESS || "not configured"} ↗</a></p>
  </div>;
}
