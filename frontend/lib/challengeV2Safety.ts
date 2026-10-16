export function isChallengeV2WriteEnabled(value: string | undefined): boolean {
  return value === "true";
}

export function requireChallengeV2WriteEnabled(enabled: boolean): void {
  if (!enabled) {
    throw new Error("Challenge V2 writes are paused for the security upgrade. V1 remains available; existing V2 cases and balances are unchanged.");
  }
}
