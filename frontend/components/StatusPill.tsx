const soft = new Set(["OPEN", "VERIFIED_NON_CLOSING", "COMMITTED"]);
const done = new Set(["CLOSED", "CLOSED_WINNER"]);
const caution = new Set(["BASELINE_PENDING", "VERIFICATION_PENDING", "CLOSURE_PENDING", "REVEAL_QUEUED", "BASELINE_RETRYABLE", "RETRYABLE_SOURCE"]);

export function StatusPill({ status }: { status: string }) {
  const kind = done.has(status) ? "done" : caution.has(status) ? "caution" : soft.has(status) ? "open" : "quiet";
  return <span className={`status-pill ${kind}`}>{status.replaceAll("_", " ").toLowerCase()}</span>;
}
