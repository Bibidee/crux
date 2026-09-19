import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

export default function ProtocolPage() {
  return (
    <div className="page-shell">
      <section className="protocol-hero">
        <div className="eyebrow">Protocol notes</div>
        <h1>Truth is not the product. <br/>Closure is.</h1>
        <p>Crux does not ask validators for a better opinion. It asks whether a public source establishes a specific missing fact, then whether the verified fact set is sufficient under a precommitted rule.</p>
      </section>

      <section className="architecture">
        <div className="arch-row"><b>01 / Registry</b><div><h3>Terms, escrow and state</h3><p>A case fixes the question, two outcome labels, decision rule, source policy and baseline evidence before the market opens. Bounties and contributor bonds are held here. The Registry never uses an off-chain operator verdict.</p></div></div>
        <div className="arch-row"><b>02 / Baseline</b><div><h3>Unknown must be proven first</h3><p>Validators fetch every baseline source. If a claimed starting fact is unsupported, the case is invalid. If the baseline already decides either outcome, the bounty is refunded. Only genuinely insufficient cases become open markets.</p></div></div>
        <div className="arch-row"><b>03 / Commit</b><div><h3>Evidence cannot be copied before reservation</h3><p>The first write contains only a SHA-256 commitment bound to chain 61999, the Registry address, case, contributor, source URL, claimed fact and random salt. Reveal is a second transaction.</p></div></div>
        <div className="arch-row"><b>04 / Verify</b><div><h3>The source is fetched inside GenVM</h3><p>The EvidenceVerifier independently replays six substantive fields: same subject, source admissibility, claim support, time scope, novelty and non-contradiction. Format agreement is not enough.</p></div></div>
        <div className="arch-row"><b>05 / Judge</b><div><h3>Verified does not mean decisive</h3><p>The ClosureJudge receives the accepted evidence graph plus the new verified fact. It applies the original decision rule and can still return insufficient evidence. Non-closing facts remain in the graph for later composition.</p></div></div>
        <div className="arch-row"><b>06 / Settle</b><div><h3>Money follows the semantic result</h3><p>The first contribution that makes the case decisable closes the market. Registry credits the bounty and refundable bond to the contributor. Expiry, rejection and source failure have explicit, separate accounting paths.</p></div></div>
      </section>

      <section className="principles">
        <article className="principle"><h3>Unknown is first-class.</h3><p>Neither the verifier nor closure judge is forced to choose. Missing evidence does not become a negative fact and source unavailability does not become rejection.</p></article>
        <article className="principle"><h3>Two semantic boundaries.</h3><p>“The source supports this fact” and “this fact resolves the case” are different judgments, implemented in different contracts and consensus calls.</p></article>
        <article className="principle"><h3>Evidence composes.</h3><p>A useful fact can be verified without closing the case. It is added to the accepted graph, so another contributor can supply the next missing link.</p></article>
        <article className="principle"><h3>No hidden admin result.</h3><p>The deployed Registry stores fixed verifier and judge addresses. It exposes no administrator setter, override verdict, emergency winner or protocol fee.</p></article>
      </section>

      <div style={{marginTop:65,display:"flex",gap:12,flexWrap:"wrap"}}><Link className="primary-button acid" href="/cases">Inspect live cases <ArrowRight size={15}/></Link><a className="secondary-button" href="https://explorer-studio.genlayer.com" target="_blank" rel="noreferrer">Studionet explorer <ExternalLink size={14}/></a></div>
    </div>
  );
}
