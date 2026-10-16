# Crux Challenge V2.1 security release

> **Historical candidate — superseded.** This document preserves the V2.1 source identity, findings, hashes, and
> deployment receipts. V2.1 is not the active production target and must not be redeployed for new cases. Challenge
> V2.2 is the active four-contract release; see [`CHALLENGE_V2_SPEC.md`](CHALLENGE_V2_SPEC.md) and
> [`challenge-v2-2-studionet.json`](../deployments/challenge-v2-2-studionet.json).

**Status: contracts deployed and independently verified.** Studionet is the only deployment target (`chainId: 61999`, RPC `https://studio.genlayer.com/api`). The separately authorized V2.1 setup completed with five finalized writes. No funded case, bond, withdrawal, production environment change, or Vercel publication was performed; the existing frontend remains unchanged and is not configured to these V2.1 addresses.

## Release lineage

- **Crux V1:** existing three-contract product, addresses, data, and environment settings are preserved. V1 is not part of this replacement.
- **Crux Challenge V2:** deployed but superseded for security. Its original addresses, five setup transaction hashes, source hashes, and read-only historical verification remain in [`../deployments/challenge-v2-studionet.json`](../deployments/challenge-v2-studionet.json). The vulnerable Registry is `0x1BBec07518527A73e35333cD0d266ED20D032c6f`.
- **Crux Challenge V2.1:** corrected replacement deployed and independently verified on Studionet. Its separate manifest is [`../deployments/challenge-v2-1-studionet.json`](../deployments/challenge-v2-1-studionet.json). The existing V2 deployment and Vercel frontend were not modified.

## Independent security finding

V2 allowed a challenge to name any evidence ID in the provisional decision's `decisive_evidence_ids`. The adjudicator received the decisive packet but not the committed `challenged_evidence_id`; it therefore could not bind the counterclaim to the exact fact the challenger selected. On a successful overturn, the Registry removed only `provisional_submission`. If a challenge targeted an earlier decisive contribution or baseline fact, that different challenged item remained in the accepted graph. This affected reopening to `INSUFFICIENT_EVIDENCE` and also left invalidated evidence visible in the graph after an opposite-outcome overturn. Existing regression coverage tested the special case where the challenged ID equaled the closing submission, so it did not expose this gap.

## V2.1 correction

1. The Registry forwards the committed challenged evidence ID with the exact decisive evidence packet.
2. The Challenge Adjudicator requires exactly one matching packet item, includes its ID and content in the source-grounded review, and evaluates the original rule after removing only that challenged item.
3. The authenticated callback echoes the challenged ID. The Registry rejects any callback whose target differs from the ID stored in the challenge record.
4. Every successful overturn removes that exact ID from the active accepted graph. If it is a contribution, the submission remains in history and is marked `OVERTURNED`. A distinct original closing contribution is retained as verified-but-non-closing after an insufficient-evidence overturn; the stale `closing_submission` and provisional pointers are cleared. The bounty remains escrowed. Existing bond settlement rules and the conservation invariant are retained.
5. New regressions cover earlier decisive evidence invalidation, both overturn outcomes, retained valid evidence, stale-ID rejection after reopen, target-bound adjudication, duplicate/mismatched callbacks, and accounting.

6. Concurrent challenge cleanup is reconciled from the full unresolved set. Manual expiration of an abandoned commitment cannot reset a different challenge's active review; queued reviews remain queued or are promoted in order. Automatic cleanup during a new commitment or finalization preserves the surviving work, settles each expired bond once, and keeps finalization blocked while any unresolved challenge remains.

The callback continues to use the original case source policy, decision rule, outcome labels, fixed Registry sender, pending challenge ID, and deadline. No administrator setter, backend verdict, fee, or contract consolidation was introduced.

## Why all four contracts must be replaced

`ChallengeEvidenceVerifier`, `ChallengeClosureJudge`, and `ChallengeAdjudicator` each store the Registry address supplied to their constructor and authenticate calls against it. There is no safe way to reuse those child addresses with a replacement Registry. V2.1 must therefore deploy a new Registry and three new children, each bound to the new Registry, then call one-time `configure_components` once: five setup transactions total.

## Deployment and production safeguards

The candidate uses a separate `deploy/deployChallengeV2_1.ts` entrypoint and a separate manifest. The GenLayer CLI auto-loads every script in `deploy/`; accordingly:

- V2.1 skips unless `CRUX_DEPLOY_V2_1_ONLY=1`, `CRUX_DEPLOY_V2_1_AUTHORIZED=YES`, and an exact source commit SHA are supplied.
- The V1 and V2 entrypoints explicitly skip in V2.1 mode.
- The runner locks to Studionet `61999` and the exact Studio RPC, verifies finalized successful execution and receipt sender for each write, compares each deployed contract's canonical UTF-8/LF source hash, records a transaction hash before waiting, resumes a recorded hash rather than redeploying, and refuses ambiguous stages. Canonical line-ending hashing keeps the reviewed source identity stable across Windows and Linux checkouts.
- After `configure_components`, it reads back the Registry stats and checks all three child bindings, chain/RPC, configured state, `admin_controls=false`, and balanced accounting. It never writes the V1 manifest or frontend environment.

The frontend source still reads V2 while pausing all V2 writes by default. Setting `NEXT_PUBLIC_CHALLENGE_V2_WRITES_ENABLED=true` is an explicit release configuration; V1 write paths are untouched. The existing Vercel project, environment variables, production deployment, and V2 frontend address have not been changed. V2.1 is therefore deployed and verified at the contract layer, but is not yet the production frontend target. No existing V2 case, submission, or balance is redirected to V2.1.

## Deployment record

