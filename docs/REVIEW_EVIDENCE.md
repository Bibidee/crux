# Review evidence map

This is a checklist, not a self-awarded score. Fill the **live evidence** column after deployment.

| Review area | Repository evidence | Live evidence before submission |
|---|---|---|
| GenLayer is consequential | Bounty settlement depends on source-grounded semantic consensus; no backend verdict path | `cx-3` opened through real baseline consensus; contributor lifecycle remains pending |
| Conflicting incentives | Sponsor funds bounty; contributor seeks payout; rejected/unrevealed bond goes to sponsor | Wallet A funded `cx-3`; Wallet B transaction flow still requires re-unlocked signer |
| Current external facts | Baseline and candidate source URLs are fetched inside GenVM | `cx-3` baseline finalized as `INSUFFICIENT_EVIDENCE`, then opened for candidate evidence |
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
Registry: [0xfBed1c827D3A5Ae6F60D3e027df6fe7fa42a00D8](https://explorer-studio.genlayer.com/address/0xfBed1c827D3A5Ae6F60D3e027df6fe7fa42a00D8) — tx `0x4f0f796f0fb20d7f9cb96f1a873038a52786ce59cdc8c6207ed5db6aebd13a88`
EvidenceVerifier: [0x6c48bbd5860bc366a6dd063Db96dC1801884A8a0](https://explorer-studio.genlayer.com/address/0x6c48bbd5860bc366a6dd063Db96dC1801884A8a0) — tx `0x9fa98d9c5d876f03b786f2d49a5795b81bb6e08143294baad611185e8c575a73`
ClosureJudge: [0x080e07CDFce588EE1728A9640A3217F358B195A7](https://explorer-studio.genlayer.com/address/0x080e07CDFce588EE1728A9640A3217F358B195A7) — tx `0x677ac90ec69e8b3251b97be4bf7ec308c2374e133fb5d02d759da32c60ed04f1`; component binding tx `0x87efe5c177d5a0ee6d840624f117a870777a0a96d19e2d8e29e9040f001a08db`
Frontend: [https://crux-end.vercel.app](https://crux-end.vercel.app), Vercel production deployment `dpl_Cop7uGjKuGqHj1ygsZ6dydxnDU5o`.
```

## Live demonstration transactions

Current remediated live flow: `cx-3` create tx `0xe043459ccb6e25129eb76e8b1dcfb2df91c832c3c8d3563dc68bc2b1a5e36f0c`; Bob submission `cs-1`; commit tx `0x77ca4232ea957280035c2f4f6043d27f7326403e65b576e12513b1f52a006739`; reveal tx `0x4fe901edfb80b71afbba5e78f24c6b871d2945c1ca9ed6bdcf7a341bb5a3d452`; verifier state `VERIFIED`; closure state currently `CLOSURE_PENDING`. No closure or withdrawal hash is claimed yet.

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
