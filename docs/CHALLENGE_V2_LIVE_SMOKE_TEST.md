# Crux Challenge V2 — Studionet Live Smoke-Test Plan

**Status: blocked, not executed.** The four V2 contracts exist on Studionet and production is configured to the V2 Registry, but the deployed Registry has a known evidence-reuse defect when an insufficient-evidence challenge reopens a case. The local source/test fix has not been deployed. Do not fund or run either case until a corrected Registry is separately authorized, deployed, and independently verified. This plan does not authorize deployment, production changes, or funded writes.

## Fixed scope

- Network: GenLayer Studionet, chain ID `61999` only.
- RPC: `https://studio.genlayer.com/api` only.
- The current addresses and five setup receipts are in the V2-only manifest; they are not approved for funded test use while the deployed Registry is vulnerable. A future corrected deployment must have its own manifest and verified bindings.
- Use three distinct wallets per case: sponsor, original contributor, and challenger. The sponsor and provisional winner cannot challenge.
- Use an isolated local/preview frontend setting for `NEXT_PUBLIC_CHALLENGE_REGISTRY_ADDRESS`; do not set or replace the V1 production Registry variable.
- No deployment retry, case creation, bond, bounty, withdrawal, or other write is authorized by this plan itself.

## Before funded writes

1. Do not accept the old manifest's `READY` label as a security approval. First verify that the corrected deployed Registry source contains the reopen graph-removal fix, then verify all four finalized receipts, execution results, source SHA-256 hashes, constructor Registry bindings, one-time component configuration, and schemas.
2. Read Registry `get_stats`; record `accounting_balanced=true`, `admin_controls=false`, zero cases, zero case escrow, zero bond escrow, and zero claimable credits.
3. Record chain ID/RPC, contract addresses, source hashes, three distinct wallet addresses (sponsor, contributor, challenger), and each wallet’s displayed per-transaction cost. Wallet identities and case-specific fee prompts are not available in this audit. Do not use an assumed total fee; stop if any wallet prompt or network differs from the separately approved plan.
4. Prepare two cases with valid official baseline facts that identify the subject but leave the precommitted binary rule insufficient. Use the approved bounty range and the exact displayed contributor/challenger bond for each case.

## Shared case path

For each case, capture the transaction hash, finalized receipt, explorer URL, and the corresponding contract readback after every write:

1. Sponsor creates a case with one to three HTTPS official baseline sources and the approved question, rule, outcomes, source policy, closing time, and bounty.
2. Confirm the baseline result is `READY` with `INSUFFICIENT_EVIDENCE`, then confirm the case is `OPEN` and the full bounty remains in case escrow.
3. Original contributor commits a hash binding chain `61999`, V2 Registry, case ID, contributor, source URL, exact fact, and salt. Wait for `FINALIZED` plus `FINISHED_WITH_RETURN` before revealing from the same wallet/browser profile.
4. Reveal the matching source, fact, and salt. Confirm the V2 verifier result is `VERIFIED`, all six verification flags are true, and the closure judge evaluated both the prior and expanded evidence graphs.
5. Confirm the result is `PROVISIONAL_CLOSURE`; no bounty or original contributor bond is claimable during the challenge period.
6. A distinct challenger commits against the exact provisional submission and reveals only after the challenge commitment is finalized. Confirm the Registry enters `CHALLENGE_REVIEW` and the adjudicator reads the original decision rule and decisive evidence packet.

## Case A — challenge is factual but does not change the result

Use an admissible, supported, same-subject and time-correct counterfact that is immaterial or does not contradict the decisive evidence. Confirm `VERDICT_UPHELD`, unchanged provisional outcome, and no early finalization while the challenge window remains open. After the challenge deadline, any wallet calls `finalize_provisional`. Confirm the original contributor receives the bounty and contributor-bond credit, the upheld challenger receives their bond credit, and each recipient withdraws only their own credit.

## Case B — challenge materially overturns the result

Use an admissible official counterfact that is supported, same-subject, time-correct, contradictory, material, and changes the original rule’s result to the opposite decisive outcome. Confirm `VERDICT_OVERTURNED` and `CHALLENGE_RESOLVED`. Any wallet then calls `finalize_provisional` without waiting out the original challenge deadline. Confirm the challenger receives the bounty and challenger-bond credit, the original contributor receives their bond refund, and each recipient withdraws only their own credit.

## Optional Case C — overturn leaves the evidence insufficient

If separately approved, use a material challenge that changes the result to `INSUFFICIENT_EVIDENCE`. Confirm `REOPENED`, both bond credits, and unchanged bounty escrow; call `reopen_case` while the extended case window remains live. Continue with a new evidence contribution before testing final settlement. Do not report this path as a completed bounty-winning case.

## Conservation and evidence checklist

After every finalized write, read Registry stats and verify:

`total_deposited = case_escrow + bond_escrow + total_claimable + total_withdrawn`

At terminal settlement, confirm `CLOSED`, the expected final outcome and winner, zero remaining bounty, one-time bond release flags, recipient-bound credits, and successful withdrawals. Preserve failed, rejected, timed-out, and inconclusive transactions in the record; do not retry a transaction unless its exact receipt and resulting contract state show that it was not applied.

Record every transaction hash and explorer URL for case creation/baseline, evidence commit/reveal, verification, provisional closure, challenge commit/reveal/review, finalization, and withdrawals. Record readbacks and displayed fees alongside them. Mark this plan executed only after the evidence is complete; the plan is not itself evidence of a live run.
