# Crux Challenge V2

> **Superseded security record (2026-10-15):** The V2.1 audit found that the original remediation removed only the provisional closing submission, while a challenge can target any decisive evidence ID. V2's adjudicator also was not passed the selected target. See [`CHALLENGE_V2_1_RELEASE_CANDIDATE.md`](CHALLENGE_V2_1_RELEASE_CANDIDATE.md) for the corrected review binding, invalidation rules, tests, and isolated deployment path. This original document remains for V2 design/economic history; its V2 deployment runbook is superseded and must not be used for replacement deployment.

## Status and scope

Challenge V2 is a separately implemented protocol. The owner approved its economic rules on 2026-10-14. Its four contracts are deployed on Studionet chain `61999`, and the production frontend is configured to the V2 Registry. The Registry readback shows zero cases, submissions, challenges, escrow, bonds, credits, and withdrawals. No funded V2 lifecycle has been demonstrated. Read-only deployment evidence is in [`CHALLENGE_V2_RELEASE_EVIDENCE.md`](CHALLENGE_V2_RELEASE_EVIDENCE.md).

**Release status: NOT READY.** The deployed Registry has an evidence-graph integrity defect on challenge overturns. Its prior local correction removed only the closing submission; it did not reliably remove the exact challenged fact when the challenge named an earlier decisive item, and the adjudicator did not receive the target ID. The V2.1 candidate corrects both paths, but no corrected contract is deployed. No funded case or challenge should be created on the current deployment.

This work does not modify the deployed Registry, EvidenceVerifier, ClosureJudge, their addresses, V1 data, production environment variables, or Vercel. The existing three-contract V1 trust architecture remains unchanged. V2 is an additive four-contract architecture because counterevidence review is a new adjudication responsibility.

## Product behavior

V1 pays a contributor as soon as a verified fact makes the case decidable. V2 adds a provisional settlement stage:

1. A sponsor opens a bounded case with an incomplete official baseline and locks a bounty.
2. The Registry asks validators to verify the baseline. Only an `INSUFFICIENT_EVIDENCE` baseline opens the case.
3. A contributor commits a hash-bound source/fact/salt packet, then reveals after the commit is finalized.
4. The V2 Evidence Verifier fetches the source and checks six fields: same subject, policy-admissible source, claim support, time scope, material novelty, and non-contradiction.
5. The V2 Closure Judge applies the original decision rule to the verified evidence graph. A decisive result becomes `PROVISIONAL_CLOSURE`; bounty and winner bond remain locked for the one-hour challenge window.
6. A different wallet may commit and reveal a bounded challenge against the provisional decision. Up to four pending commitments can coexist, abandoned work is permissionlessly cleaned up, and revealed challenges are reviewed sequentially. The Challenge Adjudicator independently fetches and evaluates source admissibility, claim support, same subject/time scope, contradiction, materiality, and whether the original rule changes outcome.
7. Rejected or immaterial challenges do not change the provisional result. A successful challenge to the opposite decisive outcome becomes `CHALLENGE_RESOLVED`; a challenge that makes the evidence insufficient reopens the case while preserving the bounty.
8. Permissionless finalization settles bounty and refundable bonds into recipient-bound credits. Users separately withdraw their own credit.

Exact approved parameters and settlement cases are in [`CHALLENGE_V2_SPEC.md`](CHALLENGE_V2_SPEC.md).
The separate, unexecuted Studionet validation checklist is [`CHALLENGE_V2_LIVE_SMOKE_TEST.md`](CHALLENGE_V2_LIVE_SMOKE_TEST.md); it requires separate approval for funded test writes.

## Trust boundaries and contracts

| Component | Authority and responsibility | What it cannot do |
|---|---|---|
| `CruxChallengeRegistry` | Owns case state, deadlines, commits/reveals, escrow, evidence graph, authenticated callbacks, challenge status, credits, and final settlement. It binds the three child addresses once during deployment. | Cannot replace child contracts after one-time bootstrap; has no operator verdict override or protocol fee. |
| `ChallengeEvidenceVerifier` | Fetches candidate evidence and independently replays the six-field verification decision. | Cannot move funds or write Registry storage except through its authenticated callback. |
| `ChallengeClosureJudge` | Tests the prior verified graph remains insufficient, then judges the expanded graph against the original rule. | Cannot verify a candidate source or settle funds. |
| `ChallengeAdjudicator` | Fetches challenge evidence and assesses whether it contradicts/materially changes the provisional result under the original rule. | Cannot decide challenge state or settle funds; only the Registry accepts its authenticated callback. |

