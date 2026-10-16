# Crux Challenge V2 — Release Evidence and Limitations

> **Historical record — superseded.** This document preserves the original Challenge V2 hashes, findings, and receipts.
> It is not the active production specification or deployment target. Challenge V2.2 is active on Studionet `61999`;
> see [`CHALLENGE_V2_SPEC.md`](CHALLENGE_V2_SPEC.md), [`LIVE_DEMO.md`](LIVE_DEMO.md), and
> [`REVIEW_EVIDENCE.md`](REVIEW_EVIDENCE.md).

**Verdict: NOT READY for funded demonstrations.** This record separates what is deployed and read-only verified from what is locally tested or still unproven. No V2 cases, bonds, withdrawals, redeployments, Vercel settings, or production publications were created by this audit.

## Audited release baseline

- Repository branch: `challenge-v2`.
- Audited implementation commit pushed to `challenge-v2`: [`6f7517d`](https://github.com/Bibidee/crux/commit/6f7517d3ae2179684475b3185b1cad319dfcd9a5), parent `a3223a9bf2d02c9555ff0e8a690f148c0164aedf`, tree `ab7453c9ab55eaf2424b148d8c065bde1f5e20d5`. The normal Git push could not resolve GitHub in this environment; the authenticated GitHub API advanced the ref non-forcibly after every uploaded blob hash and the complete tree were verified against the locally tested commit.
- Production frontend source: `a3223a9bf2d02c9555ff0e8a690f148c0164aedf`.
- Network: GenLayer Studionet, chain `61999`, RPC `https://studio.genlayer.com/api`.
- Registry under audit: [`0x1BBec07518527A73e35333cD0d266ED20D032c6f`](https://explorer-studio.genlayer.com/address/0x1BBec07518527A73e35333cD0d266ED20D032c6f).
- Full deployment record: [`deployments/challenge-v2-studionet.json`](../deployments/challenge-v2-studionet.json).

## Deployed contracts and setup writes

Each setup transaction was read through the Studionet RPC. All five returned `FINALIZED` with `MAJORITY_AGREE`; the leader execution succeeded, the validator votes contained the required agreeing majority, and remaining idle validators had only the nonfatal `VALIDATOR_QUORUM_REACHED` condition. Contract source hashes match the recorded deployed source bytes. The Registry's constructor child bindings, one-time component configuration, schemas, and each child's `registry_address` were read back and matched the manifest.

| Component | Deployed address | Deployment transaction | Deployed source SHA-256 |
|---|---|---|---|
| CruxChallengeRegistry | [`0x1BBec07518527A73e35333cD0d266ED20D032c6f`](https://explorer-studio.genlayer.com/address/0x1BBec07518527A73e35333cD0d266ED20D032c6f) | [`0x68beed069a8389aaa27299a7dfd8edb8539fc38c1b5936e8fc58f00663fe4805`](https://explorer-studio.genlayer.com/tx/0x68beed069a8389aaa27299a7dfd8edb8539fc38c1b5936e8fc58f00663fe4805) | `b9d94e1c03d4cd6c8c7d8aa235bd87b152b39862198914c7234e44806630944c` |
| ChallengeEvidenceVerifier | [`0xb00190356b256f1A013a756c60DF283b08d0774F`](https://explorer-studio.genlayer.com/address/0xb00190356b256f1A013a756c60DF283b08d0774F) | [`0xe02310e7501e53b7aaa418f2337d7aa616a8b040a2dffe7d467b42a61e1941d1`](https://explorer-studio.genlayer.com/tx/0xe02310e7501e53b7aaa418f2337d7aa616a8b040a2dffe7d467b42a61e1941d1) | `0ee544da7194f404fe7df52fe2abf76b99a45041aa9fde4419e2c24928330c83` |
| ChallengeClosureJudge | [`0xc883672c59e3866bE204959fC9b78A8F8eC3EcC1`](https://explorer-studio.genlayer.com/address/0xc883672c59e3866bE204959fC9b78A8F8eC3EcC1) | [`0xea0e4e9541c66deee112083eafcfa07d99b7406921c292f8956b21bebfe17712`](https://explorer-studio.genlayer.com/tx/0xea0e4e9541c66deee112083eafcfa07d99b7406921c292f8956b21bebfe17712) | `1bbdf6f3e7e4848df9f46f15f5b28535f2cf0466580ee840a2ffe7c9a3e7a0c9` |
| ChallengeAdjudicator | [`0xF3d76247987252e4DD77d92C1594d428F1B542EB`](https://explorer-studio.genlayer.com/address/0xF3d76247987252e4DD77d92C1594d428F1B542EB) | [`0x6e196f8f3b426bd2505146ec3efc5e056680f09ca158f9eababd43e2ec5b66e4`](https://explorer-studio.genlayer.com/tx/0x6e196f8f3b426bd2505146ec3efc5e056680f09ca158f9eababd43e2ec5b66e4) | `c094eb549d0ec7fb7dc3b831334db11ee7fc26cc1b379d31af8e9439f7f42c90` |
| One-time `configure_components` | Registry above | [`0x1f6d80dd458d9845283acc24a03a88d677d54ed87b0a69cd0234355f251d0612`](https://explorer-studio.genlayer.com/tx/0x1f6d80dd458d9845283acc24a03a88d677d54ed87b0a69cd0234355f251d0612) | n/a |

Canonical Registry `get_stats` readback: `components_configured=true`, `admin_controls=false`, `protocol_fee_bps="0"`; total cases/submissions/challenges, total deposits, case escrow, bond escrow, claimable credits, and withdrawals are all zero; `accounting_balanced=true`. No V2 funds are at risk in existing case state because no case exists.

## Security finding: deployed code is not release-ready

In `record_challenge_review`, when a challenge overturns the provisional decision to `INSUFFICIENT_EVIDENCE`, the Registry marks the original submission `OVERTURNED` and reopens the case but does not remove the submission's fact from `case["accepted_evidence"]`. Later verification and closure decisions consume that active graph. This allows evidence whose decisive standing was overturned to be reused after reopening; the branch also retained the old `closing_submission` pointer.

The deployed Registry source SHA above is the pre-fix source. Local remediation now removes the overturned submission from the active evidence graph and clears the closing pointer, while keeping historical submission/challenge records. A direct regression test proves that a later closure callback cannot cite the removed ID. **This local correction is not deployed.** Do not run live V2 cases against the current Registry. Because deployed contracts are immutable and this audit's instruction prohibits redeployment, correcting this on-chain risk is outside the authorized work here.

The same patch adds adversarial direct tests for injected source instructions, malformed verifier/closure/adjudicator decisions, and decisive-ID reuse. It does not change the V1 contracts or their three-contract trust architecture.

## Frontend and production deployment

- Production alias: [https://crux-end.vercel.app](https://crux-end.vercel.app).
- Production Vercel deployment: [`dpl_FBmyw2ApCgX5CMoaJgPVjhegxhv6`](https://vercel.com/bibidees-projects/frontend/FBmyw2ApCgX5CMoaJgPVjhegxhv6), `READY`, project `frontend` (`nextjs`), target `production`, commit `a3223a9`.
- The deployed production build was previously confirmed to carry `NEXT_PUBLIC_CHALLENGE_REGISTRY_ADDRESS=0x1BBec07518527A73e35333cD0d266ED20D032c6f`. No project settings, environment variables, or production deployments were changed in this audit.
- The local frontend now rejects finalized receipts unless their GenVM execution and available consensus evidence indicate success. This change is not in the production deployment; a later frontend publication would require separate approval. The V2 route must not be used for funded cases until the Registry defect is corrected.

### Duplicate Vercel check

The failed check is a separate project/deployment, not the production project: `frontend-nx88` (`python`, `live=false`), deployment [`dpl_79KxTVvRkL7ApXxwfUMirv5vkkfm`](https://vercel.com/bibidees-projects/frontend-nx88/79KxTVvRkL7ApXxwfUMirv5vkkfm), same source commit. Vercel's deployment record reports `PYTHON_ENTRYPOINT_NOT_FOUND` and “No python entrypoint found,” matching the duplicate-project/wrong-preset diagnosis. The main `frontend` production deployment is `READY`.

The authenticated event-log endpoint returned a scope-specific `403`; its documented CLI fallback could not run because `api.vercel.com` DNS resolution failed in this environment. Therefore the top-level error code/message and project configuration are verified, but detailed step-by-step build logs were not accessible. The duplicate project was not changed or deleted because it is non-production and that would require authorization.

## Local verification and CI

On the final local source after the audit edits:

- GenVM semantic linter: all 7 V1/V2 contracts passed on `v0.2.12`.
- Direct GenVM tests: `43 passed`; no live integration test was run because it deploys/writes to Studionet.
- Frontend unit tests: `27 passed`.
- Frontend TypeScript typecheck: passed.
- Frontend production build: passed.
- ESLint: passed.
- V2 deployment runner TypeScript check: passed.

The baseline `a3223a9` has [GitHub Actions quality run #31](https://github.com/Bibidee/crux/actions/runs/38619674150), conclusion `success`; its statuses also show `Vercel – frontend` success and the separate `Vercel – frontend-nx88` failure described above. The audited implementation tree was pushed as `6f7517d` and its exact [GitHub Actions quality run #32](https://github.com/Bibidee/crux/actions/runs/38647723062) concluded `success`: both `frontend` and `contracts` jobs passed, including frontend tests/typecheck/build, the V1 and isolated V2 semantic-linter steps, and direct GenVM tests. This evidence-file refresh does not modify implementation code. The production alias remains on commit `a3223a9`; Vercel returned no deployment for `6f7517d`, and no production publication was made.

## Live challenge evidence

Neither Test A (challenge upheld) nor Test B (material overturn) has been executed. There are no case IDs, submission IDs, challenge IDs, funded transaction hashes, bounty/bond movements, or withdrawals to report. No wallets were used and no GEN was spent. The current smoke-test plan is blocked pending a corrected deployment and a separately approved, exact test plan. The plan also still needs three distinct wallet addresses and the actual wallet-displayed network-fee estimates before any funded-test approval can be requested.

V1 remains the live product and its prior evidence is maintained separately in [`REVIEW_EVIDENCE.md`](REVIEW_EVIDENCE.md); V1 evidence is not proof of a V2 lifecycle.
