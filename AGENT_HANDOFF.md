# Crux V2.2 release handoff

This is the current release handoff for the Crux Challenge V2.2 product. It replaces the earlier deployment-runbook
handoff, which is retained only in Git history. The repository is being reconciled on branch `challenge-v2`; this pass
does not deploy contracts, spend GEN, publish Vercel, or merge `main`.

## Active release

- Network: GenLayer Studionet, chain `61999` only.
- RPC: `https://studio.genlayer.com/api` only.
- Current V2.2 source identity: `0a3120b659b7ae953aae1cf4b8ac8fd18d50e1d7`.
- Production frontend: [`https://crux-end.vercel.app`](https://crux-end.vercel.app), with `/challenge` wired to the V2.2 Registry.
- V2.2 Registry: `0x96F27D5B78F3c98db6eE5C6d6DA3B4dCCa050F2E`.
- Evidence Verifier: `0x316aD5aeA2a010220107E676561507121E6356b5`.
- Closure Judge: `0x8c9Acf52F7C8502e957a37231CE1B53097703312`.
- Challenge Adjudicator: `0xeBFd81ae1e1DB3011439e38263E7971aCc6a306D`.
- V1 remains a separate, unchanged three-contract product. Historical V2 and V2.1 deployments are not valid targets for new cases.

The five V2.2 setup receipts, source hashes, independent readback, live lifecycle evidence, and known scope limits are
recorded in [`deployments/challenge-v2-2-studionet.json`](deployments/challenge-v2-2-studionet.json),
[`docs/LIVE_DEMO.md`](docs/LIVE_DEMO.md), and [`docs/REVIEW_EVIDENCE.md`](docs/REVIEW_EVIDENCE.md).

## Architecture and trust boundary

V2.2 is a four-contract system: the Registry owns case state and funds; the Evidence Verifier validates baseline and
contributor evidence; the Closure Judge decides the provisional case result; and the Challenge Adjudicator evaluates
admitted counterevidence against the exact challenged evidence packet. Child contracts authenticate the Registry, and
the Registry authenticates every callback by sender, case, round, and pending operation. No backend signer or operator
verdict is part of the product.

The lifecycle is: baseline retrieval and decision, sealed commit/reveal, source-grounded verification, provisional
closure, bounded challenge admission, challenge commit/reveal, adjudication, verdict callback, permissionless
finalization, settlement, recipient-bound withdrawal, and explicit child-transfer receipt reconciliation.

The approved V2.2 parameters are eight normal challenge attempts per provisional round, one protected appeal at twice
the normal bond, at most four simultaneous pending challenge commitments, one-hour admission, a full reveal timeout
for each admitted commitment, bounded review/recovery deadlines, and per-round accounting. A stored case ends in
`CLOSED`; `FINALIZED` describes a finalized transaction/result, not a case status.

## Deployment safety boundary

The `deploy/` directory is auto-discovered by the GenLayer CLI. Every entrypoint must therefore fail closed:

- `deploy/deployCrux.ts` skips ordinary CLI execution and requires `CRUX_DEPLOY_V1_ONLY=1` plus
  `CRUX_DEPLOY_V1_AUTHORIZED=YES` before any V1 write.
- The superseded `deploy/deployChallengeV2.ts` requires its own V2 flag, authorization, legacy acknowledgement, and
  exact approved source commit. It cannot be activated by V2.1 or V2.2 flags.
- V2.1 and V2.2 keep their existing isolated guards and exact chain/RPC/source checks.
- Existing manifests and the V1 frontend environment are not overwritten by default.
- A submitted transaction hash is recorded before waiting; ambiguous stages are not retried blindly.
- No deployment command is part of the ordinary test suite. The current V2.2 deployment is complete and must not be rerun.

Never use chain `61997`, a non-Studionet RPC, an unapproved signer, a replacement manifest, or a backend wallet.

## Verification record

The current evidence scope includes a baseline-already-decidable refund path (`cx-1`) and a complete upheld-challenge
path (`cx-2`) with verifier, challenge, adjudicator, finalization, closure, bounty settlement, and two ordinary EOA
withdrawal child receipts. Material overturn, disallowed-source, and retryable-unavailable-source paths remain disclosed
as unexecuted; they are not silently treated as passed.

The final reconciliation must rerun and record frontend tests, TypeScript, production build, V1/V2.2 contract lint and
direct tests, deployment-safety tests, documentation/link checks, and the exact GitHub Actions conclusion for the final
commit. The official network integration test is write-producing and is not run in this no-write reconciliation unless a
separate explicit authorization is provided.

The completed reconciliation is recorded in [`docs/REVIEW_EVIDENCE.md`](docs/REVIEW_EVIDENCE.md): local semantic lints,
direct tests, frontend tests, typecheck, build, deployment-entrypoint checks, and local link integrity passed; GitHub
Actions run `38876891188` for commit `ef84d750c17be912f4b409238b6f5244ee4326f5` concluded `success`.

## Main-branch boundary

`challenge-v2` is prepared for review against `main`. Do not merge `main` in this task. A pull request may be prepared
after the tree, tests, documentation, and CI are reconciled; merge remains a separate explicit approval.
