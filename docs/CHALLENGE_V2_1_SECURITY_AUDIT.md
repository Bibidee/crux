# Crux Challenge V2.1 security audit

Audit date: 2026-10-16  
Branch: `challenge-v2`  
Audit baseline: `651c5cec2c882d6dd3d26623cd81280a12c11830`  
Network scope: Studionet chain `61999`, `https://studio.genlayer.com/api`

This audit is source-level and read-only against the existing immutable V2.1 deployment. It does not create a case, spend GEN, submit challenge bonds, withdraw credit, modify production configuration, or publish Vercel.

## Findings and classifications

| Finding | Classification | Evidence | Disposition |
|---|---|---|---|
| Forfeited challenge bonds could lose their allocation after an insufficient-evidence reopen and later provisional round | Reproduced; fixed in source; regression-tested; not deployed; not live verified | Deterministic direct GenVM sequence showed `pending_invalid_challenge_penalty_atto` reset to `0` while the same bond remained in `bond_escrow` | V2.2 candidate carries the case-level obligation across rounds and terminal settlement |
| Eight rejected attempts can consume the bounded challenge budget while the one-hour window remains open | Reproduced; accepted protocol-design limitation; not fixed; not deployed | Direct test consumes all eight attempts and a late honest challenger receives `challenge limit reached` | No cap, slashing, beneficiary, or identity-policy change was authorized; reserve-slot/per-identity alternatives require explicit economic approval |
| Frontend could keep showing challenge submission after admission deadline and hide finalization | Reproduced by source inspection; fixed in source; regression-tested; not published | Action helper requires `now < challenge_deadline`, uses authoritative `can_finalize`, and exposes cleanup/recovery actions | V2 frontend source is corrected; Vercel publication remains separately gated |
| External withdrawal child transfer may fail after local credit is cleared | Confirmed GenLayer semantic risk; no safe source fix claimed; not live verified | Official GenLayer docs state finalized value-transfer messages are asynchronous and a failed child does not automatically return value | Keep one-shot accounting; do not auto-replay; prefer EOAs and require an authorized receipt/recovery design before claiming contract-recipient delivery safety |

## Forfeited-bond reproduction

The reproduced sequence was:

1. Sponsor funds a provisional case; contributor B closes it.
2. Challenger C submits a challenge that is rejected. Its bond is forfeited and added to `pending_invalid_challenge_penalty_atto`.
3. Challenger D submits a material challenge that overturns to `INSUFFICIENT_EVIDENCE`.
4. The case reopens; D's bond and B's original contributor bond are refunded.
5. B submits a new fact and produces a new provisional closure.
6. Before the correction, the new closure reset the penalty allocation to zero. Finalization could pay the new bounty and bonds while the historical forfeited bond remained in global `bond_escrow` without a recipient.

The correction does not alter the approved beneficiary rule: rejected/unrevealed penalties remain pending at the case level and are allocated to the eventual final beneficiary, or to the sponsor on case-expiration refund. Direct tests also cover two successive reopenings, multiple historical forfeitures, terminal finalization, and expiration.

## Withdrawal semantics

The Registry's `withdraw_credit` authorization is recipient-bound, clears credit before emitting the transfer, increments `total_withdrawn`, and rejects a second withdrawal. The pinned direct runner does not expose the asynchronous external EVM child-transfer record, so local tests prove only state transition and one-shot authorization. The deployed code has not been changed to claim delivery confirmation.

## Deployment boundary

The V2.1 manifest and deployed source identity remain preserved in [`challenge-v2-1-studionet.json`](../deployments/challenge-v2-1-studionet.json). The corrected source hashes are recorded in [`challenge-v2-2-studionet.json`](../deployments/challenge-v2-2-studionet.json), which is explicitly `NOT_DEPLOYED`. A V2.2 deployment would require fresh addresses for the Registry and all three bound child contracts, a new five-write authorization, independent readback, and a separate production configuration decision.
