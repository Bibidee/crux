# Crux Challenge V2

## Status and scope

Challenge V2 is a separately implemented and tested protocol branch. The owner approved its economic rules on 2026-10-14. The four V2 contracts and the `/challenge` frontend are not deployed, are not configured in production, and have not accepted live funds. The live product remains V1.

This work does not modify the deployed Registry, EvidenceVerifier, ClosureJudge, their addresses, V1 data, production environment variables, or Vercel. The existing three-contract V1 trust architecture remains unchanged. V2 is an additive four-contract architecture because counterevidence review is a new adjudication responsibility.

## Product behavior

V1 pays a contributor as soon as a verified fact makes the case decidable. V2 adds a provisional settlement stage:

1. A sponsor opens a bounded case with an incomplete official baseline and locks a bounty.
2. The Registry asks validators to verify the baseline. Only an `INSUFFICIENT_EVIDENCE` baseline opens the case.
3. A contributor commits a hash-bound source/fact/salt packet, then reveals after the commit is finalized.
4. The V2 Evidence Verifier fetches the source and checks six fields: same subject, policy-admissible source, claim support, time scope, material novelty, and non-contradiction.
5. The V2 Closure Judge applies the original decision rule to the verified evidence graph. A decisive result becomes `PROVISIONAL_CLOSURE`; bounty and winner bond remain locked for the one-hour challenge window.
6. A different wallet may commit and reveal one challenge against the provisional decision. The Challenge Adjudicator independently fetches and evaluates source admissibility, claim support, same subject/time scope, contradiction, materiality, and whether the original rule changes outcome.
7. Rejected or immaterial challenges do not change the provisional result. A successful challenge to the opposite decisive outcome becomes `CHALLENGE_RESOLVED`; a challenge that makes the evidence insufficient reopens the case while preserving the bounty.
8. Permissionless finalization settles bounty and refundable bonds into recipient-bound credits. Users separately withdraw their own credit.

Exact approved parameters and settlement cases are in [`CHALLENGE_V2_SPEC.md`](CHALLENGE_V2_SPEC.md).

## Trust boundaries and contracts

| Component | Authority and responsibility | What it cannot do |
|---|---|---|
| `CruxChallengeRegistry` | Owns case state, deadlines, commits/reveals, escrow, evidence graph, authenticated callbacks, challenge status, credits, and final settlement. It binds the three child addresses once during deployment. | Cannot replace child contracts after one-time bootstrap; has no operator verdict override or protocol fee. |
| `ChallengeEvidenceVerifier` | Fetches candidate evidence and independently replays the six-field verification decision. | Cannot move funds or write Registry storage except through its authenticated callback. |
| `ChallengeClosureJudge` | Tests the prior verified graph remains insufficient, then judges the expanded graph against the original rule. | Cannot verify a candidate source or settle funds. |
| `ChallengeAdjudicator` | Fetches challenge evidence and assesses whether it contradicts/materially changes the provisional result under the original rule. | Cannot decide challenge state or settle funds; only the Registry accepts its authenticated callback. |

All child contracts are pinned to the Registry constructor address. The Registry deployment uses an empty bootstrap configuration followed by a one-time `configure_components` call from the deployer. There is no V2 admin setter after configuration.

V1 and V2 have distinct registries, child addresses, manifests, and frontend configuration. The V2 route reads only `NEXT_PUBLIC_CHALLENGE_REGISTRY_ADDRESS`; the V1 route continues to read its existing V1 variables. The V2 address is intentionally unset in production.

## State and money safety

- `total_deposited = case_escrow + bond_escrow + total_claimable + total_withdrawn` is checked by `get_stats` and tested after settlement paths.
- A provisional decision is not a final result: no bounty or original evidence bond is credited while its challenge window/review remains active.
- Refundable challenge bonds remain in escrow through a provisional result or timeout recovery; credits are created at finalization. On an insufficient-evidence overturn, the case reopens and both contributor bonds are credited while the bounty remains escrowed.
- Invalid and unrevealed challenge bonds are withheld until finalization and credited to the final beneficiary. Failed or late callbacks cannot change a settled challenge.
- A challenged verdict cannot be finalized while `pending_challenge` is set. Every challenged evidence ID must belong to the evidence set used by the provisional decision. Sponsor and provisional winner cannot challenge.
- Challenge attempts are capped at eight per provisional decision. Reveal and review timeouts have bounded recovery paths.
- Credit withdrawals require the transaction sender to equal the recipient, clear the credit before the external transfer, and cannot be repeated against the same balance.
- Commitments bind chain `61999`, the V2 Registry address, case, decision/evidence IDs as applicable, wallet, source, fact, and salt. Salts and unrevealed claims are stored in browser local storage only until reveal; disconnecting or changing wallets does not intentionally erase them.

## Threat model and remaining assumptions

