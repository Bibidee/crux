# Crux

**Find the fact that changes the answer.**

Crux is a GenLayer-native evidence completion market. A sponsor funds a question that is *not yet decidable* from a set of public baseline facts. Contributors reserve and reveal new public evidence. GenLayer validators fetch the source, verify the proposed fact, and separately judge whether the accumulated verified evidence now makes the original rule decidable. The first contribution that closes the gap earns the bounty.

This repository is locked to **GenLayer Studionet**:

- chain ID: `61999`
- RPC: `https://studio.genlayer.com/api`
- explorer: `https://explorer-studio.genlayer.com`
- browser wallet: injected **EIP-1193 only** (`window.ethereum`), no Snaps

## Why the contracts are split

Crux deliberately separates three responsibilities.

1. `CruxRegistry` owns terms, escrow, commit-reveal reservations, accepted evidence, credits, timeouts and final settlement. It also verifies that the baseline genuinely starts in `INSUFFICIENT_EVIDENCE`.
2. `EvidenceVerifier` independently fetches the submitted public source and replays six substantive verification fields: same subject, source policy, claim support, time scope, novelty and non-contradiction.
3. `ClosureJudge` receives only verified facts and applies the precommitted rule. A true fact can still be `VERIFIED_NON_CLOSING`; it joins the evidence graph for a later contributor.

This avoids collapsing two different questions into one LLM call: **is the fact established?** and **does the fact resolve the case?**

## Main flow

```text
sponsor funds case
      │
      ▼
baseline sources fetched + checked
      │
      ├── already decidable / invalid ──► sponsor credit
      │
      ▼
INSUFFICIENT_EVIDENCE → OPEN
      │
      ▼
contributor commit (sealed URL + fact + salt)
      │
      ▼
contributor reveal
      │
      ▼
EvidenceVerifier fetches source
      │
      ├── SOURCE_UNAVAILABLE ──► retryable + bond refund
      ├── REJECTED ────────────► bond to sponsor
      ▼
VERIFIED
      │
      ▼
ClosureJudge applies original rule to full accepted graph
      │
      ├── INSUFFICIENT_EVIDENCE ──► fact joins graph + bond refund
      ▼
OUTCOME_A / OUTCOME_B
      │
      ▼
bounty + bond credited to closing contributor
```

## Repository

```text
contracts/
  crux_registry.py
  evidence_verifier.py
  closure_judge.py
frontend/
  app/                    # Next.js multi-page app
  components/
  lib/
tests/
  direct/                 # fast mocked contract tests
  integration/            # opt-in Studionet deployment smoke test
deploy/
  deployCrux.ts            # deploys verifier → judge → registry
docs/
  ARCHITECTURE.md
  SECURITY.md
  LIVE_DEMO.md
  REVIEW_EVIDENCE.md
AGENT_HANDOFF.md
```

## Contract invariants

- A case cannot open if its baseline is invalid or already decisive.
- The sponsor cannot compete for their own bounty.
- Evidence commitments bind chain `61999`, Registry address, case, contributor, URL, claimed fact and salt.
- Duplicate commitments are rejected; revealed evidence packets are reserved by case + URL + fact digest.
- `SOURCE_UNAVAILABLE` is not a negative verdict. It refunds the contributor bond and leaves the case open.
- Verification must agree on substantive decision fields, not JSON shape or reasoning prose.
- A verified fact does not automatically earn the bounty. Closure is a separate consensus decision.
- Accounting must satisfy `total_deposited = case_escrow + bond_escrow + claimable + withdrawn`.
- No admin setter can replace verifier/judge contracts after Registry deployment.
- No protocol fee or operator override is present.

## Local quality gates

Use Python 3.12+.

```bash
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1

pip install -r requirements.txt

genvm-lint check contracts/crux_registry.py --json
genvm-lint check contracts/evidence_verifier.py --json
genvm-lint check contracts/closure_judge.py --json

pytest tests/direct/ -v
```

Then the frontend:

```bash
cd frontend
npm install
npm run typecheck
npm run build
```

The optional hosted integration smoke writes three contracts to Studionet:

```bash
CRUX_RUN_STUDIONET_INTEGRATION=1 gltest tests/integration/ -v -s
```

## Deploy to Studionet

Do **not** use Studio-dev, Studio Next, Bradbury, Asimov or Localnet for the release deployment.

```bash
npm install -g genlayer
npm install

genlayer network set studionet
genlayer network info
# Confirm chain ID 61999 and https://studio.genlayer.com/api before continuing.

genlayer deploy
```

`deploy/deployCrux.ts` refuses to continue unless the configured client chain is exactly `61999`. The secure bootstrap deploys an unbound Registry, deploys both adjudication contracts bound to that Registry, then performs a one-time Registry component binding. On success it writes:

- `deployments/studionet.json`
- `frontend/.env.local`

Verify every address before launching the UI:

```bash
genlayer schema <VERIFIER_ADDRESS>
genlayer schema <JUDGE_ADDRESS>
genlayer schema <REGISTRY_ADDRESS>
genlayer call <REGISTRY_ADDRESS> get_stats
```

If a deployment transaction fails, inspect it before changing code:

```bash
genlayer receipt <TX_HASH> --stdout --stderr
genlayer trace <TX_HASH>
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Pages:

- `/` editorial hero and protocol overview
- `/cases` live case market
- `/cases/[id]` rule, evidence graph, submissions, commit/reveal
- `/create` funded case creation flow
- `/activity` browser reveal queue, Registry credits and wallet submissions
- `/protocol` architecture and trust boundaries

The wallet layer uses generic injected EIP-1193 methods only. It never calls `wallet_getSnaps`, `wallet_invokeSnap`, or any Snap API.

## Commit-reveal recovery

The browser generates a 32-byte salt and stores the pending reveal in local storage after the user starts the commitment transaction. The Registry also exposes `get_submission_for_commitment` so the second transaction can recover the on-chain submission ID after finality. Clearing browser site data before reveal destroys the locally stored salt; the UI states this explicitly.

## Source caveat

GenVM web rendering can follow redirects while the currently exposed API does not provide a redirect-chain proof to the contract. Crux therefore treats the submitted URL and source policy as part of validator judgment and records the requested URL, not a cryptographically proven final redirect target. For high-value deployments, prefer stable first-party URLs and source policies that identify acceptable hosts explicitly. Do not claim redirect-chain verification unless the GenVM API adds it and the contract is updated to use it.

## Release status

The historical Studionet deployment and complete two-wallet evidence flow passed on chain `61999`; the live frontend is [https://crux-end.vercel.app](https://crux-end.vercel.app). Those addresses and transactions are recorded in [`deployments/studionet.json`](deployments/studionet.json) and [`docs/REVIEW_EVIDENCE.md`](docs/REVIEW_EVIDENCE.md). That deployment predates the security remediation in [`docs/SECURITY_AUDIT.md`](docs/SECURITY_AUDIT.md) and must not be treated as remediated or production-ready until an approved redeployment is completed.

Deployment set (unlocked CLI, Studionet chain 61999):

- EvidenceVerifier: `0x58eD91e219A96639b30ec23C860217ef9Fc4eCCb`
- ClosureJudge: `0x947503895f34f34FaafF21f2c89C8b0EbCaD46db`
- CruxRegistry: `0x5789b330f90CFBDa2DCBdeF7A66cbA1247Ec9107`
- Explorer: [Studionet explorer](https://explorer-studio.genlayer.com)
