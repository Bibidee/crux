# Crux Challenge V2.1 security audit

> **Historical audit — superseded.** Findings and source-level conclusions below are preserved as an audit record for
> V2.1. They do not describe the active production target. The corrected V2.2 release and its executed scope are
> documented in [`CHALLENGE_V2_SPEC.md`](CHALLENGE_V2_SPEC.md), [`LIVE_DEMO.md`](LIVE_DEMO.md), and
> [`REVIEW_EVIDENCE.md`](REVIEW_EVIDENCE.md).

Audit date: 2026-10-16  
Branch: `challenge-v2`  
Audit baseline: `651c5cec2c882d6dd3d26623cd81280a12c11830`  
Network scope: Studionet chain `61999`, `https://studio.genlayer.com/api`

This audit is source-level and read-only against the existing immutable V2.1 deployment. It does not create a case, spend GEN, submit challenge bonds, withdraw credit, modify production configuration, or publish Vercel.

## Findings and classifications

| Finding | Classification | Evidence | Disposition |
|---|---|---|---|
| Forfeited challenge bonds could lose their allocation after an insufficient-evidence reopen and later provisional round | Reproduced; fixed in source; regression-tested; not deployed; not live verified | Deterministic direct GenVM sequence showed `pending_invalid_challenge_penalty_atto` reset to `0` while the same bond remained in `bond_escrow` | V2.2 candidate carries the case-level obligation across rounds and terminal settlement |
| Eight rejected attempts can consume the bounded challenge budget while the one-hour window remains open | Reproduced; fixed in V2.2 source; regression-tested; not deployed at audit baseline | Direct test consumes all eight attempts, then a new challenger uses the one-shot protected appeal at 2× bond | Evaluated work remains bounded at nine admitted attempts; the protected slot is a deliberate approved economic policy |
| Frontend could keep showing challenge submission after admission deadline and hide finalization | Reproduced by source inspection; fixed in source; regression-tested; not published at audit baseline | Action helper requires `now < challenge_deadline`, uses authoritative `can_finalize`, and exposes cleanup/recovery actions | V2 frontend source is corrected; Vercel publication remains separately gated |
| External withdrawal child transfer may fail after local credit is cleared | Confirmed GenLayer semantic risk; mitigated in V2.2 source; not delivery-verified at audit baseline | Official GenLayer docs state finalized value-transfer messages are asynchronous and a failed child does not automatically return value | V2.2 records `DISPATCHED_UNVERIFIED`, forbids automatic replay, and exposes a receipt; ordinary EOAs plus explicit child-receipt reconciliation are the supported path |

## Forfeited-bond reproduction

The reproduced sequence was:

1. Sponsor funds a provisional case; contributor B closes it.
2. Challenger C submits a challenge that is rejected. Its bond is forfeited and added to `pending_invalid_challenge_penalty_atto`.
3. Challenger D submits a material challenge that overturns to `INSUFFICIENT_EVIDENCE`.
4. The case reopens; D's bond and B's original contributor bond are refunded.
5. B submits a new fact and produces a new provisional closure.
6. Before the correction, the new closure reset the penalty allocation to zero. Finalization could pay the new bounty and bonds while the historical forfeited bond remained in global `bond_escrow` without a recipient.

The correction does not alter the approved beneficiary rule: rejected/unrevealed penalties remain pending at the case level and are allocated to the eventual final beneficiary, or to the sponsor on case-expiration refund. Direct tests also cover two successive reopenings, multiple historical forfeitures, terminal finalization, and expiration. V2.2 additionally gives a new challenger one protected appeal slot after the normal cap, priced at twice the normal bond.

## Withdrawal semantics

The Registry's `withdraw_credit` authorization is recipient-bound, clears credit before emitting the transfer, increments `total_withdrawn`, and persists a `DISPATCHED_UNVERIFIED` receipt with automatic replay disabled. The pinned direct runner does not expose the asynchronous external EVM child-transfer record, so local tests prove state transition, one-shot authorization, and receipt persistence—not recipient delivery. A V2.2 live withdrawal must be reconciled through the parent transaction's triggered child record before delivery is reported.

## Deployment boundary

The V2.1 manifest and deployed source identity remain preserved in [`challenge-v2-1-studionet.json`](../deployments/challenge-v2-1-studionet.json). The corrected source hashes are recorded in [`challenge-v2-2-studionet.json`](../deployments/challenge-v2-2-studionet.json). The V2.2 deployment requires fresh addresses for the Registry and all three bound child contracts, five Studionet writes, independent readback, and a production configuration update.