| Threat | Mitigation | Residual risk / operational note |
|---|---|---|
| Prompt injection in case text, source, or claimed fact | Prompts treat all user/source text as data; verifier and adjudicator validate structured fields and replay substantive decision fields. | LLM consensus is still a source-grounded judgment, not a mathematical proof of truth. Carefully bound questions and use primary sources. |
| Fake, irrelevant, stale, or duplicate evidence | Six-field source check, accepted-evidence context, time-scope test, commitment replay protection, and case+fact reservation. | Validators may disagree about ambiguous source language or policy. The UI must show the basis and status, not imply certainty. |
| Unauthorized component callback | One-time fixed child addresses; each callback checks its exact configured sender and the pending stage. | Deployment/bootstrap mistakes remain security-critical; verify every child constructor address and Registry schema before funding. |
| Callback replay or late result | Child records are keyed by request ID; duplicate writes reject; Registry ignores already-settled callback stages and checks pending IDs/status. | A callback that never arrives uses explicit timeout/recovery; it is not silently treated as a positive verdict. |
| Early/duplicate payout or wrong recipient | Escrow invariant, delayed finalization, one-time bond release flags, pending penalties, sender-bound credit withdrawal. | Contract deployment itself and live transactions still require fees and user signatures; no deployment/funded end-to-end test has been run. |
| Challenge griefing | Exact contributor bond, bond forfeiture for invalid/unrevealed challenge, one-hour window, 20-minute reveal bound, eight-attempt cap. | A valid challenge can delay resolution during independent review; timeout recovery bounds the delay. |
| Web source unavailable or evaluator timeout | Retryable baseline path, challenge review deadline, bounded recovery period, and bond treatment defined in the approved spec. | The V2 hosted integration flow and real validator timings remain unverified until a separately approved deployment. |
| URL redirects or malicious downstream content | Validators fetch sources, use explicit source policy, and treat fetched bytes as untrusted data. | Current web render interface does not prove the final redirect host. Prefer stable first-party URLs; do not claim redirect-chain verification. |
| Wallet switching during a pending transaction | Shared EIP-1193 wallet context, accounts/chain event listeners, stale-response generation checks, and a fresh account/chain check before signing. | Wallet providers can change state between the final account read and their own signature UI; users must verify the account/network shown by the wallet. |
| Lost reveal salt | Browser warns to preserve site data, secrets are kept per commitment, and wallet disconnect does not clear them. | Clearing browser storage or changing browser/device before reveal is unrecoverable by design; do not share the salt before commit finality. |

## Demo guide (after deployment approval)

Use two funded Studionet wallets, one as the evidence contributor and one as the challenger. Do not use the sponsor as either role. Choose a case whose original evidence supports a decisive provisional result and whose challenge source cleanly changes that result under the same subject, version, policy, and time scope.

1. Confirm the V2 registry address appears in the V2-only manifest and explorer, and start the frontend with only the local `NEXT_PUBLIC_CHALLENGE_REGISTRY_ADDRESS` set.
2. Connect wallet A through the injected EIP-1193 provider on Studionet chain `61999`. Create a case with one to three official baseline facts that leave the rule insufficient.
3. Wait for `OPEN`. From a non-sponsor contributor wallet, enter the first-party source and one exact decisive fact; commit and wait for finality before revealing from the same browser profile.
4. Show the V2 verifier result and the case entering `PROVISIONAL_CLOSURE`. Point out the one-hour deadline and locked bounty/bond.
5. Switch to wallet B. Commit a challenge against the provisional evidence with a public, admissible counterfact. Wait for commit finality; then reveal using the same browser profile that holds the salt.
6. Show `CHALLENGE_REVIEW`, then the independent review status and basis. For a successful decisive challenge, permissionlessly finalize after the adjudicator returns `VERDICT_OVERTURNED` to the opposite decisive outcome.
7. Verify the case is `CLOSED`, the final outcome is the challenged outcome, the bounty and bonds are claimable by the appropriate wallets, and each wallet withdraws only its own credit.
8. Record explorer URLs for all contract deployments and transaction hashes for case creation, baseline, evidence commit/reveal, provisional closure, challenge commit/reveal/review, finalization, and withdrawals. Do not edit evidence or omit an unsuccessful transaction from the record.

An overturn to `INSUFFICIENT_EVIDENCE` is a successful *challenge* but a reopened case, not a final winning demo. For that path verify `REOPENED`, both bond credits, preserved bounty escrow, and subsequent `OPEN` status after `reopen_case`.

## Verification performed for this source branch

Run before any deployment:

```powershell
pytest -p no:cacheprovider tests/direct -q
cd frontend
npm test
npm run typecheck
npm run build
```

The pinned `genvm-linter==0.11.0` checks all three V1 contracts and all four V2 contracts with `GENVM_VERSION=v0.2.12`. The no-spend direct suite covers mocked consensus callbacks and economic settlement. The opt-in Studionet integration test is intentionally not run: it deploys contracts and submits transactions, which would cross the deployment/funding approval boundary. Therefore real hosted V2 integration, live adjudicator timing, explorer records, and production Vercel behavior are explicitly not claimed as verified.

## Deployment runbook — do not execute without separate approval

The GenLayer CLI loads every TypeScript/JavaScript file in the root `deploy/` directory in filename order. The V2 deployment script is intentionally gated by `CRUX_DEPLOY_V2_ONLY=1`; the existing V1 deploy script explicitly skips when that flag is set. The V2 script also refuses any client whose chain ID is not `61999`, whose RPC transport is not `https://studio.genlayer.com/api`, or whose V2 manifest already exists. The scripts persist deployment transaction hashes and partial progress so a failed attempt is inspected rather than blindly repeated.

After approval, from the repository root and an unlocked CLI:

```powershell
genlayer network set studionet
genlayer network info   # confirm chain 61999 and https://studio.genlayer.com/api
$env:CRUX_DEPLOY_V2_ONLY = "1"
genlayer deploy         # V2 script runs; V1 deploy script skips
Remove-Item Env:CRUX_DEPLOY_V2_ONLY
```

If a transaction fails or the command is interrupted, do not rerun deployment. Inspect the saved `deployments/challenge-v2-studionet.json` partial manifest, transaction receipts/traces, and the explorer first; reconcile the exact completed stage before any resumed write. The current deployment script refuses to overwrite an existing manifest. Check that all four addresses and `configureTxHash` are present and `status` is `READY`, then query each contract schema and `get_stats` on the V2 Registry.

Only after contract verification and a further frontend deployment approval should a production frontend configuration be considered. This implementation does not make or authorize that configuration change.
