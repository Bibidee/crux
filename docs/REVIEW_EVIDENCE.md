# Review evidence map

This is a checklist, not a self-awarded score. Fill the **live evidence** column after deployment.

## Current Challenge V2.2 release snapshot

The four-contract Challenge V2.2 set is deployed on Studionet chain `61999` and independently verified against the exact source hashes in [`../deployments/challenge-v2-2-studionet.json`](../deployments/challenge-v2-2-studionet.json). Its Registry is [`0x96F27D5B78F3c98db6eE5C6d6DA3B4dCCa050F2E`](https://explorer-studio.genlayer.com/address/0x96F27D5B78F3c98db6eE5C6d6DA3B4dCCa050F2E), with Evidence Verifier [`0x316aD5aeA2a010220107E676561507121E6356b5`](https://explorer-studio.genlayer.com/address/0x316aD5aeA2a010220107E676561507121E6356b5), Closure Judge [`0x8c9Acf52F7C8502e957a37231CE1B53097703312`](https://explorer-studio.genlayer.com/address/0x8c9Acf52F7C8502e957a37231CE1B53097703312), and Challenge Adjudicator [`0xeBFd81ae1e1DB3011439e38263E7971aCc6a306D`](https://explorer-studio.genlayer.com/address/0xeBFd81ae1e1DB3011439e38263E7971aCc6a306D). The five setup transactions finalized successfully; `get_stats` readback reports `components_configured=true`, `admin_controls=false`, `accounting_balanced=true`, and zero cases and escrow.

Production is published at [`https://crux-end.vercel.app/challenge`](https://crux-end.vercel.app/challenge) as Vercel deployment [`dpl_Jeoc5DyPJCaxt5Zg4661Tz9a2vtC`](https://vercel.com/bibidees-projects/frontend/Jeoc5DyPJCaxt5Zg4661Tz9a2vtC), status `READY`, and the public bundle contains the exact V2.2 Registry address. A funded two-wallet V2.2 lifecycle has not yet been executed, so no V2.2 case, submission, verification, closure, or withdrawal hashes are claimed here.

| Review area | Repository evidence | Live evidence before submission |
|---|---|---|
| GenLayer is consequential | Bounty settlement depends on source-grounded semantic consensus; no backend verdict path | `cx-6` closed through real baseline, verifier, closure consensus; payout withdrawn |
| Conflicting incentives | Sponsor funds bounty; contributor seeks payout; rejected/unrevealed bond goes to sponsor | Wallet A funded `cx-6`; Wallet B won and withdrew |
| Current external facts | Baseline and candidate source URLs are fetched inside GenVM | `cx-6` baseline finalized as `INSUFFICIENT_EVIDENCE`, then opened for candidate evidence |
| Substantive validation | Verifier compares six semantic fields; ClosureJudge independently replays outcome/sufficiency | Add a validator disagreement/negative test result |
| Non-trivial architecture | Registry + EvidenceVerifier + ClosureJudge with finalized cross-contract messages | Smoke passed; addresses below |
| Failure handling | SOURCE_UNAVAILABLE, retryable baseline, stage deadlines, expiry, stale callbacks, rejected/unrevealed paths | `cx-1` real baseline returned `BASELINE_ALREADY_DECIDABLE` and refunded |
| Accounting | Pull credits + exposed conservation invariant | Final registry `get_stats` on chain 61999: `accounting_balanced=true`, `admin_controls=false`, zeroed initial escrows |
| Frontend integration | Create, browse, detail, commit/reveal, activity/withdraw, explorer links; EIP-1193 wallet | https://crux-end.vercel.app is live and verified against the current Registry |
| Network handling | UI forces chain 61999; deploy script refuses other chain IDs | Live transactions and final stats verified on chain 61999 |
| Engineering | direct tests, opt-in integration smoke, docs, deployment manifest, typed frontend | CI `35452794519` on `bf97bce` passed: 3 lints, 22 direct tests, 3 frontend regression tests, typecheck and build |

## Final command evidence

```text
GENVM_VERSION=v0.2.12 genvm-lint check contracts/{crux_registry,evidence_verifier,closure_judge}.py --json: PASS (all three structural + semantic checks; 3 methods validated per contract set, Registry 18 methods / 2 constructor params)
pytest tests/direct/ -v: PASS (13 passed; Windows-compatible calldata tempfile harness added in `tests/direct/conftest.py`)
CRUX_RUN_STUDIONET_INTEGRATION=1 gltest tests/integration/ -v -s: PASS (1 passed, real Studionet RPC; deployment/schema wiring)
npm run typecheck: PASS
npm run build: PASS (Next.js 15.5.7)
```

## Deployment

```text
Registry: [0x3778BCa6F35D4D9f5b180eCf44aD5654bAE2A235](https://explorer-studio.genlayer.com/address/0x3778BCa6F35D4D9f5b180eCf44aD5654bAE2A235) — tx `0x11cad9b0ffa8b74568994cb2b1db7abd67a5b044408414b18df65dd5cca94ee3`
EvidenceVerifier: [0x9148a71Ad881865FEbF41548d0c77D6d3f836B17](https://explorer-studio.genlayer.com/address/0x9148a71Ad881865FEbF41548d0c77D6d3f836B17) — tx `0x72c7db89774e8ee7407cf6909e4e6ff147273a8d35a013d7aa93aa7152ddfe6a`
ClosureJudge: [0x216598A7584BF42E2Ce20f1E5B46c9D3603d3d64](https://explorer-studio.genlayer.com/address/0x216598A7584BF42E2Ce20f1E5B46c9D3603d3d64) — tx `0x34775a3c8fe8e0d312aa7cca486891d2d96297e0aa43ad5ad6fa9553170caef1`; component binding tx `0xe96a03676f911372ccb6997dfd0dc0da7f0c493e22285a08ff73374c86f0b4e9`
Frontend: [https://crux-end.vercel.app](https://crux-end.vercel.app), Vercel production deployment `dpl_2vi9bAF4gj37xsKdmFUtskRFscXH`, verified against source commit `9cbcb2c`.
```

## Live demonstration transactions

Historical previous-registry flow: `cx-3` is preserved in the manifest. Current-registry flow: `cx-6`, create `0x4cc094fe2260f0afb42e812409d6af89a4addb00df8d07d5e796cfab19e4ee0b`, submission `cs-2`, commit `0xf8c3d7b1c65544962a08d95498ec4e39ca05d979ea4f18d493483688a55732a7`, reveal `0x4f20b89bd684850d34b5a5c4a69f1f1ac432014bdf9d8c1eb30fbc524a8c3d21`, verifier `VERIFIED`, closure `OUTCOME_A`, winner `0x2cd419603eBa593074653930Ddc4073d4FD8fc60`, withdrawal `0xb333d885c8112685bbd617fa3bfbf07fced200b1f4bfcdff00e1dd94d2c568f1`.

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



