# Live Studionet demo

The final release should demonstrate the whole trust path with two funded Studio wallets and real explorer links. Do not substitute mocks or screenshots of local state.

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

## Wallet B — contributor

Current live state: `cx-3` is `CLOSED` with `OUTCOME_A`. Bob's submission `cs-1` is `CLOSED_WINNER`, and the `1100000000000000` attoGEN credit was withdrawn.

Live hashes: create `0xe043459ccb6e25129eb76e8b1dcfb2df91c832c3c8d3563dc68bc2b1a5e36f0c`; commit `0x77ca4232ea957280035c2f4f6043d27f7326403e65b576e12513b1f52a006739`; reveal `0x4fe901edfb80b71afbba5e78f24c6b871d2945c1ca9ed6bdcf7a341bb5a3d452`; withdrawal `0xdab0bcec9c3b6fd4521454fe50411d8190bc1a8a4317808a498bbccb5014c9c8`.

Submit the same official documentation URL with the *new* claimed fact:

> `The GenLayer RPC for stable Studionet is https://studio.genlayer.com/api.`

1. Commit evidence and record the transaction link.
2. Reveal after the commitment finalizes.
3. Confirm EvidenceVerifier fetches the source and records `VERIFIED` with all six fields true.
4. Confirm ClosureJudge records `OUTCOME_A`.
5. Confirm Registry case becomes `CLOSED`, winner is Wallet B and bounty becomes Wallet B credit.
6. Withdraw the credit and record the transfer transaction.

## Negative demonstrations

Run at least two additional cases/submissions and preserve explorer links:

- **Disallowed source:** submit a third-party blog under the same official-only source policy. Expected: `REJECTED`, no bounty.
- **True but non-closing:** create a case with one more missing requirement, submit the RPC fact, and show `VERIFIED_NON_CLOSING` plus the fact being added to the accepted graph.
- If convenient, demonstrate an unavailable URL producing `RETRYABLE_SOURCE`, not rejection.

## Release evidence to save

Update `deployments/studionet.json` and `docs/REVIEW_EVIDENCE.md` with exact addresses and transaction hashes. The README should link to the deployed app and explorer. Never write “tested” or “verified live” without those artifacts.
