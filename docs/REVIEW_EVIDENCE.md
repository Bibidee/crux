# Review evidence map

This is a factual release record. Explorer links below point to finalized Studionet transactions, not local mocks or accepted-but-pending requests.

## Final V2.2 deployment

Network: Studionet, chain `61999`, RPC `https://studio.genlayer.com/api`.

| Component | Address | Finalized transaction |
|---|---|---|
| Registry | [`0x96F27D5B78F3c98db6eE5C6d6DA3B4dCCa050F2E`](https://explorer-studio.genlayer.com/address/0x96F27D5B78F3c98db6eE5C6d6DA3B4dCCa050F2E) | [`0xadfd0f753899033df0bcb551d02a333864a69414777ba5d6e2469e165ca79364`](https://explorer-studio.genlayer.com/tx/0xadfd0f753899033df0bcb551d02a333864a69414777ba5d6e2469e165ca79364) |
| Evidence Verifier | [`0x316aD5aeA2a010220107E676561507121E6356b5`](https://explorer-studio.genlayer.com/address/0x316aD5aeA2a010220107E676561507121E6356b5) | [`0xf87d9ba0523b5bf43825122cbcaff9ca91bd7e7089e688261e396dba08f19f67`](https://explorer-studio.genlayer.com/tx/0xf87d9ba0523b5bf43825122cbcaff9ca91bd7e7089e688261e396dba08f19f67) |
| Closure Judge | [`0x8c9Acf52F7C8502e957a37231CE1B53097703312`](https://explorer-studio.genlayer.com/address/0x8c9Acf52F7C8502e957a37231CE1B53097703312) | [`0x97e7a2457e7a3d0e60be141e4c9d4045f038e80375984fbdd2cdf417fe13aca9`](https://explorer-studio.genlayer.com/tx/0x97e7a2457e7a3d0e60be141e4c9d4045f038e80375984fbdd2cdf417fe13aca9) |
| Challenge Adjudicator | [`0xeBFd81ae1e1DB3011439e38263E7971aCc6a306D`](https://explorer-studio.genlayer.com/address/0xeBFd81ae1e1DB3011439e38263E7971aCc6a306D) | [`0x9e8438ba7adb81415cf61609d57bcdbc1060994897157f09902ef3eb8b4f37a7`](https://explorer-studio.genlayer.com/tx/0x9e8438ba7adb81415cf61609d57bcdbc1060994897157f09902ef3eb8b4f37a7) |
| One-time component binding | — | [`0x7980e97ca9bda70f5e490fd662f1499cc0851a87e1a3f96f1d7bcefb048dabb1`](https://explorer-studio.genlayer.com/tx/0x7980e97ca9bda70f5e490fd662f1499cc0851a87e1a3f96f1d7bcefb048dabb1) |

Independent readback matched the deployed source hashes and component bindings. `get_stats` reports `chain_id=61999`, `components_configured=true`, `admin_controls=false`, and `accounting_balanced=true`.

Production frontend: [`https://crux-end.vercel.app`](https://crux-end.vercel.app), Vercel deployment [`dpl_Ei6P1vAPVt6UAReMTFmcVbhKkAdF`](https://vercel.com/bibidees-projects/frontend/Ei6P1vAPVt6UAReMTFmcVbhKkAdF), status `READY`, exact V2.2 Registry address in the public bundle.

## Funded live scope

The authorized scope used three distinct funded wallets:

- Sponsor A: `0x7c65ce913f5665c11f1219048112c84cd6cb2a4b`
- Contributor B: `0x2cd419603eba593074653930ddc4073d4fd8fc60`
- Challenger C: `0x8355d011e1fc874f3a91245711420d0c92cb3e47`

The case bounty was `0.001 GEN`, each normal bond was `0.0001 GEN`, and the approved ceiling including fees was `0.02 GEN`. The Registry final readback reports:

```text
total_cases=2
cases_closed=1
total_submissions=1
total_challenges=1
total_deposited_atto=2200000000000000
bond_escrow_atto=0
case_escrow_atto=0
claimable_atto=1000000000000000
withdrawn_atto=1200000000000000
withdrawal_receipts=2
accounting_balanced=true
admin_controls=false
```

## Live transactions

### `cx-1`: baseline already decidable

This negative path proves that the baseline short-circuit refunds the sponsor instead of opening an already-decidable market.

- Create: [`0x95d0d293284bc02d1676d831e79082f0b7a0c5da5ce4e24ff5cff65a0ba45bf8`](https://explorer-studio.genlayer.com/tx/0x95d0d293284bc02d1676d831e79082f0b7a0c5da5ce4e24ff5cff65a0ba45bf8)
- Baseline callback: [`0x305a103af17fc9ebc5e235ce24cf138f9beae77f7cd3918f91ac5761fc219913`](https://explorer-studio.genlayer.com/tx/0x305a103af17fc9ebc5e235ce24cf138f9beae77f7cd3918f91ac5761fc219913)
- Result: `BASELINE_ALREADY_DECIDABLE`, `OUTCOME_A`, bounty returned to sponsor credit.

### `cx-2`: complete upheld-challenge lifecycle

- Create: [`0x0c3343963093608add91a4d74b83601bfb85df9043fc6a35cab8aaaeaa85129f`](https://explorer-studio.genlayer.com/tx/0x0c3343963093608add91a4d74b83601bfb85df9043fc6a35cab8aaaeaa85129f)
- Baseline callback: [`0xff3b37a1c347166c0357cde732b5b39055c7848eb0671c630c45cecb1282b194`](https://explorer-studio.genlayer.com/tx/0xff3b37a1c347166c0357cde732b5b39055c7848eb0671c630c45cecb1282b194)
- Baseline: `READY`, `INSUFFICIENT_EVIDENCE`; case opened.
- Evidence commit, Wallet B: [`0x08b57cc5037784df355c66e07bb6780d9c7ee2de21b660c42054b5664f8e7353`](https://explorer-studio.genlayer.com/tx/0x08b57cc5037784df355c66e07bb6780d9c7ee2de21b660c42054b5664f8e7353)
- Submission: `cs-1`
- Evidence reveal: [`0xfd0d7b0c5ccdb70c1c2168d0cc9629bbfdb05bcc0f858f8e7b2b7880259d48cc`](https://explorer-studio.genlayer.com/tx/0xfd0d7b0c5ccdb70c1c2168d0cc9629bbfdb05bcc0f858f8e7b2b7880259d48cc)
- Verification: `VERIFIED`, all six verifier flags true; provenance `GENLAYER_INDEPENDENT_REPLAY_WITH_LIVE_WEB`.
- Challenge commit, Wallet C: [`0xeb6039fb59fe027b48edd08149c9269681eb877c79b15fa50b0158e2219704`](https://explorer-studio.genlayer.com/tx/0xeb6039fb59fe027b48edd08149c9269681eb877c79b15fa50b0158e2219704)
- Challenge reveal: [`0xf791274ca2f4bd3964d1bb643fa9080a87b0e4ab915e99492cb384c6a3c89523`](https://explorer-studio.genlayer.com/tx/0xf791274ca2f4bd3964d1bb643fa9080a87b0e4ab915e99492cb384c6a3c89523)
- Challenge: `ch-1`, exact decisive evidence targeted; verdict `VERDICT_UPHELD`.
- Finalization: [`0x6ee4894f292b244ce1b00f1255425cfa47e6c682e2b3469c95e084cddaa1285c`](https://explorer-studio.genlayer.com/tx/0x6ee4894f292b244ce1b00f1255425cfa47e6c682e2b3469c95e084cddaa1285c)
- Final case: `CLOSED`, `OUTCOME_A`; winner Wallet B; remaining bounty `0`.

### Withdrawal evidence

The contract’s own receipt status is recorded exactly as `DISPATCHED_UNVERIFIED` with `delivery_proven=false`. Independent child receipt inspection found both transfers finalized with `value_credited=true`, Registry sender, and the intended recipient:

- Wallet B: withdrawal [`0x67ac46d42a67e2bf3c5647f15ffc97182942149d7ac6c27e057f78ea2166db75`](https://explorer-studio.genlayer.com/tx/0x67ac46d42a67e2bf3c5647f15ffc97182942149d7ac6c27e057f78ea2166db75), `0.0011 GEN`; child [`0x306eaf67d34685c1b5952ba2cf590f66d2b6627e23f53ecfd649c55dce667d0d`](https://explorer-studio.genlayer.com/tx/0x306eaf67d34685c1b5952ba2cf590f66d2b6627e23f53ecfd649c55dce667d0d)
- Wallet C: withdrawal [`0x10fb8f369f8dc7c2789e66e5d3303dd4f4be0a494c7e03d1f94ec03ad596ae3b`](https://explorer-studio.genlayer.com/tx/0x10fb8f369f8dc7c2789e66e5d3303dd4f4be0a494c7e03d1f94ec03ad596ae3b), `0.0001 GEN`; child [`0xe6f4461a8426f41b0d809f6b9bc59dc8b9bb093fa0de02280776ce58619f6be7`](https://explorer-studio.genlayer.com/tx/0xe6f4461a8426f41b0d809f6b9bc59dc8b9bb093fa0de02280776ce58619f6be7)
- Final per-wallet Registry credits: A `0.001 GEN` sponsor credit; B `0`; C `0`.

## Verification commands and results

```text
GENVM_VERSION=v0.2.12 genvm-lint: PASS (all four contracts)
pytest -p no:cacheprovider tests/direct/ -q: PASS (71 passed)
npm --prefix frontend test: PASS (10 files, 51 tests)
npm --prefix frontend run typecheck: PASS
npm --prefix frontend run build: PASS (Next.js 15.5.7)
Studionet live integration: PASS for the authorized two-case scope; all writes finalized successfully.
GitHub Actions run 38858554415 for source commit f50348bb780dca1f718fa51ce7b17d52db7705ed: success.
ESLint: NOT CONFIGURED (no frontend ESLint script/config is present)
```

## Scope limitations and final status

Not executed within the explicitly authorized two-case scope: a material-overturn challenge, a disallowed third-party-source rejection, and an unavailable-source retryable case. No third funded case was opened and no contract was redeployed.

The source, contract deployment, frontend, and the complete funded upheld-challenge lifecycle are healthy. The release is **READY WITH DISCLOSED LIVE-EVIDENCE LIMITATIONS**, not an unqualified claim that every optional adversarial variant was exercised.

Historical V1/V2.1 deployments and their hashes are retained in the deployment manifests for provenance only; they are not used as V2.2 proof.
