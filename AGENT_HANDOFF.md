# Crux final execution goal

You are finishing an already-built GenLayer project. **This is an execution task, not a review task.** Work directly in this repository, preserve the core Crux design, repair anything that real tooling proves is wrong, deploy it, connect the exact deployment to the frontend, execute the live flow, update evidence, and leave the repository submission-ready.

## Non-negotiable network

Crux is **Studionet only**.

- network preset: `studionet`
- chain ID: `61999`
- RPC: `https://studio.genlayer.com/api`
- explorer: `https://explorer-studio.genlayer.com`

Do not use, mention as a deployment target, or silently migrate to 61997, Studio-dev, Studio Next, Bradbury, Asimov or Localnet for the final deployment. Local/static analysis tools are fine, but the deployed release must be 61999. `deploy/deployCrux.ts` intentionally refuses another chain ID.

## Wallet rule

The web app must remain **generic injected EIP-1193 only**. It uses `window.ethereum`. No MetaMask Snaps, `wallet_getSnaps`, `wallet_invokeSnap`, WalletConnect, Privy, embedded wallet, server-held key or local private key in the frontend. A normal browser wallet that exposes EIP-1193 is allowed. Keep wrong-network handling for 61999.

## Product to preserve

Crux is an evidence completion market, not a generic dispute app and not Lacuna.

A funded case must begin genuinely unresolved. Contributors reserve evidence with commit-reveal. `EvidenceVerifier` fetches the public source and determines whether the exact fact is admissible and supported. `ClosureJudge` separately determines whether the complete accepted evidence graph now resolves the fixed decision rule. Verified evidence can be useful but still non-closing. The first verified contribution that moves the case from insufficient evidence to either outcome closes the market and earns the bounty.

Preserve the three-contract split unless an actual GenVM limitation forces a change:

1. `contracts/crux_registry.py`
2. `contracts/evidence_verifier.py`
3. `contracts/closure_judge.py`

Do not collapse this into one LLM call. Do not move source verification or winner selection to a backend/API. Do not add an admin verdict or operator override.

## First: load current GenLayer guidance

Use official GenLayer context before changing GenLayer-specific code.

For Claude Code:

```text
/plugin marketplace add genlayerlabs/skills
/plugin install genlayer-dev@genlayerlabs
```

Add docs MCP when available:

```bash
claude mcp add genlayer-docs --transport sse https://docs-mcp.genlayer.com/sse
claude mcp add genlayer npx -- -y genlayer-mcp
```

Use `write-contract` while inspecting/fixing contracts, `genvm-lint` after every contract change, `direct-tests` for fast state/consensus tests, `integration-tests` for real network behaviour, and `genlayer-cli` for deployment/schema/receipt/trace work. If MCP is unavailable, use the official full docs/SDK references. **Never guess an API.**

## Phase 1 — validate the implementation, do not redesign it blindly

Read in this order:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- all three contracts
- `tests/direct/`
- frontend integration in `frontend/lib/`
- all pages in `frontend/app/`
- `docs/LIVE_DEMO.md`
- `docs/REVIEW_EVIDENCE.md`

Then run the actual quality gates:

```bash
python -m venv .venv
# activate it
pip install -r requirements.txt

genvm-lint check contracts/crux_registry.py --json
genvm-lint check contracts/evidence_verifier.py --json
genvm-lint check contracts/closure_judge.py --json

pytest tests/direct/ -v
```

Fix every linter error and every direct-test failure. Do not delete meaningful tests to get green. If current stable Studionet uses a newer compatible SDK/tool package than the pinned verification toolchain, verify the official stable Studionet release first, update pins deliberately, and record why. Do **not** install a Studio-dev RC simply because it is newer.

Pay special attention to these areas because this build environment could not execute GenVM tooling:

- cross-contract `emit(on="finalized")` call syntax and callback sender semantics;
- storage compatibility for JSON-backed `TreeMap`/`DynArray` usage;
- `gl.vm.run_nondet_unsafe` return encoding and validator replay;
- value transfer via `emit_transfer`;
- child-message timing and state preservation after finality;
- the Registry constructor with verifier/judge addresses;
- `datetime`/`gl.message_raw` use on stable Studionet;
- `while`/`list`/local Python constructs that `genvm-lint` may restrict.

When fixing these, preserve the state machine and trust boundaries instead of weakening them.

## Phase 2 — strengthen tests where real tooling exposes gaps

The existing direct suite must cover at minimum:

- funded case creation;
- invalid/already-decidable baseline refund;
- baseline must be `INSUFFICIENT_EVIDENCE` before opening;
- sponsor cannot submit to own bounty;
- exact bond enforcement;
- commitment binding to `crux-v1`, chain 61999, Registry, case, wallet, URL, fact and salt;
- duplicate commitment rejection;
- reveal ownership/deadline;
- substantive validator disagreement in EvidenceVerifier;
- source unavailable as retryable non-decision;
- rejected evidence cannot close a case;
- verified non-closing evidence is appended to the graph;
- later evidence can compose with earlier evidence and close;
- ClosureJudge validator disagreement;
- timeout/inconclusive paths;
- stale callbacks after case closure/expiry;
- no double settlement;
- accounting invariant after every economic path;
- withdrawal cannot be redirected by a third party.

Add regression tests for anything you fix. A format-only validator is unacceptable: validators must reproduce the substantive fields/outcome.

Then run:

```bash
CRUX_RUN_STUDIONET_INTEGRATION=1 gltest tests/integration/ -v -s
```

The current integration test is a deployment/schema smoke. Extend it only where the stable network and available accounts make automated coverage reliable. Do not fake a "live" test with mocks and label it real.