All child contracts are pinned to the Registry constructor address. The Registry deployment uses an empty bootstrap configuration followed by a one-time `configure_components` call from the deployer. There is no V2 admin setter after configuration.

V1 and V2 have distinct registries, child addresses, manifests, and frontend configuration. The V2 route reads only `NEXT_PUBLIC_CHALLENGE_REGISTRY_ADDRESS`; the V1 route continues to read its existing V1 variables. Production currently points the V2 route to `0x1BBec07518527A73e35333cD0d266ED20D032c6f`; no Vercel settings or production environment variables were changed during this audit.

## State and money safety

- `total_deposited = case_escrow + bond_escrow + total_claimable + total_withdrawn` is checked by `get_stats` and tested after settlement paths.
- A provisional decision is not a final result: no bounty or original evidence bond is credited while its challenge window/review remains active.
- Refundable challenge bonds remain in escrow through a provisional result or timeout recovery; credits are created at finalization. On an insufficient-evidence overturn, the case reopens and both contributor bonds are credited while the bounty remains escrowed.
- Invalid and unrevealed challenge bonds are withheld until finalization and credited to the final beneficiary. Failed or late callbacks cannot change a settled challenge.
- A challenged verdict cannot be finalized while `pending_challenge` is set. Every challenged evidence ID must belong to the evidence set used by the provisional decision. Sponsor and provisional winner cannot challenge.
- Challenge attempts are capped at eight per provisional decision. Up to four pending commitments coexist; admission ends at the one-hour deadline, while each admitted commitment retains its full 20-minute reveal timeout. Reveal and review timeouts have bounded recovery paths that cannot shorten the original challenge window.
- Credit withdrawals require the transaction sender to equal the recipient, clear the credit before the external transfer, and cannot be repeated against the same balance.
- Commitments bind chain `61999`, the V2 Registry address, case, decision/evidence IDs as applicable, wallet, source, fact, and salt. Salts and unrevealed claims are stored in browser local storage only until reveal; disconnecting or changing wallets does not intentionally erase them.
- The V2.1 Registry removes the exact challenged item from `accepted_evidence` on either successful overturn, preserves submission/challenge history, and clears stale close pointers when reopening. The adjudicator receives and replays the exact target ID, and the Registry requires its callback to echo that same ID. The deployed V2 Registry lacks these protections; this is a release-blocking mismatch, not a live safeguard.

## Threat model and remaining assumptions

| Threat | Mitigation | Residual risk / operational note |
|---|---|---|
| Prompt injection in case text, source, or claimed fact | Prompts treat all user/source text as data; verifier and adjudicator validate structured fields and replay substantive decision fields. | LLM consensus is still a source-grounded judgment, not a mathematical proof of truth. Carefully bound questions and use primary sources. |
| Fake, irrelevant, stale, or duplicate evidence | Six-field source check, accepted-evidence context, time-scope test, commitment replay protection, and case+fact reservation. Local remediation also removes overturned decisive evidence from the active graph on reopen. | **The deployed Registry still retains that overturned evidence in its active graph after an insufficient-evidence overturn. Do not use the current V2 deployment for funded cases.** Validators may also disagree about ambiguous source language or policy. |
| Unauthorized component callback | One-time fixed child addresses; each callback checks its exact configured sender and the pending stage. | Deployment/bootstrap mistakes remain security-critical; verify every child constructor address and Registry schema before funding. |
| Callback replay or late result | Child records are keyed by request ID; duplicate writes reject; Registry ignores already-settled callback stages and checks pending IDs/status. | A callback that never arrives uses explicit timeout/recovery; it is not silently treated as a positive verdict. |
| Early/duplicate payout or wrong recipient | Escrow invariant, delayed finalization, one-time bond release flags, pending penalties, sender-bound credit withdrawal. | No funded end-to-end V2 test has run; separately, the deployed evidence-graph defect prevents calling the release secure. |
| Challenge griefing | Exact contributor bond, bond forfeiture for invalid/unrevealed challenge, four pending slots, permissionless cleanup, one-hour admission window, per-commit 20-minute reveal bound, eight-attempt-per-round cap. | A valid challenge can delay resolution during independent review; timeout recovery bounds the delay. |
| Web source unavailable or evaluator timeout | Retryable baseline path, challenge review deadline, bounded recovery period, and bond treatment defined in the approved spec. | The V2 funded lifecycle and real validator timings remain unverified. |
| URL redirects or malicious downstream content | Validators fetch sources, use explicit source policy, and treat fetched bytes as untrusted data. | Current web render interface does not prove the final redirect host. Prefer stable first-party URLs; do not claim redirect-chain verification. |
| Wallet switching during a pending transaction | Shared EIP-1193 wallet context, accounts/chain event listeners, stale-response generation checks, and a fresh account/chain check before signing. | Wallet providers can change state between the final account read and their own signature UI; users must verify the account/network shown by the wallet. |
| Lost reveal salt | Browser warns to preserve site data, secrets are kept per commitment, and wallet disconnect does not clear them. | Clearing browser storage or changing browser/device before reveal is unrecoverable by design; do not share the salt before commit finality. |

