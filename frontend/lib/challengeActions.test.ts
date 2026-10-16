import { describe, expect, it } from "vitest";
import { getChallengeActionState, isChallengeWriteReady } from "./challengeActions";
import type { ChallengeCase, ChallengeRecord } from "./types";

const NOW = 2_000_000_000;

function caseState(overrides: Partial<ChallengeCase> = {}): ChallengeCase {
  return {
    id: "cx-1", title: "Case", question: "Question", outcome_a: "A", outcome_b: "B",
    sponsor: "0x1111111111111111111111111111111111111111", bounty_atto: "1000000000000000",
    bond_atto: "100000000000000", status: "PROVISIONAL_CLOSURE", closes_at: String(NOW + 7200),
    challenge_deadline: String(NOW + 3600), challenge_status: "OPEN", pending_challenge_count: 0,
    can_finalize: false, provisional_submission: "cs-1", ...overrides,
  };
}

function challenge(overrides: Partial<ChallengeRecord> = {}): ChallengeRecord {
  return {
    id: "ch-1", case_id: "cx-1", challenged_decision_id: "cs-1", challenged_evidence_id: "cs-1",
    challenger: "0x2222222222222222222222222222222222222222", commitment: "a".repeat(64),
    bond_atto: "100000000000000", status: "COMMITTED", committed_at: String(NOW - 1200),
    reveal_deadline: String(NOW - 1), stage_deadline: "0", source_url: "", counterclaim: "",
    revealed_at: "", bond_released: false, bond_forfeited: false, settled_at: "", ...overrides,
  };
}

describe("Challenge V2 action availability", () => {
  it("allows challenges before the deadline, but not exactly at or after it", () => {
    expect(getChallengeActionState(caseState(), [], NOW).canChallenge).toBe(true);
    expect(getChallengeActionState(caseState(), [], NOW + 3600).canChallenge).toBe(false);
    expect(getChallengeActionState(caseState(), [], NOW + 3601).canChallenge).toBe(false);
  });

  it("uses the authoritative can_finalize flag after the deadline", () => {
    const state = getChallengeActionState(caseState({ challenge_deadline: String(NOW - 1), can_finalize: true }), [], NOW);
    expect(state.canChallenge).toBe(false);
    expect(state.canFinalize).toBe(true);
  });

  it("switches from the exhausted normal budget to one protected appeal", () => {
    const state = getChallengeActionState(
      caseState({ challenge_count: 8, can_appeal: true, appeal_bond_atto: "200000000000000" }), [], NOW,
    );
    expect(state.canChallenge).toBe(false);
    expect(state.canAppeal).toBe(true);
    expect(getChallengeActionState(caseState({ challenge_count: 8 }), [], NOW).canAppeal).toBe(false);
  });

  it("exposes expired unrevealed cleanup and keeps queued work visible", () => {
    const queued = challenge({ id: "ch-queued", status: "REVEALED_QUEUED", reveal_deadline: String(NOW + 1) });
    const state = getChallengeActionState(caseState({ pending_challenge_count: 2 }), [challenge(), queued], NOW);
    expect(state.expiredUnrevealedId).toBe("ch-1");
    expect(state.canChallenge).toBe(true);
  });

  it("exposes an expired active review for recovery", () => {
    const state = getChallengeActionState(
      caseState({ status: "CHALLENGE_REVIEW", challenge_status: "REVIEW_PENDING", pending_challenge: "ch-1" }),
      [challenge({ status: "REVIEW_PENDING", reveal_deadline: String(NOW - 1200), stage_deadline: String(NOW - 1) })], NOW,
    );
    expect(state.expiredReviewId).toBe("ch-1");
  });

  it.each([
    ["resolved overturn", caseState({ status: "CHALLENGE_RESOLVED", challenge_status: "VERDICT_OVERTURNED", can_finalize: true })],
    ["completed uphold", caseState({ challenge_status: "VERDICT_UPHELD", can_finalize: true })],
    ["reopened", caseState({ status: "REOPENED", challenge_status: "REOPENED" })],
    ["closed", caseState({ status: "CLOSED", challenge_status: "FINALIZED", can_finalize: false })],
  ])("handles %s without stale challenge actions", (_label, value) => {
    const state = getChallengeActionState(value, [], NOW + 7200);
    expect(state.canChallenge).toBe(false);
    if (value.status === "REOPENED") expect(state.canReopen).toBe(true);
  });

  it("disables writes for a disconnected wallet, wrong network, or paused V2 configuration", () => {
    expect(isChallengeWriteReady(true, false, true)).toBe(false);
    expect(isChallengeWriteReady(true, true, false)).toBe(false);
    expect(isChallengeWriteReady(false, true, true)).toBe(false);
    expect(isChallengeWriteReady(true, true, true)).toBe(true);
  });
});