## Phase 3 — frontend verification and finish

The visual direction is intentional: editorial/protocol, warm paper, near-black ink, acid chartreuse, hard lines, no purple AI gradients, no glass-card template, no stock art, no generic shadcn dashboard look. Keep it simple and distinctive.

Required pages already exist and must remain genuinely separate routes:

- `/` — hero-first landing page
- `/cases` — browse/search market
- `/cases/[id]` — full case, rule, accepted evidence graph, submissions, commit/reveal
- `/create` — funded case creation
- `/activity` — pending reveal recovery, credits, wallet submissions
- `/protocol` — architecture/trust explanation

Run:

```bash
cd frontend
npm install
npm run typecheck
npm run build
```

Fix all TypeScript/build issues. Confirm every contract method name and argument order against the generated deployed schema; do not infer them from source only. The UI must use `genlayer-js` reads/writes and the actual Registry. No mock case data in production paths.

Check manually at desktop and mobile widths:

- hero does not overflow;
- nav works;
- injected wallet connects;
- wrong network offers 61999 switch/add;
- create case shows signing/submitted/finality feedback;
- every write surfaces a clickable explorer hash;
- pending reveal survives refresh in local storage;
- reveal can recover submission ID from `get_submission_for_commitment`;
- errors are understandable and do not leave stale successful UI;
- accepted evidence graph updates after finalized state;
- closed case shows winner/final outcome;
- activity credit can withdraw;
- no Snap API appears anywhere (`grep -R -i "snap\|wallet_getSnaps\|wallet_invokeSnap" frontend` and manually inspect false positives).

If the current stable `genlayer-js` API differs, use official Studionet docs to update it. Keep EIP-1193 signing and chain 61999.

## Phase 4 — deploy the actual release

Install/use the stable CLI supported by Studionet. Then:

```bash
genlayer network set studionet
genlayer network info
```

Stop if the reported chain is not `61999` or RPC is not `https://studio.genlayer.com/api`.

From the repository root run the multi-contract deployment:

```bash
npm install
genlayer deploy
```

The intended order is:

1. EvidenceVerifier
2. ClosureJudge
3. CruxRegistry(verifier_address, judge_address)

Wait for each deployment to reach the lifecycle point required before using its address. If `deploy/deployCrux.ts` needs a compatibility fix for the current stable CLI/client, fix it from official docs. Do not manually paste guessed addresses.

On success ensure these are generated with the real finalized addresses:

- `deployments/studionet.json`
- `frontend/.env.local`

Verify source/schema/read state:

```bash
genlayer schema <VERIFIER>
genlayer schema <JUDGE>
genlayer schema <REGISTRY>
genlayer code <REGISTRY>
genlayer call <REGISTRY> get_stats
```

`get_stats` must report chain `61999`, the exact verifier/judge addresses, `admin_controls=false`, and balanced accounting.

If any transaction fails, do not redeploy blindly. Inspect:

```bash
genlayer receipt <TX_HASH> --stdout --stderr
genlayer trace <TX_HASH>
```

Repair the cause, rerun lint/tests, then redeploy a clean final set.

## Phase 5 — execute a real two-wallet market

Follow `docs/LIVE_DEMO.md` using two distinct funded Studionet wallets. Use real public source fetching and real GenLayer consensus.

Minimum live evidence:

1. sponsor creates and funds a case;
2. baseline validates to insufficient and opens;
3. contributor commits evidence;
4. contributor reveals;
5. EvidenceVerifier returns VERIFIED;
6. ClosureJudge returns a definite outcome;
7. Registry closes and allocates bounty;
8. contributor withdraws credit;
9. one negative path is demonstrated, preferably a disallowed source or `VERIFIED_NON_CLOSING` fact.

For every step record the explorer hash/address. Verify that the frontend reaches the same deployed contracts, not an old address.

## Phase 6 — release evidence and cleanup

Update:

- `README.md` with deployed app URL, exact addresses and concise run/deploy instructions;
- `deployments/studionet.json` with only the final deployment set;
- `docs/REVIEW_EVIDENCE.md` with actual command results, exact contract addresses, explorer transaction hashes, live app URL and negative-path evidence;
- `docs/LIVE_DEMO.md` if any exact live flow differs from the proposed one;
- frontend `.env.example` only if configuration keys changed.

Add a deployment section with direct explorer links. Do not claim "all tests pass", "live", "finalized" or "verified" unless you actually obtained the corresponding output.

Remove dead mock data, unused components, generated junk, accidental keys, secrets, `.env.local` from Git tracking, and any reference to 61997 as a target. Keep useful docs and tests.

## Definition of done

Do not stop at a plan or report. The task is complete only when:

- all three contracts lint clean with the installed stable Studionet toolchain;
- direct tests pass;
- opt-in Studionet integration smoke passes;
- frontend typecheck and production build pass;
- three final contracts are deployed on **61999** and their schemas/source match this repository;
- frontend is configured to those exact addresses and is deployed/usable;
- generic injected EIP-1193 wallet works with no Snaps;
- the complete two-wallet live case closes from real web evidence and real validator consensus;
- explorer evidence is recorded;
- a negative/retryable or non-closing path is demonstrated;
- `docs/REVIEW_EVIDENCE.md` is filled with real evidence;
- no unresolved TODO remains in release-facing docs.

If something external blocks completion, identify the exact blocker and the exact manual action required (for example, connect/fund the second Studionet wallet or approve a hosting login), complete everything else first, and leave the repository in a state where that one manual action is the only remaining step.
