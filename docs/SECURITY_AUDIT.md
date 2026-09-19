# Crux security remediation audit

## Scope

Start commit: `ff7ece9` (`Polish wallet UX and add live demo`).

This audit covers the Registry, EvidenceVerifier, ClosureJudge, deployment bootstrap, escrow lifecycle, CI and frontend reveal persistence. The approved remediated deployment was executed on Studionet chain `61999` only.

## Confirmed findings and fixes

| Severity | Finding | Remediation |
| --- | --- | --- |
| High | Verifier and judge trusted a caller-supplied Registry address, allowing an arbitrary contract to occupy predictable request IDs and trigger callbacks. Affected: `contracts/evidence_verifier.py:127-144`, `contracts/closure_judge.py:112-128`. | Verifier and judge now bind to an immutable constructor Registry address. Registry uses a one-time deployer bootstrap at `contracts/crux_registry.py:245-256` to bind the two child addresses, then clears the bootstrap authority. Duplicate request IDs remain rejected. |
| Medium | `SOURCE_UNAVAILABLE` baseline recovery changed status without persisting it. Affected: `contracts/crux_registry.py:340-343`. | The retryable state and review are now saved before returning. |
| Medium | Terminal historical submissions consumed the permanent 40-entry limit. Affected: `contracts/crux_registry.py:369-376`. | Capacity is calculated from active `COMMITTED`, `VERIFICATION_PENDING` and `CLOSURE_PENDING` submissions while historical records remain queryable. |
| High | Multiple evidence packets could be adjudicated against the same evidence graph, allowing stale callback ordering. Affected: `contracts/crux_registry.py:414-422`. | Registry now serializes evidence adjudication to one pending verification/closure flow per case; expiry and callback status checks remain authoritative. |
| High | Closure judged only the post-candidate graph and did not establish that the candidate changed an insufficient graph. Affected: `contracts/closure_judge.py:119-130`, `contracts/crux_registry.py:493-496`. | ClosureJudge now evaluates the prior graph and rejects adjudication when it was already decidable. The Registry passes both prior and post-candidate graphs. |
| Medium | A contributor could commit too near case expiry to have a valid reveal window. Affected: `contracts/crux_registry.py:369`. | Commit is rejected unless the full reveal timeout fits before `closes_at`. |
| Medium | Frontend deleted reveal salts before final confirmation. Affected: `frontend/app/cases/[id]/page.tsx:79-80`, `frontend/app/activity/page.tsx:64`. | Pending reveal data is retained until the reveal transaction reaches finality; uncertain or failed transactions keep the salt available. |
| Low | CI depended on an unavailable GenVM release cache. Affected: `.github/workflows/quality.yml:16-17`. | CI pins the supported `v0.2.12` runtime used by the contract headers and linter cache. |

## Verification

- `genvm-lint` v0.11.0 with `GENVM_VERSION=v0.2.12`: all three contracts passed lint and validation.
- Direct GenVM tests: `18 passed`.
- Frontend typecheck: passed.
- Frontend production build: passed; the host emits a non-fatal missing `eslint-config-next` warning from an external root ESLint config.
- Deployment TypeScript compile: passed.

## Deployment requirements

The finalized Studionet deployment uses the updated bootstrap sequence in `deploy/deployCrux.ts` on chain `61999` only:

1. Deploy Registry unbound with empty child addresses.
2. Deploy EvidenceVerifier with the Registry address.
3. Deploy ClosureJudge with the Registry address.
4. Call the one-time Registry component binding.
5. Verify final receipts, addresses and callback behavior before updating any frontend configuration.

Independent verification on 2026-09-19 confirmed the remediated Registry at `0xfBed1c827D3A5Ae6F60D3e027df6fe7fa42a00D8` has `components_configured=true`, `accounting_balanced=true`, `admin_controls=false`, exact verifier/judge bindings, and chain ID `61999` at `https://studio.genlayer.com/api`. The corrected live case `cx-3` is still `BASELINE_PENDING`; no positive payout is claimed.

## Remaining issues

The follow-up audit found and fixed a lifecycle fairness defect in the source: a contributor whose reveal was valid could previously be rejected while another submission was pending. The source now queues revealed submissions, bounds active work at 40, refunds protocol-blocked commitments, and preserves one-time settlement. The frontend now retains sealed data through every uncertain commit/reveal outcome and reconciles finalized submission state before deleting the salt. The direct suite has 21 passing tests.

The follow-up source changes are deployed to the new Studionet addresses in `deployments/studionet.json`. The frontend is configured for `https://crux-end.vercel.app`, but the required two-wallet positive lifecycle is not yet complete because `cx-3` remains baseline-pending. **NOT READY FOR SUBMISSION** until that callback resolves and the commit/reveal/closure/withdrawal hashes are recorded.
