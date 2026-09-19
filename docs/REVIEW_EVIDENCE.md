# Review evidence map

This is a checklist, not a self-awarded score. Fill the **live evidence** column after deployment.

| Review area | Repository evidence | Live evidence before submission |
|---|---|---|
| GenLayer is consequential | Bounty settlement depends on source-grounded semantic consensus; no backend verdict path | `cx-6` closed through real baseline, verifier, closure consensus; payout withdrawn |
| Conflicting incentives | Sponsor funds bounty; contributor seeks payout; rejected/unrevealed bond goes to sponsor | Wallet A funded `cx-6`; Wallet B won and withdrew |
| Current external facts | Baseline and candidate source URLs are fetched inside GenVM | `cx-6` baseline finalized as `INSUFFICIENT_EVIDENCE`, then opened for candidate evidence |
| Substantive validation | Verifier compares six semantic fields; ClosureJudge independently replays outcome/sufficiency | Add a validator disagreement/negative test result |
| Non-trivial architecture | Registry + EvidenceVerifier + ClosureJudge with finalized cross-contract messages | Smoke passed; addresses below |
| Failure handling | SOURCE_UNAVAILABLE, retryable baseline, stage deadlines, expiry, stale callbacks, rejected/unrevealed paths | `cx-1` real baseline returned `BASELINE_ALREADY_DECIDABLE` and refunded |
| Accounting | Pull credits + exposed conservation invariant | Final registry `get_stats` on chain 61999: `accounting_balanced=true`, `admin_controls=false`, zeroed initial escrows |
| Frontend integration | Create, browse, detail, commit/reveal, activity/withdraw, explorer links; EIP-1193 wallet | https://crux-end.vercel.app is live, but its current public build still points at the prior registry and requires republishing |
| Network handling | UI forces chain 61999; deploy script refuses other chain IDs | Live transactions and final stats verified on chain 61999 |
| Engineering | direct tests, opt-in integration smoke, docs, deployment manifest, typed frontend | Latest CI: 3 lints, 22 direct tests, frontend cache regression tests, typecheck and build pass; published frontend is live |

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
Frontend: [https://crux-end.vercel.app](https://crux-end.vercel.app), Vercel production deployment `dpl_Cop7uGjKuGqHj1ygsZ6dydxnDU5o`.
```

## Live demonstration transactions

Current remediated live flow: `cx-3` create tx `0xe043459ccb6e25129eb76e8b1dcfb2df91c832c3c8d3563dc68bc2b1a5e36f0c`; Bob submission `cs-1`; commit tx `0x77ca4232ea957280035c2f4f6043d27f7326403e65b576e12513b1f52a006739`; reveal tx `0x4fe901edfb80b71afbba5e78f24c6b871d2945c1ca9ed6bdcf7a341bb5a3d452`; verifier `VERIFIED`; closure `OUTCOME_A`; winner `0xf883bCE8FcB120F714B147446342D7E4545Bc988`; withdrawal tx `0xdab0bcec9c3b6fd4521454fe50411d8190bc1a8a4317808a498bbccb5014c9c8`.

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
```