The user-authorized V2.1 deployment ran from branch `challenge-v2` at commit [`bd6dfd42a3b75cc3b4d21f51018aa99fa4aa6809`](https://github.com/Bibidee/crux/commit/bd6dfd42a3b75cc3b4d21f51018aa99fa4aa6809) with the unlocked deployer `0x527da5f7022f14f7105e5f06cec1a8eff53556b5`. All writes were sent to Studionet chain `61999` through `https://studio.genlayer.com/api`.

| Component | Address | Deployment transaction |
|---|---|---|
| Registry | [`0xA258Ef6f5e2ACB3512c37ACC71544D94Caa7520c`](https://explorer-studio.genlayer.com/address/0xA258Ef6f5e2ACB3512c37ACC71544D94Caa7520c) | [`0x6b9fbc29391cae9520d2041f3181ef8f1fc7491bb930e4dd872a8b1713ea92de`](https://explorer-studio.genlayer.com/tx/0x6b9fbc29391cae9520d2041f3181ef8f1fc7491bb930e4dd872a8b1713ea92de) |
| Evidence Verifier | [`0x6417c5523fE978ff324E65BC226Ce376C5986481`](https://explorer-studio.genlayer.com/address/0x6417c5523fE978ff324E65BC226Ce376C5986481) | [`0xf4eccdf0a4f63aa3f568daa1f495196b6d290adc1e5ce573ffe65580463e9a68`](https://explorer-studio.genlayer.com/tx/0xf4eccdf0a4f63aa3f568daa1f495196b6d290adc1e5ce573ffe65580463e9a68) |
| Closure Judge | [`0xF49904f8BE76A0B7cF51580268f219d7C7480330`](https://explorer-studio.genlayer.com/address/0xF49904f8BE76A0B7cF51580268f219d7C7480330) | [`0xe86fa86e40d69422b9034c61390ff755f2c66432d8b2a5d97bb0547c3141457a`](https://explorer-studio.genlayer.com/tx/0xe86fa86e40d69422b9034c61390ff755f2c66432d8b2a5d97bb0547c3141457a) |
| Challenge Adjudicator | [`0xdDEb644B00f988f684F4F7da9c655e1a458de494`](https://explorer-studio.genlayer.com/address/0xdDEb644B00f988f684F4F7da9c655e1a458de494) | [`0x52b80cc940189dd3b0163e76de00faf2dcf7397cdfffc58f13fcd502afdbd3b7`](https://explorer-studio.genlayer.com/tx/0x52b80cc940189dd3b0163e76de00faf2dcf7397cdfffc58f13fcd502afdbd3b7) |
| Component binding | — | [`0x74c2e532342fb58bd88f900df1b0d6df21667896da5c09dc36d2a875b4637643`](https://explorer-studio.genlayer.com/tx/0x74c2e532342fb58bd88f900df1b0d6df21667896da5c09dc36d2a875b4637643) |

All five transactions finalized with `MAJORITY_AGREE` and successful leader execution. The binding transaction was submitted once; the local runner initially classified a live receipt shape too strictly, retained the hash, then resumed and verified that same hash after the receipt-safety compatibility fix. No duplicate binding was submitted.

## Verification record

The local source passed the expanded verification before deployment: frontend tests (`38` tests), Next.js typecheck, ESLint, production build, deployment-entrypoint TypeScript checks, seven pinned GenVM semantic-linter validations, and `pytest tests/direct/` (`66 passed`). The receipt compatibility regression adds a live Studionet receipt-shape test; the final frontend suite passed (`39/39`, single-threaded Windows pool) and the targeted receipt-safety suite passed (`12/12`). The ambiguous-write tests prove an ambiguous failure invokes the write operation exactly once, and the V2.1 direct regressions cover bounded pending challenges, late reveals, concurrent manual and automatic expiration, exact challenge-window finalization blocking, queued review promotion, recovery ordering, per-round budgets, target binding, evidence invalidation, retained verified facts, correct upheld-review beneficiary selection, and cross-platform source-hash stability. The existing opt-in integration test deploys an additional legacy three-contract set, so it was not run during this five-write-authorized V2.1 deployment.

The verified V2.1 source candidate is commit [`0554d5fc0cc94f6abd005c0c0f0a62b6e6b952f2`](https://github.com/Bibidee/crux/commit/0554d5fc0cc94f6abd005c0c0f0a62b6e6b952f2). GitHub Actions quality run [#41](https://github.com/Bibidee/crux/actions/runs/38718574370) ran against that exact commit and concluded `success`; its `frontend` and `contracts` jobs both passed. No production frontend was published and no Vercel environment was changed. The source-level V2 write pause is therefore not yet live on `crux-end.vercel.app`.

The configured CLI network was Studionet `61999` at `https://studio.genlayer.com/api`; the selected local deployer was unlocked and had `297.999999999999999996 GEN` before deployment. Independent readback confirmed every deployed source hash matches the reviewed manifest hash, all expected schemas are present, and `get_stats` reports `components_configured=true`, exact verifier/judge/challenge-adjudicator bindings, `admin_controls=false`, `accounting_balanced=true`, and zero cases, submissions, challenges, escrow, credits, and withdrawals.

The deployment preflight was satisfied: exact source SHA, selected chain/RPC, unlocked deployment account and live balance, empty V2.1 manifest, constructor args, current source hashes, setup sequence, finalized receipts, deployed source, schemas, and Registry readback were all verified.

## Authorization boundary

The V2.1 contract deployment is complete. A separate explicit authorization is still required before wiring the frontend to these addresses or publishing a new Vercel production deployment. A funded two-wallet V2.1 market flow and its application-level evidence remain intentionally unexecuted because this authorization covered the five setup writes only.
