# Security and failure model

## Challenge V2 release blocker (2026-10-15)

The deployed Challenge V2 Registry at [`0x1BBec07518527A73e35333cD0d266ED20D032c6f`](https://explorer-studio.genlayer.com/address/0x1BBec07518527A73e35333cD0d266ED20D032c6f) permits a challenge against any decisive evidence ID, but its previous fix removed only the provisional closing submission. When a challenge targeted an earlier decisive fact, that fact remained in the accepted graph after an overturn and reopen; it could still be cited by a later closure. The adjudicator also did not receive the selected target, so it could not bind the counterclaim to the fact the challenger committed to challenge. The deployed source hash and setup transactions are preserved in [`CHALLENGE_V2_RELEASE_EVIDENCE.md`](CHALLENGE_V2_RELEASE_EVIDENCE.md).

V2.1 removes the exact challenged evidence ID from the active graph on both insufficient-evidence and opposite-outcome overturns, passes that ID to the child adjudicator, requires an exact callback match, preserves history, and clears stale closure references when reopening. Regression tests cover an earlier decisive submission, the retained valid evidence, stale-ID rejection, both overturn outcomes, and accounting conservation. This correction is **not** in the deployed immutable Registry. The current V2 deployment must not be used for funded cases until all four V2.1 contracts are separately authorized, deployed, and independently verified. V1 is unaffected.

V2.1 also reconciles concurrent challenge cleanup from the complete unresolved set. Manual expiration and permissionless automatic cleanup cannot clear another challenge's active review, queued review, recovery deadline, or finalization guard; an expired commitment is settled independently and the surviving pointers are rebuilt before the next review is promoted.

## V2.1 economic audit (2026-10-16)

The deployed V2.1 Registry remains immutable at [`0xA258Ef6f5e2ACB3512c37ACC71544D94Caa7520c`](https://explorer-studio.genlayer.com/address/0xA258Ef6f5e2ACB3512c37ACC71544D94Caa7520c). A direct GenVM reproduction confirmed that a rejected challenge followed by an insufficient-evidence overturn and a later provisional round reset `pending_invalid_challenge_penalty_atto` while the bond remained in `bond_escrow`. The source correction carries that case-level obligation across every reopening and later provisional decision; it is regression-tested locally and is **not deployed**. The candidate is preserved as [`deployments/challenge-v2-2-studionet.json`](../deployments/challenge-v2-2-studionet.json) with `NOT_DEPLOYED` status.

The bounded `MAX_CHALLENGES = 8` rule was also reproduced: eight rejected attempts can consume the round budget and deny a late honest challenger during the still-open admission window. This is an accepted permissionless bounded-liveness limitation in the current economic rules, not a silently changed policy. Fixing it would require an explicit decision about reserved slots, admission identity, or cap/slashing/beneficiary rules; V2.1 and the V2.2 source candidate do not claim to solve it.

## Prompt injection

Every nondeterministic prompt explicitly treats case text, page text, URLs, labels and evidence as untrusted data. Embedded system messages, role changes, instructions and claimed verdicts are ignored. Validators rerun the underlying task rather than only judging whether the leader returned valid JSON.

## Source failure

An unreachable source returns `SOURCE_UNAVAILABLE`; it is never coerced into `REJECTED`. The contributor bond is returned and the evidence reservation is released so the source can be tried again later.

## Consensus disagreement

The custom equivalence functions compare only substantive decision fields. If validators cannot reproduce those fields, the consensus transaction does not become an accepted semantic result. Pending Registry stages also have explicit timeouts; after timeout, anyone can mark the submission `INCONCLUSIVE` and release the contributor bond.

## Commit-reveal

The commitment binds:

```text
crux-v1
61999
registry address
case id
contributor address
evidence URL
claimed fact
32-byte salt
```

This prevents a watcher from taking a revealed source and winning by submitting it first. A commitment can only be used once.

## Replays and duplicates

The Registry maintains a commitment index and a case-scoped evidence reservation digest. A successful or rejected evidence packet cannot be repeatedly retried to hunt for a lucky validator outcome. `SOURCE_UNAVAILABLE` and stage timeout are the exceptions because they are operational non-decisions; their reservation is released.

## Money

- Bounty and bond ranges are bounded.
- Sponsor cannot compete for their own bounty.
- No arbitrary recipient is supplied during winner settlement.
- Credits are paid to the address already stored on the submission/case.
- Withdrawals zero credit before emitting the transfer.
- `get_stats().accounting_balanced` exposes the conservation invariant.

GenLayer `emit_transfer` is asynchronous and executes as an external finalized message. Official GenLayer documentation states that if a value-transfer child fails, the value is not automatically returned to the sender. Crux therefore clears a recipient-bound credit before emitting the transfer and prevents replay; `withdrawn_atto` records the accounted withdrawal dispatch, not independently proven recipient delivery. The local suite proves sender binding, one-shot credit clearing, and emitted transfer construction, but it cannot prove a rejecting external recipient's child outcome without a live write. Do not treat a contract-recipient withdrawal as delivery-safe until a supported recovery/receipt design is authorized and implemented; prefer ordinary EOA recipients.

## Redirect limitation

Current GenVM web helpers can retrieve/render a URL but do not give this contract a redirect-chain attestation. A requested first-party URL that redirects elsewhere therefore cannot be proven by Crux to have stayed on the intended host. Keep this limitation visible in docs and do not claim otherwise. Strong source policies should use stable first-party canonical URLs. If a future GenVM API exposes redirect metadata, add explicit final-host validation and regression tests before changing this statement.

## Browser secret

The reveal salt is deliberately not uploaded to a server. It lives in local storage until the second signature. This removes a backend secret store but means clearing browser data before reveal can make a valid commitment unrecoverable. The UI warns the contributor.
