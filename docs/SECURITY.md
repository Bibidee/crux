# Security and failure model

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

## Redirect limitation

Current GenVM web helpers can retrieve/render a URL but do not give this contract a redirect-chain attestation. A requested first-party URL that redirects elsewhere therefore cannot be proven by Crux to have stayed on the intended host. Keep this limitation visible in docs and do not claim otherwise. Strong source policies should use stable first-party canonical URLs. If a future GenVM API exposes redirect metadata, add explicit final-host validation and regression tests before changing this statement.

## Browser secret

The reveal salt is deliberately not uploaded to a server. It lives in local storage until the second signature. This removes a backend secret store but means clearing browser data before reveal can make a valid commitment unrecoverable. The UI warns the contributor.
