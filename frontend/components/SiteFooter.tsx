import Link from "next/link";
import { CruxMark } from "./CruxMark";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div><CruxMark/><p>Evidence completion markets on GenLayer.</p></div>
      <div className="footer-links"><Link href="/cases">Cases</Link><Link href="/protocol">Protocol</Link><a href="https://explorer-studio.genlayer.com" target="_blank" rel="noreferrer">Explorer</a></div>
      <span className="footer-network">Studionet · 61999</span>
    </footer>
  );
}
