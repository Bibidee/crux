# Review evidence map

This is a checklist, not a self-awarded score. Fill the **live evidence** column after deployment.

## Current Challenge V2.2 release snapshot

The four-contract Challenge V2.2 set is deployed on Studionet chain `61999` and independently verified against the exact source hashes in [`../deployments/challenge-v2-2-studionet.json`](../deployments/challenge-v2-2-studionet.json). Its Registry is [`0x96F27D5B78F3c98db6eE5C6d6DA3B4dCCa050F2E`](https://explorer-studio.genlayer.com/address/0x96F27D5B78F3c98db6eE5C6d6DA3B4dCCa050F2E), with Evidence Verifier [`0x316aD5aeA2a010220107E676561507121E6356b5`](https://explorer-studio.genlayer.com/address/0x316aD5aeA2a010220107E676561507121E6356b5), Closure Judge [`0x8c9Acf52F7C8502e957a37231CE1B53097703312`](https://explorer-studio.genlayer.com/address/0x8c9Acf52F7C8502e957a37231CE1B53097703312), and Challenge Adjudicator [`0xeBFd81ae1e1DB3011439e38263E7971aCc6a306D`](https://explorer-studio.genlayer.com/address/0xeBFd81ae1e1DB3011439e38263E7971aCc6a306D). The five setup transactions finalized successfully; `get_stats` readback reports `components_configured=true`, `admin_controls=false`, `accounting_balanced=true`, and zero cases and escrow.

Production is published at [`https://crux-end.vercel.app/challenge`](https://crux-end.vercel.app/challenge) as Vercel deployment [`dpl_Jeoc5DyPJCaxt5Zg4661Tz9a2vtC`](https://vercel.com/bibidees-projects/frontend/Jeoc5DyPJCaxt5Zg4661Tz9a2vtC), status `READY`, and the public bundle contains the exact V2.2 Registry address. A funded three-wallet V2.2 lifecycle has not yet been executed, so no V2.2 case, submission, verification, closure, or withdrawal hashes are claimed here.

Current V2.2 setup transactions:

| Component | Address | Finalized transaction |
|---|---|---|
| Registry | [`0x96F27D5B78F3c98db6eE5C6d6DA3B4dCCa050F2E`](https://explorer-studio.genlayer.com/address/0x96F27D5B78F3c98db6eE5C6d6DA3B4dCCa050F2E) | [`0xadfd0f753899033df0bcb551d02a333864a69414777ba5d6e2469e165ca79364`](https://explorer-studio.genlayer.com/tx/0xadfd0f753899033df0bcb551d02a333864a69414777ba5d6e2469e165ca79364) |
| Evidence Verifier | [`0x316aD5aeA2a010220107E676561507121E6356b5`](https://explorer-studio.genlayer.com/address/0x316aD5aeA2a010220107E676561507121E6356b5) | [`0xf87d9ba0523b5bf43825122cbcaff9ca91bd7e7089e688261e396dba08f19f67`](https://explorer-studio.genlayer.com/tx/0xf87d9ba0523b5bf43825122cbcaff9ca91bd7e7089e688261e396dba08f19f67) |
| Closure Judge | [`0x8c9Acf52F7C8502e957a37231CE1B53097703312`](https://explorer-studio.genlayer.com/address/0x8c9Acf52F7C8502e957a37231CE1B53097703312) | [`0x97e7a2457e7a3d0e60be141e4c9d4045f038e80375984fbdd2cdf417fe13aca9`](https://explorer-studio.genlayer.com/tx/0x97e7a2457e7a3d0e60be141e4c9d4045f038e80375984fbdd2cdf417fe13aca9) |
| Challenge Adjudicator | [`0xeBFd81ae1e1DB3011439e38263E7971aCc6a306D`](https://explorer-studio.genlayer.com/address/0xeBFd81ae1e1DB3011439e38263E7971aCc6a306D) | [`0x9e8438ba7adb81415cf61609d57bcdbc1060994897157f09902ef3eb8b4f37a7`](https://explorer-studio.genlayer.com/tx/0x9e8438ba7adb81415cf61609d57bcdbc1060994897157f09902ef3eb8b4f37a7) |
| One-time component binding | — | [`0x7980e97ca9bda70f5e490fd662f1499cc0851a87e1a3f96f1d7bcefb048dabb1`](https://explorer-studio.genlayer.com/tx/0x7980e97ca9bda70f5e490fd662f1499cc0851a87e1a3f96f1d7bcefb048dabb1) |

| Review area | Repository evidence | Live evidence before submission |
|---|---|---|
| GenLayer is consequential | Bounty settlement depends on source-grounded semantic consensus; no backend verdict path | V2.2 funded lifecycle `NOT_STARTED`; historical V1 evidence is not reused as proof |
| Conflicting incentives | Sponsor funds bounty; contributor seeks payout; rejected/unrevealed bond goes to sponsor | V2.2 funded lifecycle `NOT_STARTED`; three-wallet plan is prepared |
| Current external facts | Baseline and candidate source URLs are fetched inside GenVM | V2.2 funded lifecycle `NOT_STARTED`; source plan is prepared in `LIVE_DEMO.md` |
| Substantive validation | Verifier compares six semantic fields; ClosureJudge independently replays outcome/sufficiency | Add a validator disagreement/negative test result |
| Non-trivial architecture | Registry + EvidenceVerifier + ClosureJudge + ChallengeAdjudicator with finalized cross-contract messages | V2.2 setup receipts and bindings independently verified; funded lifecycle `NOT_STARTED` |
| Failure handling | SOURCE_UNAVAILABLE, retryable baseline, stage deadlines, expiry, stale callbacks, rejected/unrevealed paths | `cx-1` real baseline returned `BASELINE_ALREADY_DECIDABLE` and refunded |
| Accounting | Pull credits + exposed conservation invariant | Final V2.2 Registry `get_stats` on chain 61999: `accounting_balanced=true`, `admin_controls=false`, zeroed initial escrows |
| Frontend integration | Create, browse, detail, commit/reveal, activity/withdraw, explorer links; EIP-1193 wallet | https://crux-end.vercel.app is live and verified against the current Registry |
| Network handling | UI forces chain 61999; deploy script refuses other chain IDs | Setup transactions and final stats verified on chain 61999; funded lifecycle `NOT_STARTED` |
| Engineering | direct tests, opt-in integration smoke, docs, deployment manifest, typed frontend | CI run `38854054041` on `cacecc8c5c15bcc5664713ec5216f6f1d573ea11` concluded `success`; local final suite is recorded below |

## Final command evidence

```text
GENVM_VERSION=v0.2.12 genvm-lint: PASS (Registry, EvidenceVerifier, ClosureJudge and ChallengeAdjudicator)
pytest -p no:cacheprovider tests/direct/ -q: PASS (71 passed)
npm --prefix frontend test: PASS (10 files, 51 tests)
npm --prefix frontend run typecheck: PASS
npm --prefix frontend run build: PASS (Next.js 15.5.7)
ESLint: NOT CONFIGURED (no frontend ESLint script/config is present)
Studionet integration: NOT RUN in this audit because it performs new state-changing writes; no GEN was spent.
```

## Current V2.2 deployment

```text
Registry: [0x96F27D5B78F3c98db6eE5C6d6DA3B4dCCa050F2E](https://explorer-studio.genlayer.com/address/0x96F27D5B78F3c98db6eE5C6d6DA3B4dCCa050F2E) — tx `0xadfd0f753899033df0bcb551d02a333864a69414777ba5d6e2469e165ca79364`
EvidenceVerifier: [0x316aD5aeA2a010220107E676561507121E6356b5](https://explorer-studio.genlayer.com/address/0x316aD5aeA2a010220107E676561507121E6356b5) — tx `0xf87d9ba0523b5bf43825122cbcaff9ca91bd7e7089e688261e396dba08f19f67`
ClosureJudge: [0x8c9Acf52F7C8502e957a37231CE1B53097703312](https://explorer-studio.genlayer.com/address/0x8c9Acf52F7C8502e957a37231CE1B53097703312) — tx `0x97e7a2457e7a3d0e60be141e4c9d4045f038e80375984fbdd2cdf417fe13aca9`
ChallengeAdjudicator: [0xeBFd81ae1e1DB3011439e38263E7971aCc6a306D](https://explorer-studio.genlayer.com/address/0xeBFd81ae1e1DB3011439e38263E7971aCc6a306D) — tx `0x9e8438ba7adb81415cf61609d57bcdbc1060994897157f09902ef3eb8b4f37a7`
Component binding: tx `0x7980e97ca9bda70f5e490fd662f1499cc0851a87e1a3f96f1d7bcefb048dabb1`
Frontend: [https://crux-end.vercel.app](https://crux-end.vercel.app), Vercel production deployment `dpl_Jeoc5DyPJCaxt5Zg4661Tz9a2vtC`, verified READY.
```

## Live demonstration transactions

V2.2 Case A (upheld challenge): `NOT_STARTED` — no funded V2.2 hashes are claimed.
V2.2 Case B (material overturn): `NOT_STARTED` — no funded V2.2 hashes are claimed.
V2.2 Case C (optional reopening): `NOT_STARTED` and not authorized.

Historical V1 flow, not V2.2 proof: `cx-6`, create `0x4cc094fe2260f0afb42e812409d6af89a4addb00df8d07d5e796cfab19e4ee0b`, submission `cs-2`, commit `0xf8c3d7b1c65544962a08d95498ec4e39ca05d979ea4f18d493483688a55732a7`, reveal `0x4f20b89bd684850d34b5a5c4a69f1f1ac432014bdf9d8c1eb30fbc524a8c3d21`, verifier `VERIFIED`, closure `OUTCOME_A`, winner `0x2cd419603eBa593074653930Ddc4073d4FD8fc60`, withdrawal `0xb333d885c8112685bbd617fa3bfbf07fced200b1f4bfcdff00e1dd94d2c568f1`.

### Historical V1 transaction details

```text
Case create: `cx-1`, sponsor Wallet A `0x7eB2a4B4e913Df62eAe807eF60509B3B7284C7FA`, tx `0xecfe5c8607598584ae46cb6b436a9466b303c0d3b12e403c22f9c7a135353ddd`
Baseline decision: `INSUFFICIENT_EVIDENCE`, finalized by real consensus in `cx-2`
Evidence commit: `cs-1`, tx `0xd01471e4763252a8938469cdbc267a9a5786948cba940524031cde6c063a9e76`
Evidence reveal: finalized on-chain; the helper did not capture the hash, while the resulting `cs-1` state is independently read back below.
Verifier callback: `VERIFIED`; six substantive verifier fields true in finalized submission state
Closure callback: `OUTCOME_A`, case `CLOSED`, winner Wallet B `0xf883bCE8FcB120F714B147446342D7E4545Bc988`
Winner withdrawal: `1100000000000000` attoGEN credit, tx `0x269364df7a70e2377a763a2606e3397269897d1b4a20f6fceaf7789c504df777`
Negative path 1: `cx-1`, create tx `0x2360d4e1e1cf10f94abe83edd01370de5d8c02b69ec29d2cf60221198a66511c`; baseline consensus returned `BASELINE_ALREADY_DECIDABLE` and refunded instead of opening.
Negative path 2: `cx-3`, create tx `0x5953a654ee5dbd7994a9e767170acf6dec6809c836ee99a1ae6655be05a5d0b9`; independent baseline consensus again returned `BASELINE_ALREADY_DECIDABLE`, preventing evidence submission and preserving the unresolved-market invariant.

Explorer links use `https://explorer-studio.genlayer.com/tx/<hash>` and the Registry address link above.

## Challenge V2.1 deployment evidence

The security-remediated Challenge V2.1 contract set was deployed separately on Studionet chain `61999` from `challenge-v2` commit `bd6dfd42a3b75cc3b4d21f51018aa99fa4aa6809`. The existing V1 deployment, V2 deployment, frontend environment, and Vercel production alias were not modified.

| Component | Address | Finalized transaction |
|---|---|---|
| V2.1 Registry | [`0xA258Ef6f5e2ACB3512c37ACC71544D94Caa7520c`](https://explorer-studio.genlayer.com/address/0xA258Ef6f5e2ACB3512c37ACC71544D94Caa7520c) | [`0x6b9fbc29391cae9520d2041f3181ef8f1fc7491bb930e4dd872a8b1713ea92de`](https://explorer-studio.genlayer.com/tx/0x6b9fbc29391cae9520d2041f3181ef8f1fc7491bb930e4dd872a8b1713ea92de) |
| V2.1 Evidence Verifier | [`0x6417c5523fE978ff324E65BC226Ce376C5986481`](https://explorer-studio.genlayer.com/address/0x6417c5523fE978ff324E65BC226Ce376C5986481) | [`0xf4eccdf0a4f63aa3f568daa1f495196b6d290adc1e5ce573ffe65580463e9a68`](https://explorer-studio.genlayer.com/tx/0xf4eccdf0a4f63aa3f568daa1f495196b6d290adc1e5ce573ffe65580463e9a68) |
| V2.1 Closure Judge | [`0xF49904f8BE76A0B7cF51580268f219d7C7480330`](https://explorer-studio.genlayer.com/address/0xF49904f8BE76A0B7cF51580268f219d7C7480330) | [`0xe86fa86e40d69422b9034c61390ff755f2c66432d8b2a5d97bb0547c3141457a`](https://explorer-studio.genlayer.com/tx/0xe86fa86e40d69422b9034c61390ff755f2c66432d8b2a5d97bb0547c3141457a) |
| V2.1 Challenge Adjudicator | [`0xdDEb644B00f988f684F4F7da9c655e1a458de494`](https://explorer-studio.genlayer.com/address/0xdDEb644B00f988f684F4F7da9c655e1a458de494) | [`0x52b80cc940189dd3b0163e76de00faf2dcf7397cdfffc58f13fcd502afdbd3b7`](https://explorer-studio.genlayer.com/tx/0x52b80cc940189dd3b0163e76de00faf2dcf7397cdfffc58f13fcd502afdbd3b7) |
| One-time component binding | — | [`0x74c2e532342fb58bd88f900df1b0d6df21667896da5c09dc36d2a875b4637643`](https://explorer-studio.genlayer.com/tx/0x74c2e532342fb58bd88f900df1b0d6df21667896da5c09dc36d2a875b4637643) |

Independent readback matched all four deployed source hashes and schemas. V2.1 Registry `get_stats` returned `chain_id=61999`, the exact three child bindings, `components_configured=true`, `admin_controls=false`, `accounting_balanced=true`, and zero cases, submissions, challenges, escrow, credits, and withdrawals. No funded V2.1 case was created in this deployment task.
```