## Demo guide (blocked until the Registry fix is deployed and verified)

Do not perform this demo on the current deployment: the deployed Registry has the reopen evidence-reuse defect documented above. After a corrected Registry is deployed and independently verified under separate authorization, use three distinct Studionet wallets per case: sponsor, original contributor, and challenger. Do not reuse the sponsor or provisional winner as challenger. Select legitimate source sets before requesting approval for funded writes.

1. Confirm the corrected V2 Registry address appears in the V2-only manifest and explorer, and use an isolated preview/local frontend configuration.
2. Connect wallet A through the injected EIP-1193 provider on Studionet chain `61999`. Create a case with one to three official baseline facts that leave the rule insufficient.
3. Wait for `OPEN`. From a non-sponsor contributor wallet, enter the first-party source and one exact decisive fact; commit and wait for finality before revealing from the same browser profile.
4. Show the V2 verifier result and the case entering `PROVISIONAL_CLOSURE`. Point out the one-hour deadline and locked bounty/bond.
5. Switch to wallet B. Commit a challenge against the provisional evidence with a public, admissible counterfact. Wait for commit finality; then reveal using the same browser profile that holds the salt.
6. Show `CHALLENGE_REVIEW`, then the independent review status and basis. For a successful decisive challenge, permissionlessly finalize after the adjudicator returns `VERDICT_OVERTURNED` to the opposite decisive outcome.
7. Verify the case is `CLOSED`, the final outcome is the challenged outcome, the bounty and bonds are claimable by the appropriate wallets, and each wallet withdraws only its own credit.
8. Record explorer URLs for all contract deployments and transaction hashes for case creation, baseline, evidence commit/reveal, provisional closure, challenge commit/reveal/review, finalization, and withdrawals. Do not edit evidence or omit an unsuccessful transaction from the record.

An overturn to `INSUFFICIENT_EVIDENCE` is a successful *challenge* but a reopened case, not a final winning demo. For that path verify `REOPENED`, both bond credits, preserved bounty escrow, and subsequent `OPEN` status after `reopen_case`.

## V2.1 hardening record

The independent audit reproduced and corrected six classes of risk in the source candidate:

1. **Challenge monopolization:** the exclusive pending slot became four bounded slots with deterministic expiry and a sequential review queue.
2. **Premature recovery finality:** source-unavailable and review-timeout recovery deadlines are monotonic and finalization always waits for the original challenge deadline plus any outstanding recovery deadline.
3. **Ambiguous writes:** read RPCs retain bounded retries, while state-changing writes use one-shot submission, in-flight deduplication, fresh wallet/network checks, and an explicit unknown-submission-status error. The V1 helper remains the same public path.
4. **Round accounting:** each provisional decision resets the attempt counter without erasing historical challenge IDs.
5. **Evidence consistency:** the exact challenged evidence ID is passed to the adjudicator and echoed by the authenticated callback; successful overturns remove only that exact item from the active graph and preserve final-decision provenance.
6. **Status consistency:** an earlier verified fact can become `VERIFIED_NON_CLOSING` when a different decisive item is overturned; it is not falsely labelled disproven.

The candidate does not change V1 contracts or the approved economic terms. It remains un-deployed and must not be represented as live remediation.

