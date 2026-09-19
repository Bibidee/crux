export const ATTO = 10n ** 18n;

export function formatGen(value?: string | bigint, digits = 4): string {
  if (value === undefined || value === null || value === "") return "0";
  const n = typeof value === "bigint" ? value : BigInt(value);
  const whole = n / ATTO;
  const fraction = (n % ATTO).toString().padStart(18, "0").slice(0, digits).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

export function parseGen(value: string): bigint {
  const clean = value.trim();
  if (!/^\d+(\.\d{0,18})?$/.test(clean)) throw new Error("Enter a valid GEN amount");
  const [whole, frac = ""] = clean.split(".");
  return BigInt(whole) * ATTO + BigInt(frac.padEnd(18, "0"));
}

export function shortAddress(address?: string | null, edge = 5): string {
  if (!address) return "";
  return `${address.slice(0, 2 + edge)}…${address.slice(-edge)}`;
}

export function timeLeft(timestamp: string): string {
  const ms = Number(timestamp) * 1000 - Date.now();
  if (ms <= 0) return "ended";
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h left`;
  const minutes = Math.max(1, Math.floor((ms % 3_600_000) / 60_000));
  return `${hours}h ${minutes}m left`;
}

export function absoluteDate(timestamp: string): string {
  const n = Number(timestamp);
  if (!Number.isFinite(n)) return "—";
  return new Date(n * 1000).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

export function outcomeLabel(cruxCase: Pick<import("./types").CruxCase, "outcome_a" | "outcome_b">, outcome?: string): string {
  if (outcome === "OUTCOME_A") return cruxCase.outcome_a;
  if (outcome === "OUTCOME_B") return cruxCase.outcome_b;
  if (outcome === "INSUFFICIENT_EVIDENCE") return "Unresolved";
  return outcome || "Unresolved";
}
