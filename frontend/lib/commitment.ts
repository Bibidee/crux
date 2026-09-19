"use client";

import type { PendingReveal } from "./types";

const KEY = "crux:pending-reveals:v1";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function makeCommitment(input: {
  registry: string; caseId: string; contributor: string; evidenceUrl: string; claimedFact: string; salt: string;
}): Promise<string> {
  const payload = ["crux-v1", "61999", input.registry.toLowerCase(), input.caseId,
    input.contributor.toLowerCase(), input.evidenceUrl.trim(), input.claimedFact.trim(), input.salt];
  return sha256(canonical(payload));
}

export function loadPendingReveals(): PendingReveal[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]") as PendingReveal[]; }
  catch { return []; }
}

export function savePendingReveal(item: PendingReveal): void {
  const list = loadPendingReveals().filter((x) => x.commitment !== item.commitment);
  list.unshift(item);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
}

export function removePendingReveal(commitment: string): void {
  localStorage.setItem(KEY, JSON.stringify(loadPendingReveals().filter((x) => x.commitment !== commitment)));
}
