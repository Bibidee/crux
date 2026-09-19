import { parseGen } from "./format";

export type CreateFormValues = {
  title: string; question: string; rule: string; outcomeA: string; outcomeB: string;
  policy: string; sources: { url: string; fact: string }[]; bounty: string; hours: string;
};

export function validateCreateForm(values: CreateFormValues): string | null {
  if (![values.title, values.question, values.rule, values.outcomeA, values.outcomeB, values.policy].every((x) => x.trim())) return "Complete the case definition first";
  if (values.sources.some((s) => !s.url.startsWith("https://") || s.fact.trim().length < 8)) return "Every baseline item needs an https source and a clear fact";
  let bounty: bigint;
  try { bounty = parseGen(values.bounty); } catch (error: any) { return error?.message || "Enter a valid bounty"; }
  if (bounty < 10n ** 15n || bounty > 10n ** 18n) return "Bounty must be between 0.001 and 10 GEN";
  const duration = Number(values.hours);
  if (!Number.isFinite(duration) || duration < 0.5 || duration > 336) return "Choose a window from 0.5 to 336 hours";
  return null;
}
