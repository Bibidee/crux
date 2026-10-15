# Crux Challenge V2.1 security release candidate

**Status: source candidate only — no contracts deployed.** Studionet is the only deployment target (`chainId: 61999`, RPC `https://studio.genlayer.com/api`). Deployment requires separate explicit authorization after the release gates below pass. No contract deployment, funded case, bond, withdrawal, production environment change, or Vercel publication was performed for this candidate.

## Release lineage

- **Crux V1:** existing three-contract product, addresses, data, and environment settings are preserved. V1 is not part of this replacement.
- **Crux Challenge V2:** deployed but superseded for security. Its original addresses, five setup transaction hashes, source hashes, and read-only historical verification remain in [`../deployments/challenge-v2-studionet.json`](../deployments/challenge-v2-studionet.json). The vulnerable Registry is `0x1BBec07518527A73e35333cD0d266ED20D032c6f`.
- **Crux Challenge V2.1:** corrected source candidate, not deployed. Its separate Studionet manifest is [`../deployments/challenge-v2-1-studionet.json`](../deployments/challenge-v2-1-studionet.json). No address or transaction hash is claimed for V2.1.

## Independent security finding

V2 allowed a challenge to name any evidence ID in the provisional decision's `decisive_evidence_ids`. The adjudicator received the decisive packet but not the committed `challenged_evidence_id`; it therefore could not bind the counterclaim to the exact fact the challenger selected. On a successful overturn, the Registry removed only `provisional_submission`. If a challenge targeted an earlier decisive contribution or baseline fact, that different challenged item remained in the accepted graph. This affected reopening to `INSUFFICIENT_EVIDENCE` and also left invalidated evidence visible in the graph after an opposite-outcome overturn. Existing regression coverage tested the special case where the challenged ID equaled the closing submission, so it did not expose this gap.

## V2.1 correction

1. The Registry forwards the committed challenged evidence ID with the exact decisive evidence packet.
2. The Challenge Adjudicator requires exactly one matching packet item, includes its ID and content in the source-grounded review, and evaluates the original rule after removing only that challenged item.
3. The authenticated callback echoes the challenged ID. The Registry rejects any callback whose target differs from the ID stored in the challenge record.
4. Every successful overturn removes that exact ID from the active accepted graph. If it is a contribution, the submission remains in history and is marked `OVERTURNED`. A distinct original closing contribution is retained as verified-but-non-closing after an insufficient-evidence overturn; the stale `closing_submission` and provisional pointers are cleared. The bounty remains escrowed. Existing bond settlement rules and the conservation invariant are retained.
5. New regressions cover earlier decisive evidence invalidation, both overturn outcomes, retained valid evidence, stale-ID rejection after reopen, target-bound adjudication, duplicate/mismatched callbacks, and accounting.

The callback continues to use the original case source policy, decision rule, outcome labels, fixed Registry sender, pending challenge ID, and deadline. No administrator setter, backend verdict, fee, or contract consolidation was introduced.

## Why all four contracts must be replaced

`ChallengeEvidenceVerifier`, `ChallengeClosureJudge`, and `ChallengeAdjudicator` each store the Registry address supplied to their constructor and authenticate calls against it. There is no safe way to reuse those child addresses with a replacement Registry. V2.1 must therefore deploy a new Registry and three new children, each bound to the new Registry, then call one-time `configure_components` once: five setup transactions total.

## Deployment and production safeguards

The candidate uses a separate `deploy/deployChallengeV2_1.ts` entrypoint and a separate manifest. The GenLayer CLI auto-loads every script in `deploy/`; accordingly:

- V2.1 skips unless `CRUX_DEPLOY_V2_1_ONLY=1`, `CRUX_DEPLOY_V2_1_AUTHORIZED=YES`, and an exact source commit SHA are supplied.
- The V1 and V2 entrypoints explicitly skip in V2.1 mode.
- The runner locks to Studionet `61999` and the exact Studio RPC, verifies finalized successful execution and receipt sender for each write, compares each deployed contract's canonical UTF-8/LF source hash, records a transaction hash before waiting, resumes a recorded hash rather than redeploying, and refuses ambiguous stages. Canonical line-ending hashing keeps the reviewed source identity stable across Windows and Linux checkouts.
- After `configure_components`, it reads back the Registry stats and checks all three child bindings, chain/RPC, configured state, `admin_controls=false`, and balanced accounting. It never writes the V1 manifest or frontend environment.

The frontend now reads V2 while pausing all V2 writes by default. Setting `NEXT_PUBLIC_CHALLENGE_V2_WRITES_ENABLED=true` is an explicit release configuration; V1 write paths are untouched. The existing Vercel project, environment variables, and production deployment have not been changed. Thus this source safeguard is not yet present on the live production alias; a separate approved frontend publication is required before presenting the current V2 UI as safely read-only. No existing V2 case, submission, or balance is redirected to V2.1.

## Verification record

The local candidate has passed the expanded source verification: frontend tests (`38` tests), Next.js typecheck, ESLint, production build, deployment-entrypoint TypeScript checks, seven pinned GenVM semantic-linter validations, and `pytest tests/direct/` (`53 passed`). The ambiguous-write tests prove an ambiguous failure invokes the write operation exactly once, and the V2.1 direct regressions cover bounded pending challenges, late reveals, recovery ordering, per-round budgets, target binding, evidence invalidation, retained verified facts, and cross-platform source-hash stability. The Studionet integration suite is intentionally not run because it performs deployment writes and requires separate authorization.

The verified V2.1 source candidate is commit [`799fc552e5a44158a13bc91910b0e946935f0113`](https://github.com/Bibidee/crux/commit/799fc552e5a44158a13bc91910b0e946935f0113). GitHub Actions quality run [#37](https://github.com/Bibidee/crux/actions/runs/38701929657) ran against that exact commit and concluded `success`; its `frontend` and `contracts` jobs both passed. No production frontend was published and no Vercel environment was changed. The source-level V2 write pause is therefore not yet live on `crux-end.vercel.app`.

The configured CLI network is Studionet `61999` at `https://studio.genlayer.com/api`; the selected local deployer is `0x527da5f7022f14f7105e5f06cec1a8eff53556b5`. Its live balance could not be verified because the RPC `eth_getBalance` request failed. No V2.1 contract deployment or funded transaction was attempted. The Studionet integration suite is intentionally not run here because it performs deployment writes and requires separate authorization.

Deployment preflight remains an independent gate: verify exact source SHA, selected chain/RPC, unlocked deployment account and live balance, absence of any prior V2.1 manifest/transaction, constructor args, current source hashes, available cost estimate, and setup transaction sequence. If any read-only network or account check is unavailable, stop without deployment and record the gap.

## Authorization boundary

This document is a preparation record, not deployment approval. Do not run the deployment entrypoint, `genlayer deploy`, any contract write, or Vercel publication until the full preflight and CI pass and the user explicitly authorizes the relevant action.
