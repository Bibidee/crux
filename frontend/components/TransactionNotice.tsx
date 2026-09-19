export function TransactionNotice({ phase, hash }: { phase: string; hash?: string }) {
  if (!phase) return null;
  const finalized = /final|accepted|complete/i.test(phase);
  return <div className={`transaction-notice ${finalized ? "is-final" : ""}`} role="status" aria-live="polite"><span className="notice-dot"/><div><strong>{phase}</strong>{hash ? <a href={`https://explorer-studio.genlayer.com/tx/${hash}`} target="_blank" rel="noreferrer">View transaction ↗</a> : null}</div></div>;
}
