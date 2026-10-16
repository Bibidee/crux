# Live Studionet demo

The final release should demonstrate the whole trust path with three distinct funded Studio wallets and real explorer links. Do not substitute mocks or screenshots of local state.

## Current Challenge V2.2 deployment

The current Challenge V2 route is wired to the independently verified Studionet deployment below:

- Registry: [`0x96F27D5B78F3c98db6eE5C6d6DA3B4dCCa050F2E`](https://explorer-studio.genlayer.com/address/0x96F27D5B78F3c98db6eE5C6d6DA3B4dCCa050F2E)
- Evidence Verifier: [`0x316aD5aeA2a010220107E676561507121E6356b5`](https://explorer-studio.genlayer.com/address/0x316aD5aeA2a010220107E676561507121E6356b5)
- Closure Judge: [`0x8c9Acf52F7C8502e957a37231CE1B53097703312`](https://explorer-studio.genlayer.com/address/0x8c9Acf52F7C8502e957a37231CE1B53097703312)
- Challenge Adjudicator: [`0xeBFd81ae1e1DB3011439e38263E7971aCc6a306D`](https://explorer-studio.genlayer.com/address/0xeBFd81ae1e1DB3011439e38263E7971aCc6a306D)
- Network: Studionet, chain `61999`, RPC `https://studio.genlayer.com/api`
- Frontend: [`https://crux-end.vercel.app/challenge`](https://crux-end.vercel.app/challenge)

All five deployment writes finalized successfully, component bindings and source hashes were independently read back, and the production frontend is `READY`. The funded three-wallet V2.2 lifecycle is still pending; the historical `cx-6` hashes below belong to the earlier V1 Registry and must not be presented as V2.2 evidence.

## Suggested case

Use the official GenLayer Networks documentation as the public source because it is easy for a reviewer to inspect.

**Question**

> Does stable GenLayer Studionet match the release configuration required by this case?

**Outcome A**: Matches configuration  
**Outcome B**: Does not match configuration

**Rule**

> Return Matches configuration only if verified official GenLayer documentation establishes both that stable Studionet has chain ID 61999 and that its GenLayer RPC is https://studio.genlayer.com/api. Return Does not match configuration only if verified official GenLayer documentation explicitly establishes a different chain ID or different RPC for stable Studionet. Otherwise remain insufficient.

**Source policy**

> Only official docs.genlayer.com documentation for the stable Studionet network is admissible. Exclude third-party pages, search snippets and social posts.

**Baseline evidence**

Source: `https://docs.genlayer.com/developers/networks`  
Claimed fact: `Stable GenLayer Studionet has chain ID 61999.`

The baseline should remain insufficient because the accepted evidence graph only contains the chain-ID fact.

## Wallet A — sponsor

1. Connect injected EIP-1193 wallet on chain 61999.
2. Open `/create`.
3. Fund the case with a small Studionet test-GEN bounty.
4. Wait for the create transaction to FINALIZE.
5. Confirm baseline child transaction succeeds and case becomes `OPEN`.
6. Record Registry address, case ID and explorer transaction links.

## Wallet B — original contributor

The following is historical V1 evidence only: `cx-6` is `CLOSED` with `OUTCOME_A`; it is not evidence of the V2.2 challenge lifecycle. For the current V2.2 run, submit the same official documentation URL with the *new* claimed fact:

> `The GenLayer RPC for stable Studionet is https://studio.genlayer.com/api.`

1. Commit evidence and record the transaction link.
2. Reveal after the commitment finalizes.
3. Confirm EvidenceVerifier fetches the source and records `VERIFIED` with all six fields true.
4. Confirm ClosureJudge records `OUTCOME_A`.
5. Confirm Registry case becomes `CLOSED`, winner is Wallet B and bounty becomes Wallet B credit.
6. Withdraw the credit and record the transfer transaction.

## Wallet C — independent challenger

Use a third funded wallet distinct from the sponsor and provisional winner. Commit and reveal source-backed counterevidence against the exact decisive evidence ID, then record the adjudicator result. Do not force an overturn: preserve the actual validator verdict.

## Negative demonstrations

Run at least two additional cases/submissions and preserve explorer links:

- **Disallowed source:** submit a third-party blog under the same official-only source policy. Expected: `REJECTED`, no bounty.
- **True but non-closing:** create a case with one more missing requirement, submit the RPC fact, and show `VERIFIED_NON_CLOSING` plus the fact being added to the accepted graph.
- If convenient, demonstrate an unavailable URL producing `RETRYABLE_SOURCE`, not rejection.

Before any write, obtain explicit authorization for the exact three-wallet scope, amounts, source claims and maximum spend. Record every finalized receipt and child callback; an accepted request or `MAJORITY_AGREE` alone is not sufficient evidence of the intended state transition.

## Release evidence to save

Update `deployments/studionet.json` and `docs/REVIEW_EVIDENCE.md` with exact addresses and transaction hashes. The README should link to the deployed app and explorer. Never write “tested” or “verified live” without those artifacts.

