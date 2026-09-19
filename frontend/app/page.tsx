import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { LatestCases } from "@/components/LatestCases";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-main">
          <div className="hero-copy">
            <div className="eyebrow">Evidence completion market</div>
            <h1 className="display-title">Find the fact that <em>changes</em> the answer.</h1>
            <p>Crux puts a bounty on unresolved decisions. Contributors bring public evidence. GenLayer validators check the source, the fact, and whether it finally makes the case decidable.</p>
            <div className="hero-actions">
              <Link href="/cases" className="primary-button acid">Browse open cases <ArrowRight size={16}/></Link>
              <Link href="/create" className="secondary-button">Open a case</Link>
            </div>
          </div>
          <div className="hero-device" aria-label="Crux protocol flow preview">
            <div className="hero-device-head"><span>case / cx-17</span><span>open</span></div>
            <div className="hero-device-body">
              <div className="question-chip">decision pending</div>
              <h3>Can package X be redistributed in a commercial product?</h3>
              <div className="resolve-rail">
                <div className="rail-node"><b>01 / unknown</b><span>licence permission missing</span></div><div className="rail-line"/>
                <div className="rail-node active"><b>02 / evidence</b><span>upstream licence found</span></div><div className="rail-line"/>
                <div className="rail-node"><b>03 / result</b><span>commercial use allowed</span></div>
              </div>
              <div className="hero-device-foot"><span>bounty</span><strong>0.80 GEN</strong></div>
            </div>
          </div>
        </div>
        <div className="hero-strip">
          <div><b>Source-grounded</b><span>Validators fetch the public source themselves.</span></div>
          <div><b>No operator verdict</b><span>Money moves from a GenLayer consensus result, not a server decision.</span></div>
          <div><b>Composable evidence</b><span>Several verified facts can accumulate until the case closes.</span></div>
        </div>
      </section>

      <section className="home-section">
        <div className="section-head"><h2>Unknown is a valid state. It does not have to be the last one.</h2><p>Crux starts where a decision system should stop: the available facts are not enough. The market is for the missing evidence, not for a guess.</p></div>
        <div className="steps-grid">
          <article className="step"><span className="step-no">01 / OPEN</span><h3>Fund the gap.</h3><p>Define the question, two outcomes, decision rule, source policy, and the baseline evidence that still leaves the answer unresolved.</p></article>
          <article className="step"><span className="step-no">02 / VERIFY</span><h3>Bring the source.</h3><p>Contributors commit first, then reveal a public source and the exact fact it establishes. The source is fetched and checked by validators.</p></article>
          <article className="step"><span className="step-no">03 / CLOSE</span><h3>Pay the decisive fact.</h3><p>Verified facts join the evidence graph. When the complete graph makes the rule decidable, the contributor closes the market and earns the bounty.</p></article>
        </div>
      </section>

      <section className="home-section">
        <div className="section-head"><h2>Live questions.</h2><p>Every card reads from the Registry contract on Studionet. No server-side market database.</p></div>
        <LatestCases />
        <div style={{marginTop:24}}><Link href="/cases" className="text-link">See every case →</Link></div>
      </section>

      <section className="home-section">
        <div className="section-head"><h2>The decision path is the product.</h2><p>Verification and closure are separate Intelligent Contracts. That keeps “is this source real?” distinct from “does this fact resolve the rule?”</p></div>
        <div className="architecture">
          <div className="arch-row"><b>Registry</b><div><h3>Escrow + evidence graph</h3><p>Owns cases, commit-reveal reservations, accepted evidence, contributor bonds, credits, expiry and final settlement.</p></div></div>
          <div className="arch-row"><b>Verifier</b><div><h3>Source + claim verification</h3><p>Fetches the submitted URL inside GenVM and replays six substantive decision fields across independent validators.</p></div></div>
          <div className="arch-row"><b>Judge</b><div><h3>Decision closure</h3><p>Applies only verified facts to the case rule. It can return either outcome or keep the case explicitly insufficient.</p></div></div>
        </div>
        <div style={{marginTop:24, display:"flex", gap:18, flexWrap:"wrap"}}><Link href="/protocol" className="text-link">Read the protocol →</Link><a className="text-link" href="https://explorer-studio.genlayer.com" target="_blank" rel="noreferrer">Open Studionet explorer <ExternalLink size={13} style={{verticalAlign:"middle"}}/></a></div>
      </section>
    </>
  );
}
