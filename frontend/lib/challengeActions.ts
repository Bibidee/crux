import type { ChallengeCase, ChallengeRecord } from "./types";

const ADMISSIBLE_CHALLENGE_STATUSES = new Set([
  "OPEN", "REVIEW_PENDING", "REJECTED", "VERDICT_UPHELD", "UNREVEALED", "REVIEW_TIMEOUT_RECOVERY",
]);

export type ChallengeActionState = {
  canChallenge: boolean;
  canFinalize: boolean;
  expiredUnrevealedId: string | null;
  expiredReviewId: string | null;
  canReopen: boolean;
  canAppeal: boolean;
};

export function isChallengeWriteReady(
  writesEnabled: boolean,
  connected: boolean,
  correctNetwork: boolean,
): boolean {
  return writesEnabled && connected && correctNetwork;
}

function deadlineReached(value: string | undefined, now: number): boolean {
  const deadline = Number(value || "0");
  return Number.isFinite(deadline) && deadline > 0 && deadline <= now;
}

/**
 * Derive write affordances from the authoritative case view and current time.
 * The contract's can_finalize flag is authoritative; browser time is used only
 * to avoid showing a challenge form after the admission deadline or to expose
 * a cleanup action for a record whose deadline has already elapsed.
 */
export function getChallengeActionState(
  caseData: ChallengeCase,
  challenges: ChallengeRecord[],
  now: number,
): ChallengeActionState {
  const pendingCount = caseData.pending_challenge_count || 0;
  const challengeSlots = Math.max(0, 4 - pendingCount);
  const challengeWindowOpen = now > 0 && !deadlineReached(caseData.challenge_deadline, now);
  const normalBudgetAvailable = (caseData.challenge_count || 0) < 8;
  const canChallenge = ["PROVISIONAL_CLOSURE", "CHALLENGE_REVIEW"].includes(caseData.status)
    && ADMISSIBLE_CHALLENGE_STATUSES.has(caseData.challenge_status || "")
    && challengeSlots > 0
    && normalBudgetAvailable
    && challengeWindowOpen;

  const pending = caseData.pending_challenge
    ? challenges.find((item) => item.id === caseData.pending_challenge)
    : undefined;
  const expiredReviewId = pending?.status === "REVIEW_PENDING"
    && deadlineReached(pending.stage_deadline, now) ? pending.id : null;
  const expiredUnrevealedId = challenges.find((item) => item.status === "COMMITTED"
    && deadlineReached(item.reveal_deadline, now))?.id || null;

  return {
    canChallenge,
    canFinalize: Boolean(caseData.can_finalize),
    expiredUnrevealedId,
    expiredReviewId,
    canReopen: caseData.status === "REOPENED" && caseData.challenge_status === "REOPENED",
    canAppeal: Boolean(caseData.can_appeal) && challengeWindowOpen && challengeSlots > 0,
  };
}
