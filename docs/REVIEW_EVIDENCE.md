# Review evidence map

This is a checklist, not a self-awarded score. Fill the **live evidence** column after deployment.

| Review area | Repository evidence | Live evidence before submission |
|---|---|---|
| GenLayer is consequential | Bounty settlement depends on source-grounded semantic consensus; no backend verdict path | `cx-2` closed through real baseline, verifier, and closure consensus; payout withdrawn |
| Conflicting incentives | Sponsor funds bounty; contributor seeks payout; rejected/unrevealed bond goes to sponsor | Wallet A funded `cx-2`; distinct Wallet B won and withdrew |
| Current external facts | Baseline and candidate source URLs are fetched inside GenVM | Official docs URLs recorded in finalized `cx-2` evidence graph |
| Substantive validation | Verifier compares six semantic fields; ClosureJudge independently replays outcome/sufficiency | Add a validator disagreement/negative test result |
| Non-trivial architecture | Registry + EvidenceVerifier + ClosureJudge with finalized cross-contract messages | Smoke passed; addresses below |
| Failure handling | SOURCE_UNAVAILABLE, retryable baseline, stage deadlines, expiry, stale callbacks, rejected/unrevealed paths | `cx-1` real baseline returned `BASELINE_ALREADY_DECIDABLE` and refunded |
| Accounting | Pull credits + exposed conservation invariant | Final registry `get_stats` on chain 61999: `accounting_balanced=true`, `admin_controls=false`, zeroed initial escrows |
| Frontend integration | Create, browse, detail, commit/reveal, activity/withdraw, explorer links; EIP-1193 wallet | Production deployment READY at https://crux-end.vercel.app with exact Studionet public configuration |
| Network handling | UI forces chain 61999; deploy script refuses other chain IDs | Live transactions and final stats verified on chain 61999 |
| Engineering | direct tests, opt-in integration smoke, docs, deployment manifest, typed frontend | Direct suite and integration smoke now pass; semantic linter cache remains externally broken |

## Final command evidence

```text
genvm-lint check contracts/*.py --json: structural pass (3); semantic SDK validation still blocked by missing `runners/py-genlayer/1j/b45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6.tar` after stable cache refresh
pytest tests/direct/ -v: PASS (13 passed; Windows-compatible calldata tempfile harness added in `tests/direct/conftest.py`)
CRUX_RUN_STUDIONET_INTEGRATION=1 gltest tests/integration/ -v -s: PASS (1 passed, real Studionet RPC; deployment/schema wiring)
npm run typecheck: PASS
npm run build: PASS (Next.js 15.5.7)
```

## Deployment

```text
Registry: [0x5789b330f90CFBDa2DCBdeF7A66cbA1247Ec9107](https://explorer-studio.genlayer.com/address/0x5789b330f90CFBDa2DCBdeF7A66cbA1247Ec9107) — tx `0xbbae816edac39005b329a59e715484433404ef8a2ec8203f21fe517626668c3d`
EvidenceVerifier: [0x58eD91e219A96639b30ec23C860217ef9Fc4eCCb](https://explorer-studio.genlayer.com/address/0x58eD91e219A96639b30ec23C860217ef9Fc4eCCb) — tx `0xd5f5230310f4a28190b549b67da87a67758b4dfeeb602fd4f881c3c1a37d54d3`
ClosureJudge: [0x947503895f34f34FaafF21f2c89C8b0EbCaD46db](https://explorer-studio.genlayer.com/address/0x947503895f34f34FaafF21f2c89C8b0EbCaD46db) — tx `0x64f62e82829127fb428d14cbb5fbdec4181927df9655e975fe04a4f8a521ce93`
Frontend: [https://crux-end.vercel.app](https://crux-end.vercel.app), Vercel production deployment `dpl_Bn1FMLixBpDVoVrZUHdfVnAHaqHZ`.
```

## Live demonstration transactions

```text
Case create: `cx-2`, sponsor Wallet A `0x7eB2a4B4e913Df62eAe807eF60509B3B7284C7FA`, tx `0xeb94901ba52c44e9c5d4a493f7735d57971f0324b8612d017ab05377d1697c52`
Baseline decision: `INSUFFICIENT_EVIDENCE`, finalized by real consensus in `cx-2`
Evidence commit: `cs-1`, tx `0x346108cf93f33832c32d7e969c218c3faee9770b50d3d874a79aec625b616836`
Evidence reveal: tx `0xcdb5620451b71eb275ef0a1adb03ae7781c6b2c410b893ac81ee463dcda915ea`
Verifier callback: `VERIFIED`; six substantive verifier fields true in finalized submission state
Closure callback: `OUTCOME_A`, case `CLOSED`, winner Wallet B `0xf883bCE8FcB120F714B147446342D7E4545Bc988`
Winner withdrawal: `1100000000000000` attoGEN credit, tx `0xad50ec22406c68f51f6e3190a0e9ff73e288001adbbbc71e0a87358d32a5e776`
Negative path: `cx-1`, create tx `0x2360d4e1e1cf10f94abe83edd01370de5d8c02b69ec29d2cf60221198a66511c`; baseline consensus returned `BASELINE_ALREADY_DECIDABLE` and refunded instead of opening.

Explorer links use `https://explorer-studio.genlayer.com/tx/<hash>` and the Registry address link above.
```
