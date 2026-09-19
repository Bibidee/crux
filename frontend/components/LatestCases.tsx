"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CaseCard } from "./CaseCard";
import { listCases } from "@/lib/crux";
import type { CruxCase } from "@/lib/types";

export function LatestCases() {
  const [items, setItems] = useState<CruxCase[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { listCases(0, 24).then((x) => setItems([...x.items].reverse().slice(0, 3))).catch(() => {}).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="loading-line"/>;
  if (!items.length) return <div className="empty-state"><span>∅</span><h3>No open questions yet.</h3><p>The first case can start with a real unresolved decision and a funded bounty.</p><Link className="text-link" href="/create">Open the first case →</Link></div>;
  return <div className="market-preview">{items.map((item, index) => <CaseCard key={item.id} item={item} number={index + 1}/>)}</div>;
}
