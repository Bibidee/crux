"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CaseCard } from "@/components/CaseCard";
import { EmptyState } from "@/components/EmptyState";
import { listCases } from "@/lib/crux";
import type { CruxCase } from "@/lib/types";

export default function CasesPage() {
  const [items, setItems] = useState<CruxCase[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listCases(0, 24).then((x) => setItems([...x.items].reverse())).catch((e) => setError(e?.message || "Could not read the Registry")).finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => items.filter((item) => {
    const matchesQuery = `${item.title} ${item.question}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "ALL" || item.status === filter;
    return matchesQuery && matchesFilter;
  }), [items, query, filter]);

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div><div className="eyebrow">Evidence markets</div><h1>Open questions.</h1></div>
        <p>Questions that begin unresolved by design. A case only pays when verified public evidence makes its rule decidable.</p>
      </div>
      <div className="filter-row">
        <div className="search-wrap"><Search size={16}/><input aria-label="Search cases" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title or question"/></div>
        <select aria-label="Filter cases" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="ALL">All states</option><option value="OPEN">Open</option><option value="CLOSED">Closed</option><option value="BASELINE_PENDING">Baseline pending</option><option value="BASELINE_RETRYABLE">Retryable</option><option value="EXPIRED">Expired</option></select>
      </div>
      {loading ? <div className="loading-line"/> : error ? <div className="error-box">{error}</div> : !visible.length ? <EmptyState title="Nothing matches." text="Try a different search, or open a new evidence bounty." action="Open a case" href="/create"/> : <div className="case-grid">{visible.map((item, i) => <CaseCard key={item.id} item={item} number={i + 1}/>)}</div>}
    </div>
  );
}
