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

Current live state: `cx-6` is `CLOSED` with `OUTCOME_A`. Bob submission `cs-2` is `CLOSED_WINNER`, and the `1000000000000000` attoGEN credit was withdrawn.\r\n\r\nLive hashes: create `0x4cc094fe2260f0afb42e812409d6af89a4addb00df8d07d5e796cfab19e4ee0b`; commit `0xf8c3d7b1c65544962a08d95498ec4e39ca05d979ea4f18d493483688a55732a7`; reveal `0x4f20b89bd684850d34b5a5c4a69f1f1ac432014bdf9d8c1eb30fbc524a8c3d21`; withdrawal `0xb333d885c8112685bbd617fa3bfbf07fced200b1f4bfcdff00e1dd94d2c568f1`.\r\n\r\nSubmit the same official documentation URL with the *new* claimed fact:

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

