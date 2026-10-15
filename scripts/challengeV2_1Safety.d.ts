export type ChallengeV2_1PlanItem = Readonly<{
  key: "registry" | "verifier" | "judge" | "challengeAdjudicator";
  file: string;
}>;

export const CHALLENGE_V2_1_PLAN: readonly ChallengeV2_1PlanItem[];

export function canonicalSourceSha256(contents: string | Uint8Array): string;

export function challengeV2_1RunMode(
  env: Record<string, string | undefined>,
): "skip" | "run";

export function assertChallengeV2_1Manifest(
  manifest: Record<string, any>,
  sourceHashes: Record<string, string>,
): void;
