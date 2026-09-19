# Crux architecture

## Trust boundary

```text
┌──────────────── browser ────────────────┐
│ Next.js UI                             │
│ injected EIP-1193 wallet only          │
│ local salt until reveal                │
└──────────────────┬─────────────────────┘
                   │ signed writes / reads
                   ▼
┌──────────────── GenLayer Studionet 61999 ──────────────────────────────┐
│                                                                        │
│  CruxRegistry                                                         │
│  ├─ immutable verifier/judge addresses                                │
│  ├─ bounty + bond escrow                                              │
│  ├─ baseline gate                                                     │
│  ├─ commit/reveal reservation                                         │
│  ├─ accepted evidence graph                                           │
│  └─ credits / expiry / settlement                                     │
│       │ finalized message                         │ finalized message  │
│       ▼                                           ▼                    │
│  EvidenceVerifier                            ClosureJudge              │
│  ├─ live web fetch                           ├─ verified facts only    │
│  ├─ source policy                            ├─ original decision rule │
│  ├─ claim support                            ├─ A / B / insufficient   │
│  ├─ time scope                               └─ independent replay     │
│  ├─ novelty + contradiction                                           │
│  └─ independent replay                                                │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
                   │
                   ▼
              public web sources
```

No backend decides a case, verifies a source, or allocates a bounty. A static hosting platform may serve the Next.js frontend, but it is not part of the trust path.

## Baseline gate

A sponsor cannot create an arbitrary bounty and label it “unresolved.” `create_case` first stores the funded case as `BASELINE_PENDING`. After the parent transaction finalizes, the Registry queues `validate_baseline` to itself. Leaders and validators independently fetch each baseline URL and verify the sponsor's claimed facts. The result must be:

- `READY + INSUFFICIENT_EVIDENCE` → case opens;
- invalid baseline → sponsor credit;
- already decisive → sponsor credit;
- unavailable/transient baseline → retryable state.

## Evidence verification

`EvidenceVerifier` does not decide A or B. It answers six separate questions. Validators independently fetch the URL and repeat the semantic evaluation. Consensus compares the six booleans and status, not the prose basis.

A candidate is `VERIFIED` only when all six are true:

1. `same_subject`
2. `source_allowed`
3. `claim_supported`
4. `correct_time_scope`
5. `materially_new`
6. `non_contradictory`

Reveals are accepted independently of another submission's stage. Each case
maintains at most 40 active commitments and a FIFO adjudication queue. The
queue head is the only submission sent to the verifier/judge; when it reaches a
terminal state, the next revealed submission starts. A queued reveal is an
objective protocol-blocked state, so its bond is returned if the case closes or
expires before it can run. A sealed `COMMITTED` submission that had a valid
opportunity but was never revealed remains deliberate non-participation and its
bond is credited to the sponsor. Active IDs and the pending head are stored in
the case record, so new writes do not scan unbounded submission history.

## Closure

`ClosureJudge` receives the accepted graph plus the verified candidate. It does not fetch the web again; source grounding has already occurred in a separate contract. It applies the fixed rule and can return:

- `OUTCOME_A`
- `OUTCOME_B`
- `INSUFFICIENT_EVIDENCE`

Only A/B closes the case. Insufficient evidence adds the verified candidate to the graph and leaves the market open.

## Economic paths

| Path | Contributor bond | Bounty |
|---|---|---|
| verified + closes | refunded to contributor | contributor |
| verified + non-closing | refunded to contributor | remains escrowed |
| source unavailable | refunded to contributor | remains escrowed |
| consensus stage timeout | refunded to contributor | remains escrowed |
| rejected evidence | sponsor | remains escrowed |
| commit never revealed | sponsor | remains escrowed |
| case expires | pending stages settle independently | sponsor credit |

When a different contributor closes the case, unrevealed commitments are
settled before the winner is finalized: sealed commitments go to the sponsor,
while revealed queued or pending commitments go back to their contributors.
Every path marks the submission settled and releases active capacity once.

Credits use pull withdrawals so an external transfer failure cannot interrupt the semantic state transition.
