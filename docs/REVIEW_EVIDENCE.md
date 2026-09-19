# Review evidence map

This is a checklist, not a self-awarded score. Fill the **live evidence** column after deployment.

| Review area | Repository evidence | Live evidence before submission |
|---|---|---|
| GenLayer is consequential | Bounty settlement depends on source-grounded semantic consensus; no backend verdict path | `cx-1` closed through real baseline, verifier, and closure consensus; payout withdrawn |
| Conflicting incentives | Sponsor funds bounty; contributor seeks payout; rejected/unrevealed bond goes to sponsor | Wallet A funded `cx-1`; distinct Wallet B won and withdrew |
| Current external facts | Baseline and candidate source URLs are fetched inside GenVM | Official docs URLs recorded in finalized `cx-1` evidence graph |
| Substantive validation | Verifier compares six semantic fields; ClosureJudge independently replays outcome/sufficiency | Add a validator disagreement/negative test result |
| Non-trivial architecture | Registry + EvidenceVerifier + ClosureJudge with finalized cross-contract messages | Smoke passed; addresses below |
| Failure handling | SOURCE_UNAVAILABLE, retryable baseline, stage deadlines, expiry, stale callbacks, rejected/unrevealed paths | `cx-1` real baseline returned `BASELINE_ALREADY_DECIDABLE` and refunded |
| Accounting | Pull credits + exposed conservation invariant | Final registry `get_stats` on chain 61999: `accounting_balanced=true`, `admin_controls=false`, zeroed initial escrows |
| Frontend integration | Create, browse, detail, commit/reveal, activity/withdraw, explorer links; EIP-1193 wallet | https://crux-end.vercel.app is configured for the finalized Studionet deployment below |
| Network handling | UI forces chain 61999; deploy script refuses other chain IDs | Live transactions and final stats verified on chain 61999 |
| Engineering | direct tests, opt-in integration smoke, docs, deployment manifest, typed frontend | Direct suite and integration smoke now pass; semantic linter cache remains externally broken |

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
Registry: [0x5F3aa55E3314F221b07D004a7e99d33eEAEB2Cd0](https://explorer-studio.genlayer.com/address/0x5F3aa55E3314F221b07D004a7e99d33eEAEB2Cd0) — tx `0x9d96461ed3b6b2f79cb7c3994e5ccd8df44e248edf7995304c7c4cef80072e03`
EvidenceVerifier: [0xF3332978Bed8506a8e013c81EE8ACF7218568Be1](https://explorer-studio.genlayer.com/address/0xF3332978Bed8506a8e013c81EE8ACF7218568Be1) — tx `0xf4c71701b4e493f2a6f0c093c32844df524dfc3173c16391a486f3bfda7ae04e`
ClosureJudge: [0x05D69509A10730bae0401850dF148a48De5669C6](https://explorer-studio.genlayer.com/address/0x05D69509A10730bae0401850dF148a48De5669C6) — tx `0x2e64320bae6d4c725146fd78957713db329c4905996c178409f0f870f7451363`; component binding tx `0x807cae32d7b6e66be8aaa572bf2614365d9c176e79dc8967f0bb28192aa28b4a`
Frontend: [https://crux-end.vercel.app](https://crux-end.vercel.app), Vercel production deployment `dpl_Bn1FMLixBpDVoVrZUHdfVnAHaqHZ`.
```

## Live demonstration transactions

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