## Verification performed locally (not proof of deployed remediation)

Run before any deployment:

```powershell
pytest -p no:cacheprovider tests/direct -q
cd frontend
npm test
npm run typecheck
npm run build
```

The pinned GenVM semantic linter passed all seven V1/V2.1 contracts with `GENVM_VERSION=v0.2.12`; the expanded direct suite passed `53` tests, frontend tests passed `37`, frontend typecheck, ESLint, production build, and deployment-entrypoint TypeScript checks passed. These are local results, not proof that the updated Registry is on-chain. The Studionet integration test was intentionally not run because it deploys contracts and submits writes. No V2.1 deployment, funded case, challenge settlement, withdrawal, or V2.1 hosted execution is claimed.

## Deployment runbook — do not execute without separate approval

The GenLayer CLI loads every TypeScript/JavaScript file in the root `deploy/` directory in filename order. The V2 deployment script is intentionally gated by `CRUX_DEPLOY_V2_ONLY=1`; the existing V1 deploy script explicitly skips when that flag is set. The V2 script refuses any client whose chain ID is not `61999` or whose effective RPC is not `https://studio.genlayer.com/api`. It persists transaction hashes and partial progress. Recovery accepts only a deployment's recorded `*_SUBMITTED` or `*_FINALIZED` checkpoint; it verifies each saved receipt, sender, and exact deployed source hash before continuing. Ambiguous `*_DEPLOYING` or configuration-call stages are refused.

### Expected transactions, costs, and rollback

- Minimum contract setup is **five on-chain writes**: deploy the V2 Registry, Evidence Verifier, Closure Judge, and Challenge Adjudicator (four deployment transactions), then call `configure_components` once. A real demo additionally needs the case-creation deposit and the baseline, evidence commit/reveal, provisional-close, challenge commit/reveal/review, finalization, and credit-withdrawal transactions described above.
- No fixed GEN total is quoted here: the current supported CLI/SDK path exposes no reliable preflight fee quote for these GenVM executions, and actual consensus/execution charges can vary. The submitter must review the wallet's displayed cost for every write and fund only after separate deployment/demo approval. The number of writes is not a fee estimate.
- **Isolation/rollback:** V1 addresses, data, environment variables, and production aliases remain untouched. The current production build has the V2 Registry configured. Do not change its environment or publish a new frontend without separate approval. Because the contract is immutable, a corrected V2 implementation needs an approved replacement deployment and a separately approved frontend configuration/publication. V1 variables and contracts must remain unchanged. Deployed contracts and finalized transactions are not reversible; rollback means disabling V2 access in a separately approved change and preserving all manifests/receipts.

After approval, from the repository root and an unlocked CLI:

```powershell
genlayer network set studionet
genlayer network info   # confirm chain 61999 and https://studio.genlayer.com/api
$env:CRUX_DEPLOY_V2_ONLY = "1"
genlayer deploy         # V2 script runs; V1 deploy script skips
Remove-Item Env:CRUX_DEPLOY_V2_ONLY
```

If a transaction fails or the command is interrupted, do not blindly rerun deployment. Inspect the saved `deployments/challenge-v2-studionet.json` partial manifest, transaction receipts/traces, and the explorer first; reconcile the exact completed stage before any resumed write. The runner resumes only a validated deployment checkpoint and never repeats a recorded transaction. Each setup write requires `FINALIZED` plus either `FINISHED_WITH_RETURN` or a Studio `AGREE`/`MAJORITY_AGREE` result with successful leader execution, a matching validator majority, and only successful validator executions or nonfatal idle `VALIDATOR_QUORUM_REACHED` receipts. The runner then writes `status: DEPLOYED_PENDING_VERIFICATION` rather than claiming full readiness. Independently verify all four addresses, compare source hashes with the deployed transaction input, check Registry constructor bindings, the finalized `configureTxHash`, every child `registry_address`, and V2 Registry `get_stats` including zero initial escrow and balanced accounting. Only after those readbacks succeed should the manifest status be changed to `READY`; if any check is ambiguous, preserve the pending status and stop.

The existing V2 deployment is independently verified at the transaction/address/schema/binding level but is not security-certified after the reopen finding. Do not run the deployment script or change production configuration as part of this audit; any replacement contract and frontend publication require separate explicit approval.
