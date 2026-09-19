import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { CruxCase } from "@/lib/types";
import { formatGen, timeLeft } from "@/lib/format";
import { StatusPill } from "./StatusPill";

export function CaseCard({ item, number }: { item: CruxCase; number?: number }) {
  return (
    <Link href={`/cases/${item.id}`} className="case-card">
      <div className="case-card-top"><span className="case-number">{number ? String(number).padStart(2,"0") : item.id}</span><StatusPill status={item.status}/></div>
      <h3>{item.title}</h3>
      <p>{item.question}</p>
      <div className="case-outcomes"><span>{item.outcome_a}</span><b>or</b><span>{item.outcome_b}</span></div>
      <div className="case-card-bottom"><strong>{formatGen(item.bounty_atto)} GEN</strong><span>{timeLeft(item.closes_at)}</span><ArrowUpRight size={17}/></div>
    </Link>
  );
}
