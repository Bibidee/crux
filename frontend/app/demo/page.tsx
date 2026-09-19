import Link from "next/link";

const registry = "0x5789b330f90CFBDa2DCBdeF7A66cbA1247Ec9107";
const tx = (hash: string) => `https://explorer-studio.genlayer.com/tx/${hash}`;
export default function DemoPage() {
  return <div className="page-shell demo-page">
    <div className="page-heading"><div><div className="eyebrow">Five-minute live demo</div><h1>Follow the fact.</h1></div><p>Case <strong>cx-2</strong> is the deployed Crux evidence flow: baseline uncertainty, a committed source, independent verification, closure, and withdrawal.</p></div>
    <div className="demo-callout"><span className="step-no">LIVE / STUDIONET 61999</span><strong>Every link below is a finalized transaction or deployed contract.</strong><a href={`https://explorer-studio.genlayer.com/address/${registry}`} target="_blank" rel="noreferrer">Open Registry ↗</a></div>
    <ol className="demo-steps">
      <li><span>01</span><div><h2>Start unresolved</h2><p>Wallet A funded cx-2. The baseline fact established the chain ID but not the RPC, so consensus kept the case insufficient.</p><a href={tx("0xeb94901ba52c44e9c5d4a493f7735d57971f0324b8612d017ab05377d1697c52")} target="_blank" rel="noreferrer">Create transaction ↗</a></div></li>
      <li><span>02</span><div><h2>Commit before revealing</h2><p>Wallet B reserved the evidence with a hash-bound commitment. The source and fact stayed hidden until the second signature.</p><a href={tx("0x346108cf93f33832c32d7e969c218c3faee9770b50d3d874a79aec625b616836")} target="_blank" rel="noreferrer">Commit transaction ↗</a></div></li>
      <li><span>03</span><div><h2>Reveal the missing fact</h2><p>The official Networks page supplied the missing RPC fact. EvidenceVerifier fetched and checked the source.</p><a href={tx("0xcdb5620451b71eb275ef0a1adb03ae7781c6b2c410b893ac81ee463dcda915ea")} target="_blank" rel="noreferrer">Reveal transaction ↗</a></div></li>
      <li><span>04</span><div><h2>Close and pay</h2><p>ClosureJudge independently replayed the rule, returned OUTCOME_A, and allocated the bounty to Wallet B.</p><a href={tx("0xad50ec22406c68f51f6e3190a0e9ff73e288001adbbbc71e0a87358d32a5e776")} target="_blank" rel="noreferrer">Withdrawal transaction ↗</a></div></li>
    </ol>
    <div className="demo-footer"><Link className="primary-button acid" href="/cases/cx-2">Open cx-2 in Crux</Link><Link className="secondary-button" href="/protocol">Read the trust architecture</Link></div>
  </div>;
}
