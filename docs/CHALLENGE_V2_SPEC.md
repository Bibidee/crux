# Crux Challenge V2 — Approved Economic and Finality Specification

The project owner approved these economic rules on 2026-10-14. The corrected Challenge V2.2 contract set is deployed to Studionet chain `61999` and the production `/challenge` route is configured to Registry `0x96F27D5B78F3c98db6eE5C6d6DA3B4dCCa050F2E`; V1 remains unchanged and continues to use its existing Registry, EvidenceVerifier and ClosureJudge. The V2.2 Registry currently has accepted no cases or funds. Contract-layer deployment and source parity are independently verified; the funded lifecycle and recipient-transfer evidence remain pending explicit authorization and execution.

## State machine

```text
BASELINE_PENDING
  -> OPEN                 (baseline independently remains insufficient)
  -> PROVISIONAL_CLOSURE  (decisive evidence is verified)
  -> FINALIZED            (challenge window passes; permissionless finalize)
  -> CHALLENGE_REVIEW     (valid challenge is revealed)
  -> PROVISIONAL_CLOSURE  (rejected/upheld result; wait for finality)
  -> CHALLENGE_RESOLVED   (successful decisive overturn; permissionless finalize)
  -> REOPENED             (overturn leaves the original rule insufficient)
  -> OPEN                 (reopen transition; bounty remains escrowed)
```

The provisional bounty and original evidence bond remain locked through challenge and review. A refundable challenge bond is also held in escrow until terminal challenge settlement is finalized (or the case is reopened). Every transition is deadline-checked by the Registry and callbacks are authenticated, unique and idempotent.

## Approved bounded economic rules

| Item | Approved rule |
|---|---|
| Provisional bounty | Remains locked in case escrow until finalization. |
| Original contributor bond | Remains locked through the challenge window and review. If upheld, it is returned with the winning bounty at finalization; on a decisive overturn, it is refunded to the original contributor at finalization; on reopening, it is refunded when reopening completes. |
| Challenger bond | Fixed at the case’s contributor-bond amount and displayed before signing. |
| Invalid or unrevealed challenge | Bond is forfeited to the eventual final beneficiary at finalization; it cannot change the provisional result. |
| Valid but immaterial challenge | Challenger bond remains escrowed while the provisional verdict is challengeable and is credited to the challenger at finalization. |
| Successful decisive overturn | Original contributor bond is credited back to its contributor; challenger receives the bounty and challenge-bond refund at finalization. |
| Overturn to insufficient evidence | Case reopens; both contributor bonds are credited back, bounty remains escrowed. The case close deadline is extended by one bounded recovery window. |
| Challenge source/review timeout | Challenge bond remains escrowed; the provisional verdict becomes finalizable only after the explicit recovery deadline. Refund is credited at that finalization. |
| Withdrawal | Pull-based, recipient-bound, one-time credits. Provisional bounty and refundable bonds do not become claimable before terminal settlement; reopened-case bond refunds are claimable when the reopen transition completes. |

### Bounded parameters implemented in V2

- Bounty: `0.001`–`10` GEN; contributor/challenger bond: `max(0.0001 GEN, 1% of bounty)`.
- Challenge period: one hour for admission; each admitted challenge retains a full 20-minute reveal timeout even when that timeout ends after the admission deadline.
- Challenge review: 30-minute timeout; recovery after unavailable/timed-out review: 30 minutes.
- Maximum challenge attempts per provisional decision: eight.
- Case duration: 30 minutes to 14 days; maximum 40 active evidence submissions and 40 queued adjudications per case.

## Rationale and authorization boundary

The rules make an invalid challenge costly without introducing a treasury or administrator, preserve the challenger’s bond when a valid counterfact is not outcome-changing, and prevent either side from withdrawing the same bounty. The bounded recovery window prevents an unavailable validator/source from locking escrow forever.

The project owner approved the rules above on 2026-10-14. Their implementation, tests, deployment evidence, and current security limitation are tracked in [`CHALLENGE_V2.md`](CHALLENGE_V2.md) and [`CHALLENGE_V2_RELEASE_EVIDENCE.md`](CHALLENGE_V2_RELEASE_EVIDENCE.md). Approval of the economic rules and original setup deployment does not authorize funded cases, a replacement deployment, production environment changes, or Vercel publication; those remain separate actions requiring explicit approval.

No V1 contract, V1 deployment, production environment variable, production traffic, or Vercel production deployment is changed by this specification.

## V2.1 security addendum

The V2.1 source candidate preserves the approved economic rules and adds lifecycle safety constraints:

- Four pending challenge commitments are allowed per provisional round. A fifth commitment is rejected until an abandoned commitment expires or a settled review removes a slot. Challenge attempts remain capped at eight per round; historical records are never erased.
- Admission is open until the actual one-hour challenge deadline. A commitment accepted before that deadline receives its own full 20-minute reveal timeout. This prevents a late honest challenger from being admitted but unable to reveal.
- Revealed challenges enter a bounded sequential review queue. A case cannot finalize while any committed, queued, or review-pending challenge remains actionable. Source-unavailable and review-timeout recovery deadlines are monotonic, and finalization waits for them even if a later queued review settles first.
- Expiration is reconciled against the complete unresolved set. Expiring an unrelated commitment cannot clear an active review or queued review; active pointers, queue membership, review deadlines, recovery deadlines, and finalization eligibility are rebuilt consistently after manual and automatic cleanup.
- The adjudicator receives the exact challenged evidence ID and must return the same ID. An overturn removes only that exact item from the active graph and stores the source, counterclaim, target and basis in `final_decision_evidence`. A verified closing fact that is not itself challenged is shown as `VERIFIED_NON_CLOSING`, not as disproven.
- The shared frontend write path is one-shot for all V1 and V2 writes. Read-only RPC calls may retry; state-changing calls are never automatically retried after an ambiguous response. Concurrent identical requests are deduplicated, and the UI tells the user to reconcile authoritative state before retrying.

These constraints were deployed and independently verified as the immutable V2.1 contract layer on Studionet in [`challenge-v2-1-studionet.json`](../deployments/challenge-v2-1-studionet.json). No funded V2.1 lifecycle is claimed. The subsequent cross-round forfeiture correction, protected appeal, and withdrawal-receipt policy are deployed as V2.2 in [`challenge-v2-2-studionet.json`](../deployments/challenge-v2-2-studionet.json); no funded V2.2 lifecycle is claimed yet.
