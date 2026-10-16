# Live Studionet demo

This document records the funded V2.2 execution on the real GenLayer Studionet network. It is evidence, not a mock or a local simulation.

## Deployment

- Network: Studionet, chain `61999`
- RPC: `https://studio.genlayer.com/api`
- Frontend: [`https://crux-end.vercel.app`](https://crux-end.vercel.app)
- Registry: [`0x96F27D5B78F3c98db6eE5C6d6DA3B4dCCa050F2E`](https://explorer-studio.genlayer.com/address/0x96F27D5B78F3c98db6eE5C6d6DA3B4dCCa050F2E)
- Evidence Verifier: [`0x316aD5aeA2a010220107E676561507121E6356b5`](https://explorer-studio.genlayer.com/address/0x316aD5aeA2a010220107E676561507121E6356b5)
- Closure Judge: [`0x8c9Acf52F7C8502e957a37231CE1B53097703312`](https://explorer-studio.genlayer.com/address/0x8c9Acf52F7C8502e957a37231CE1B53097703312)
- Challenge Adjudicator: [`0xeBFd81ae1e1DB3011439e38263E7971aCc6a306D`](https://explorer-studio.genlayer.com/address/0xeBFd81ae1e1DB3011439e38263E7971aCc6a306D)

The five deployment writes and component bindings were finalized before this live run. No V2.2 contract was redeployed during it.

## Authorized wallets and spend

- Wallet A, sponsor: `0x7c65ce913f5665c11f1219048112c84cd6cb2a4b`
- Wallet B, contributor and winner: `0x2cd419603eba593074653930ddc4073d4fd8fc60`
- Wallet C, independent challenger: `0x8355d011e1fc874f3a91245711420d0c92cb3e47`
- Case bounty: `0.001 GEN`
- Evidence/challenge bond: `0.0001 GEN` each
- Authorized ceiling including fees: `0.02 GEN`

The final Registry readback reports `total_deposited_atto=2200000000000000`, zero case escrow, zero bond escrow, `withdrawn_atto=1200000000000000`, two withdrawal receipts, and `accounting_balanced=true`. Wallet A retains the `0.001 GEN` sponsor credit from the baseline-already-decidable negative path; Wallet B and Wallet C have zero remaining credit after their withdrawals.

## Case `cx-1`: baseline already decidable negative path

This case deliberately used a source claim that the baseline evaluator could already decide. It did not open a market for evidence submission.

- Create transaction: [`0x95d0d293284bc02d1676d831e79082f0b7a0c5da5ce4e24ff5cff65a0ba45bf8`](https://explorer-studio.genlayer.com/tx/0x95d0d293284bc02d1676d831e79082f0b7a0c5da5ce4e24ff5cff65a0ba45bf8)
- Baseline callback: [`0x305a103af17fc9ebc5e235ce24cf138f9beae77f7cd3918f91ac5761fc219913`](https://explorer-studio.genlayer.com/tx/0x305a103af17fc9ebc5e235ce24cf138f9beae77f7cd3918f91ac5761fc219913)
- Result: `BASELINE_ALREADY_DECIDABLE`
- Outcome: `OUTCOME_A`
- Settlement: bounty refunded to Wallet A credit; no submission, challenge, or escrow remained.

This proves the baseline short-circuit and sponsor refund path. It is not evidence of a contributor payout.

## Case `cx-2`: complete three-wallet upheld-challenge path

Question: does the official GenLayer documentation establish the current stable Studionet connection details required by the case?

- Outcome A: `Matches configuration`
- Outcome B: `Does not match configuration`
- Source policy: only official `docs.genlayer.com` pages
- Baseline fact: `Studionet is the stable hosted development environment with chain ID 61999.`
- Contributor fact: `The official GenLayer Networks documentation lists the stable Studionet RPC as https://studio.genlayer.com/api.`

### 1. Sponsor opens the case

- Create transaction: [`0x0c3343963093608add91a4d74b83601bfb85df9043fc6a35cab8aaaeaa85129f`](https://explorer-studio.genlayer.com/tx/0x0c3343963093608add91a4d74b83601bfb85df9043fc6a35cab8aaaeaa85129f)
- Baseline callback: [`0xff3b37a1c347166c0357cde732b5b39055c7848eb0671c630c45cecb1282b194`](https://explorer-studio.genlayer.com/tx/0xff3b37a1c347166c0357cde732b5b39055c7848eb0671c630c45cecb1282b194)
- Baseline state: `READY`, `INSUFFICIENT_EVIDENCE`
- Case state: `OPEN`

### 2. Wallet B commits and reveals evidence

- Commitment transaction: [`0x08b57cc5037784df355c66e07bb6780d9c7ee2de21b660c42054b5664f8e7353`](https://explorer-studio.genlayer.com/tx/0x08b57cc5037784df355c66e07bb6780d9c7ee2de21b660c42054b5664f8e7353)
- Submission: `cs-1`
- Reveal transaction: [`0xfd0d7b0c5ccdb70c1c2168d0cc9629bbfdb05bcc0f858f8e7b2b7880259d48cc`](https://explorer-studio.genlayer.com/tx/0xfd0d7b0c5ccdb70c1c2168d0cc9629bbfdb05bcc0f858f8e7b2b7880259d48cc)
- Verification: `VERIFIED`; all six substantive verifier fields were true.
- Verification provenance: `GENLAYER_INDEPENDENT_REPLAY_WITH_LIVE_WEB`
- Finalized verifier callbacks: [`0x7ce085450a30d0688cea13c3c003dd806cf1fb2f7cdc19181018d65d08d59d49`](https://explorer-studio.genlayer.com/tx/0x7ce085450a30d0688cea13c3c003dd806cf1fb2f7cdc19181018d65d08d59d49), [`0xa89d459840ac021627073d4f40717d2811e4a417dfd91f45826fea243796963e`](https://explorer-studio.genlayer.com/tx/0xa89d459840ac021627073d4f40717d2811e4a417dfd91f45826fea243796963e), [`0xf2abf90125a7e10ece12d8e6b3401e73d949b42fdfa679f97973e7e2ff0196aa`](https://explorer-studio.genlayer.com/tx/0xf2abf90125a7e10ece12d8e6b3401e73d949b42fdfa679f97973e7e2ff0196aa), [`0xeadaa568b015b0bb578880e045e2d864fbef3e9bd1fe35ea6567f83399481ed0`](https://explorer-studio.genlayer.com/tx/0xeadaa568b015b0bb578880e045e2d864fbef3e9bd1fe35ea6567f83399481ed0)

### 3. Wallet C challenges the exact decisive evidence

- Challenge commitment: [`0xeb6039fb59cefe027b48edd08149c9269681eb877c79b15fa50b0158e2219704`](https://explorer-studio.genlayer.com/tx/0xeb6039fb59cefe027b48edd08149c9269681eb877c79b15fa50b0158e2219704)
- Challenge: `ch-1`, against decision `cs-1` and baseline evidence `b-1`
- Challenge reveal: [`0xf791274ca2f4bd3964d1bb643fa9080a87b0e4ab915e99492cb384c6a3c89523`](https://explorer-studio.genlayer.com/tx/0xf791274ca2f4bd3964d1bb643fa9080a87b0e4ab915e99492cb384c6a3c89523)
- Adjudicator callbacks: [`0x14be6c75b08270ad7907d9f4161e7982081d4b627adad94690a7661d0fa33b18`](https://explorer-studio.genlayer.com/tx/0x14be6c75b08270ad7907d9f4161e7982081d4b627adad94690a7661d0fa33b18), [`0x13a1f2f3cd48e2b7390661c3ce1ab19a5a8f0227cb162c5fca9102d2125c0f49`](https://explorer-studio.genlayer.com/tx/0x13a1f2f3cd48e2b7390661c3ce1ab19a5a8f0227cb162c5fca9102d2125c0f49)
- Verdict: `VERDICT_UPHELD`; the challenge did not contradict the submitted fact, so the original result remained valid.

### 4. Finalize, close, and settle

- Finalization transaction: [`0x6ee4894f292b244ce1b00f1255425cfa47e6c682e2b3469c95e084cddaa1285c`](https://explorer-studio.genlayer.com/tx/0x6ee4894f292b244ce1b00f1255425cfa47e6c682e2b3469c95e084cddaa1285c)
- Final case state: `CLOSED`, `OUTCOME_A`
- Winner: Wallet B `0x2cd419603eba593074653930ddc4073d4fd8fc60`
- Remaining bounty: `0`

### 5. Withdrawals and external transfer readback

The Registry receipt state intentionally reports `DISPATCHED_UNVERIFIED` with `delivery_proven=false`; that is not silently upgraded in this document. Independently, both triggered transfer receipts finalized with `value_credited=true`, the Registry as sender, and the intended recipient as `to_address`:

- Wallet B withdrawal: [`0x67ac46d42a67e2bf3c5647f15ffc97182942149d7ac6c27e057f78ea2166db75`](https://explorer-studio.genlayer.com/tx/0x67ac46d42a67e2bf3c5647f15ffc97182942149d7ac6c27e057f78ea2166db75), amount `0.0011 GEN`; child transfer [`0x306eaf67d34685c1b5952ba2cf590f66d2b6627e23f53ecfd649c55dce667d0d`](https://explorer-studio.genlayer.com/tx/0x306eaf67d34685c1b5952ba2cf590f66d2b6627e23f53ecfd649c55dce667d0d)
- Wallet C withdrawal: [`0x10fb8f369f8dc7c2789e66e5d3303dd4f4be0a494c7e03d1f94ec03ad596ae3b`](https://explorer-studio.genlayer.com/tx/0x10fb8f369f8dc7c2789e66e5d3303dd4f4be0a494c7e03d1f94ec03ad596ae3b), amount `0.0001 GEN`; child transfer [`0xe6f4461a8426f41b0d809f6b9bc59dc8b9bb093fa0de02280776ce58619f6be7`](https://explorer-studio.genlayer.com/tx/0xe6f4461a8426f41b0d809f6b9bc59dc8b9bb093fa0de02280776ce58619f6be7)

## What this run proves and what it does not

Proven: the deployed four-contract architecture, baseline short-circuit/refund, real three-wallet evidence submission, semantic verification, challenge adjudication, one-hour finalization, closure, pull-credit accounting, and finalized external transfer child receipts on chain `61999`.

Not executed within the explicitly authorized two-case scope: a material-overturn challenge, a disallowed third-party source rejection, and an unavailable-source retryable case. No third funded case was opened and no contract was redeployed.

Historical V1 and V2.1 hashes remain in the review evidence as historical context only; they are not substituted for this V2.2 proof.
