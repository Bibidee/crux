# Crux architecture

Crux has two deliberately separate contract products. V1 is the original three-contract evidence bounty product and
remains unchanged. Challenge V2.2 is the active four-contract challenge product described below. Historical V2 and V2.1
manifests remain readable for audit traceability, but are not targets for new cases.

## Shared trust boundary

```text
┌──────────────── browser ────────────────┐
│ Next.js UI                             │
│ injected EIP-1193 wallet only          │
│ local salt until reveal                │
└──────────────────┬─────────────────────┘
                   │ signed writes / reads
                   ▼
┌──────────────── GenLayer Studionet 61999 ──────────────────────────────┐
│                                                                       │
│  Challenge Registry                                                   │
│  ├─ case state, deadlines, escrow and credits                         │
│  ├─ baseline and commit/reveal reservations                           │
│  ├─ accepted evidence graph and round accounting                      │
│  └─ authenticated callback routing                                    │
│       │ finalized message              │ finalized message             │
│       ▼                              ▼                                 │
│  Evidence Verifier                 Closure Judge                       │
│  ├─ source policy                   ├─ original decision rule           │
│  ├─ live fact support               ├─ A / B / insufficient              │
│  └─ independent replay              └─ provisional result               │
│       ▲                              ▲                                 │
│       └────────────── Challenge Adjudicator ────────────────────────────┘
│                       exact challenged packet, bounded review           │
└────────────────────────────────────────────────────────────────────────┘
                   │
                   ▼
              public web sources
```

No backend decides a case, verifies a source, allocates a bounty, or signs a user transaction. Static hosting serves the
frontend but is not part of the trust path. The browser uses only the injected EIP-1193 provider exposed as
`window.ethereum`.

## V1: original product

V1 uses `CruxRegistry`, `EvidenceVerifier`, and `ClosureJudge`. The Registry owns the bounty and accepted evidence
graph; the verifier checks source-grounded evidence; and the judge applies the fixed decision rule. Its existing
deployment is preserved and is not modified by the V2.2 release.

## Challenge V2.2: four-contract product

V2.2 uses a fresh Registry, Evidence Verifier, Closure Judge, and Challenge Adjudicator. Every child stores and
authenticates its Registry address. The Registry authenticates callbacks by child sender, case, round, pending
operation, and exact evidence target; callbacks are unique and idempotent.

The complete lifecycle is:

1. `create_case` funds a `BASELINE_PENDING` case.
2. Baseline retrieval and decision either open an unresolved case or refund a baseline that is invalid/already decisive.
3. A contributor seals evidence with commit, then reveals the source, fact, and salt.
4. The Evidence Verifier checks admissibility, support, time scope, novelty, and contradiction through consensus.
5. The Closure Judge evaluates the accepted graph and returns a provisional A, B, or insufficient result.
6. During the provisional period, challengers reserve a bounded slot and commit/reveal counterevidence.
7. The Challenge Adjudicator reviews the exact challenged evidence packet and returns a bound verdict.
8. The Registry applies the verdict, either preserving the provisional result or reopening the case.
9. After all deadlines and recovery conditions are satisfied, permissionless finalization settles the bounty and bonds.
10. Recipients withdraw their credits once; the parent dispatch receipt is reconciled with the finalized child transfer.

The stored terminal case status is `CLOSED`. `FINALIZED` is a transaction/receipt finality signal, not a case state.

## Baseline gate

A sponsor cannot create an arbitrary bounty and label it unresolved. `create_case` stores the funded case as
`BASELINE_PENDING`; the Registry then queues baseline validation. Leaders and validators independently fetch each URL
and verify the sponsor's claimed facts. `READY + INSUFFICIENT_EVIDENCE` opens the case. An invalid or already decisive
baseline credits the sponsor, while an unavailable/transient result remains retryable.

## Evidence verification and concurrency

The Evidence Verifier does not decide A or B. It evaluates six boolean dimensions: same subject, allowed source, claim
support, correct time scope, material novelty, and non-contradiction. A submission is `VERIFIED` only when all six are
true. Revealed submissions are queued independently; at most 40 active commitments are retained and the FIFO head is
sent to the verifier/judge. Timely queued or pending work is refunded if protocol closure prevents it from running.
Expired sealed commitments are deliberate non-participation and settle to the sponsor. Active IDs and the pending head
are stored so new writes do not scan unbounded history.

## Challenge economics and bounds

The approved V2.2 challenge policy is explicit:

- eight normal challenge attempts per provisional decision;
- one additional protected appeal after the normal cap, priced at twice the normal challenge bond;
- at most four simultaneous pending challenge commitments;
- one-hour challenge admission;
- a full reveal timeout for every admitted commitment, even when it passes the admission deadline;
- bounded review and recovery deadlines;
- per-round challenge accounting so prior forfeitures remain attached to the case and cannot be silently reset.

The provisional bounty and original evidence bond remain locked through challenge and review. Invalid/unrevealed
challenge bonds are forfeited to the eventual final beneficiary; valid but immaterial challenges are refunded; a
successful overturn reopens the case without releasing the bounty. Finalization settles each obligation exactly once.

## Closure, settlement, and withdrawal

`ClosureJudge` receives the accepted graph and verified candidate; it does not fetch the web again. Only A/B closes a
normal evidence round. Insufficient evidence adds the verified fact and leaves the market open. A challenge verdict can
preserve the provisional result or reopen the case.

Credits use recipient-bound pull withdrawals. Each dispatch clears the credit before sending and persists an immutable
`DISPATCHED_UNVERIFIED` receipt with automatic replay disabled. GenLayer external value transfers are asynchronous
finalized messages, so the receipt is an accounting dispatch record rather than proof that a rejecting contract recipient
received value. The supported evidence path is an ordinary EOA recipient followed by explorer/child-message
reconciliation.

## Deployment boundary

All writes are locked to Studionet chain `61999` and RPC `https://studio.genlayer.com/api`. The auto-discovered deploy
folder is fail-closed: normal CLI execution skips every release, version-specific authorization is required, existing
manifests are protected from overwrite, and ambiguous submitted/deploying stages are not retried blindly. The current
V2.2 deployment must not be rerun as part of documentation or test work.
