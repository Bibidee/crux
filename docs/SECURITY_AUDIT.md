# Crux security remediation audit

## Scope

Start commit: `ff7ece9` (`Polish wallet UX and add live demo`).

This audit covers the Registry, EvidenceVerifier, ClosureJudge, deployment bootstrap, escrow lifecycle, CI and frontend reveal persistence. No production deployment, production configuration change, or push was performed.

## Confirmed findings and fixes

| Severity | Finding | Remediation |
| --- | --- | --- |
| High | Verifier and judge trusted a caller-supplied Registry address, allowing an arbitrary contract to occupy predictable request IDs and trigger callbacks. | Verifier and judge now bind to an immutable constructor Registry address. Registry uses a one-time deployer bootstrap to bind the two child addresses, then clears the bootstrap authority. Duplicate request IDs remain rejected. |
| Medium | `SOURCE_UNAVAILABLE` baseline recovery changed status without persisting it. | The retryable state and review are now saved before returning. |
| Medium | Terminal historical submissions consumed the permanent 40-entry limit. | Capacity is calculated from active `COMMITTED`, `VERIFICATION_PENDING` and `CLOSURE_PENDING` submissions while historical records remain queryable. |
| High | Multiple evidence packets could be adjudicated against the same evidence graph, allowing stale callback ordering. | Registry now serializes evidence adjudication to one pending verification/closure flow per case; expiry and callback status checks remain authoritative. |
| High | Closure judged only the post-candidate graph and did not establish that the candidate changed an insufficient graph. | ClosureJudge now evaluates the prior graph and rejects adjudication when it was already decidable. The Registry passes both prior and post-candidate graphs. |
| Medium | A contributor could commit too near case expiry to have a valid reveal window. | Commit is rejected unless the full reveal timeout fits before `closes_at`. |
| Medium | Frontend deleted reveal salts before final confirmation. | Pending reveal data is retained until the reveal transaction reaches finality; uncertain or failed transactions keep the salt available. |
| Low | CI depended on an unavailable GenVM release cache. | CI pins the supported `v0.2.12` runtime used by the contract headers and linter cache. |

## Verification

- `genvm-lint` v0.11.0 with `GENVM_VERSION=v0.2.12`: all three contracts passed lint and validation.
- Direct GenVM tests: `16 passed`.
- Frontend typecheck: passed.
- Frontend production build: passed; the host emits a non-fatal missing `eslint-config-next` warning from an external root ESLint config.
- Deployment TypeScript compile: passed.

## Deployment requirements

The current Studionet deployment is unchanged and therefore does not contain these remediations. An approved future redeployment must use the updated bootstrap sequence in `deploy/deployCrux.ts` on chain `61999` only:

1. Deploy Registry unbound with empty child addresses.
2. Deploy EvidenceVerifier with the Registry address.
3. Deploy ClosureJudge with the Registry address.
4. Call the one-time Registry component binding.
5. Verify final receipts, addresses and callback behavior before updating any frontend configuration.

Existing live contracts remain the previously documented Studionet deployment and must be treated as pre-remediation until that approved deployment occurs.

## Remaining issues

No critical protocol defect remains in the locally tested source. Production readiness is withheld because the live contracts have not been redeployed and the required live lifecycle evidence has not been re-executed against the remediated bytecode, as prohibited without explicit approval.
