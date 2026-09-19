"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CruxMark } from "./CruxMark";
import { WalletButton } from "./WalletButton";

const links = [
  ["/cases", "Cases"], ["/create", "Open a case"], ["/activity", "Activity"], ["/demo", "Live demo"], ["/protocol", "Protocol"],
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand-link"><CruxMark /></Link>
        <nav className="desktop-nav" aria-label="Primary">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={pathname === href || (href === "/cases" && pathname.startsWith("/cases/")) ? "active" : ""}>{label}</Link>
          ))}
        </nav>
        <div className="header-right"><span className="network-dot"><i/> 61999</span><WalletButton/></div>
      </div>
      <nav className="mobile-nav" aria-label="Mobile">
        {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
    </header>
  );
}
