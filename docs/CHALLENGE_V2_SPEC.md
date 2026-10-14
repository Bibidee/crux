# Crux Challenge V2 — Economic and Finality Specification

This document defines the proposed V2 rules before contract implementation. V1 remains unchanged and continues to use the deployed Registry, EvidenceVerifier and ClosureJudge.

## State machine

```text
OPEN
  -> PROVISIONAL_CLOSURE  (decisive evidence is verified)
  -> CHALLENGE_WINDOW     (challenge deadline is recorded)
  -> FINALIZED             (no valid challenge, permissionless finalize)
  -> CHALLENGE_REVIEW      (valid challenge is revealed)
  -> FINALIZED             (VERDICT_UPHELD or VERDICT_OVERTURNED)
  -> REOPENED              (VERDICT_OVERTURNED leaves the rule insufficient)
  -> OPEN
```

No provisional bounty or bond is withdrawable. Every transition is deadline-checked by the Registry and callbacks are authenticated, unique and idempotent.

## Proposed bounded economic rules

| Item | Proposed rule |
|---|---|
| Provisional bounty | Remains locked in case escrow until finalization. |
| Original contributor bond | Remains locked through the challenge window and review. Refunded when the verdict is upheld or the case reopens; paid with the final reward only when the original conclusion remains the final outcome. |
| Challenger bond | Fixed at the existing contributor-bond amount, bounded by the case terms and displayed before signing. |
| Invalid challenge | Challenge bond is forfeited to the final beneficiary; it cannot change the provisional result. |
| Valid but immaterial challenge | Challenge bond is refunded; provisional verdict remains eligible for finalization. |
| Successful overturn | Original contributor bond is refunded. Challenger receives the bounty and challenger bond refund only after finalization. |
| Reopened case | Both contributor bonds are refunded; bounty remains escrowed for later evidence. The original close deadline is extended by one bounded challenge-recovery window. |
| Review timeout | Review is marked inconclusive, challenger bond is refunded, and the provisional verdict becomes finalizable only after the explicit recovery deadline. |
| Withdrawal | Pull-based, recipient-bound, one-time credits only after FINALIZED settlement. |

### Why this default

The rules make an invalid challenge costly without introducing a treasury or administrator. They preserve the challenger’s bond when the challenge is factually valid but not outcome-changing, and they prevent either side from withdrawing the same bounty. The bounded recovery window prevents an unavailable validator/source from locking escrow forever.

## Approval required before contract implementation

The challenger-bond penalty and the distribution of a successful challenge materially affect contributor rights. Implementation should begin only after the project owner approves the proposed rules above, or specifies a replacement policy for:

1. invalid challenge bond destination;
2. successful overturn beneficiary;
3. reopened-case bounty custody and deadline extension;
4. challenge-review timeout recovery.

No V2 contracts, production environment variables, V1 deployments or production traffic are changed by this specification.
