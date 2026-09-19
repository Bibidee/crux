export function CruxMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-mark" aria-label="Crux">
      <svg viewBox="0 0 34 34" role="img" aria-hidden="true">
        <path d="M5 6v8.5c0 1.4.7 2.8 1.9 3.6L17 25l10.1-6.9a4.4 4.4 0 0 0 1.9-3.6V6" fill="none" stroke="currentColor" strokeWidth="2"/>
        <path d="M17 25v5M5 6h7M22 6h7" fill="none" stroke="currentColor" strokeWidth="2"/>
        <circle cx="17" cy="25" r="2.3" fill="currentColor"/>
      </svg>
      {!compact && <span>crux</span>}
    </span>
  );
}
