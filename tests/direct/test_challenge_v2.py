import hashlib
import json
import pytest

from tests.direct.conftest import NOW, addr, warp

BOUNTY = 10**16
BOND = 10**14
BASELINE = json.dumps([{"url": "https://example.com/project",
                        "fact": "Package X version 4.2 is published by Example Project."}])
RULE = "Outcome A requires the upstream licence to permit commercial redistribution; outcome B requires an explicit prohibition; otherwise the case is insufficient."


def deploy_registry(vm, deploy, sponsor, callback_wallet):
    vm.sender = sponsor
    registry = deploy("contracts/crux_challenge_registry.py", "", "", "")
    vm.sender = sponsor
    registry.configure_components(addr(callback_wallet), addr(callback_wallet), addr(callback_wallet))
    return registry


def open_case(vm, registry, sponsor, closes_at=None):
    vm.sender, vm.value = sponsor, BOUNTY
    expiration = closes_at or NOW + 7200
    case_id = registry.create_case(
        "Package X licence", "Can package X version 4.2 be redistributed commercially?",
        RULE, "Allowed", "Prohibited", "Official upstream sources and first-party registries only.",
        BASELINE, expiration,
    )
    vm.value = 0
    vm.sender = vm._contract_address
    vm.mock_web(r".*example\.com/project.*", {"status": 200, "body": "Example Project publishes package X version 4.2."})
    vm.mock_llm(r"(?s).*CRUX_CHALLENGE_BASELINE_V2.*", json.dumps({
        "status": "READY", "outcome": "INSUFFICIENT_EVIDENCE",
        "basis": "The baseline identifies the package but contains no licence permission."
    }))
    registry.validate_baseline(case_id)
    assert vm.run_validator() is True
    assert registry.get_case(case_id)["status"] == "OPEN"
    return case_id


def create_provisional(vm, registry, sponsor, contributor, callback_wallet, case_id=None):
    case_id = case_id or open_case(vm, registry, sponsor)
    url = "https://example.com/licence"
    fact = "The upstream licence permits commercial redistribution of package X version 4.2."
    salt = "11" * 32
    payload = ["crux-challenge-v2", "61999", addr(vm._contract_address).lower(), case_id,
               addr(contributor).lower(), url, fact, salt]
    commitment = hashlib.sha256(json.dumps(payload, ensure_ascii=False, separators=(",", ":"),
                                         sort_keys=True).encode()).hexdigest()
    vm.sender, vm.value = contributor, BOND
    submission_id = registry.commit_evidence(case_id, commitment)
    vm.value = 0
    registry.reveal_evidence(submission_id, url, fact, salt)
    vm.sender = callback_wallet
    registry.record_verification(submission_id, json.dumps({
        "status": "VERIFIED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "The upstream licence supports permission."
    }))
    registry.record_closure(submission_id, json.dumps({
        "outcome": "OUTCOME_A", "sufficient": True, "decisive_evidence_ids": [submission_id],
        "basis": "The verified licence satisfies the decision rule."
    }))
    case = registry.get_case(case_id)
    assert case["status"] == "PROVISIONAL_CLOSURE"
    assert case["winner"] == ""
    assert case["final_outcome"] == ""
    assert case["remaining_bounty_atto"] == str(BOUNTY)
    return case_id, submission_id


def challenge_commitment(vm, case_id, decision_id, challenged_evidence_id, challenger,
                         source_url, counterclaim, salt):
    payload = ["crux-challenge-v2", "61999", addr(vm._contract_address).lower(), case_id,
               decision_id, challenged_evidence_id, addr(challenger).lower(), source_url, counterclaim, salt]
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, separators=(",", ":"),
                                     sort_keys=True).encode()).hexdigest()


def submit_challenge(vm, registry, case_id, decision_id, challenger, callback_wallet):
    source_url = "https://example.com/counterevidence"
    counterclaim = "The same version's official licence prohibits commercial redistribution."
    salt = "22" * 32
    digest = challenge_commitment(vm, case_id, decision_id, decision_id, challenger,
                                  source_url, counterclaim, salt)
    vm.sender, vm.value = challenger, BOND
    challenge_id = registry.commit_challenge(case_id, decision_id, decision_id, digest)
    vm.value = 0
    registry.reveal_challenge(challenge_id, source_url, counterclaim, salt)
    assert registry.get_challenge(challenge_id)["status"] == "REVIEW_PENDING"
    return challenge_id


def submit_evidence(vm, registry, case_id, contributor, source_url, fact, salt="33" * 32):
    payload = ["crux-challenge-v2", "61999", addr(vm._contract_address).lower(), case_id,
               addr(contributor).lower(), source_url, fact, salt]
    digest = hashlib.sha256(json.dumps(payload, ensure_ascii=False, separators=(",", ":"),
                              sort_keys=True).encode()).hexdigest()
    vm.sender, vm.value = contributor, BOND
    submission_id = registry.commit_evidence(case_id, digest)
    vm.value = 0
    registry.reveal_evidence(submission_id, source_url, fact, salt)
    return submission_id


def review(status, new_outcome="OUTCOME_A", **overrides):
    result = {
        "status": status, "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "contradicts": True,
        "material": True, "new_outcome": new_outcome, "basis": "Independent challenge review result."
    }
    result.update(overrides)
    return json.dumps(result)


def test_provisional_bounty_locked_and_permissionless_finalize(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    assert registry.get_credit(addr(direct_bob)) == "0"
    assert registry.get_submission(submission_id)["status"] == "PROVISIONAL_WINNER"
    with pytest.raises(Exception, match="challenge window has not closed"):
        registry.finalize_provisional(case_id)
    direct_vm.sender = direct_bob
    with pytest.raises(Exception, match="no credit available"):
        registry.withdraw_credit(addr(direct_bob))
    warp(direct_vm, NOW + 3601)
    direct_vm.sender = direct_charlie
    registry.finalize_provisional(case_id)
    case = registry.get_case(case_id)
    assert case["status"] == "CLOSED" and case["final_outcome"] == "OUTCOME_A"
    assert case["winner"].lower() == addr(direct_bob).lower()
    assert registry.get_credit(addr(direct_bob)) == str(BOUNTY + BOND)
    direct_vm.sender = direct_bob
    registry.withdraw_credit(addr(direct_bob))
    stats = registry.get_stats()
    assert stats["withdrawn_atto"] == str(BOUNTY + BOND)
    assert stats["claimable_atto"] == "0"
    assert registry.get_stats()["accounting_balanced"] is True
    with pytest.raises(Exception, match="no finalizable provisional decision"):
        registry.finalize_provisional(case_id)
    with pytest.raises(Exception, match="no credit available"):
        registry.withdraw_credit(addr(direct_bob))


def test_invalid_challenge_penalty_goes_to_final_beneficiary(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    challenge_id = submit_challenge(direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie)
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review("CHALLENGE_REJECTED", source_allowed=False))
    assert registry.get_challenge(challenge_id)["status"] == "CHALLENGE_REJECTED"
    assert registry.get_credit(addr(direct_charlie)) == "0"
    assert registry.get_stats()["accounting_balanced"] is True
    warp(direct_vm, NOW + 3601)
    registry.finalize_provisional(case_id)
    assert registry.get_credit(addr(direct_bob)) == str(BOUNTY + BOND + BOND)
    assert registry.get_stats()["accounting_balanced"] is True


def test_valid_immaterial_challenge_refunds_bond_and_keeps_verdict(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    challenger = direct_charlie
    challenge_id = submit_challenge(direct_vm, registry, case_id, submission_id, challenger, direct_charlie)
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review(
        "VERDICT_UPHELD", contradicts=False, material=False))
    assert registry.get_credit(addr(challenger)) == "0"
    assert registry.get_case(case_id)["provisional_outcome"] == "OUTCOME_A"
    with pytest.raises(Exception, match="no credit available"):
        registry.withdraw_credit(addr(challenger))
    warp(direct_vm, NOW + 3601)
    registry.finalize_provisional(case_id)
    assert registry.get_case(case_id)["winner"].lower() == addr(direct_bob).lower()
    assert registry.get_credit(addr(challenger)) == str(BOND)
    assert registry.get_credit(addr(direct_bob)) == str(BOUNTY + BOND)
    assert registry.get_stats()["accounting_balanced"] is True


def test_material_challenge_overturns_and_pays_challenger_after_finalize(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    challenger = direct_charlie
    challenge_id = submit_challenge(direct_vm, registry, case_id, submission_id, challenger, direct_charlie)
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review("VERDICT_OVERTURNED", "OUTCOME_B"))
    assert registry.get_case(case_id)["status"] == "CHALLENGE_RESOLVED"
    assert registry.get_credit(addr(challenger)) == "0"
    assert registry.get_credit(addr(direct_bob)) == "0"
    assert registry.get_case(case_id)["remaining_bounty_atto"] == str(BOUNTY)
    direct_vm.sender = challenger
    with pytest.raises(Exception, match="no credit available"):
        registry.withdraw_credit(addr(challenger))
    registry.finalize_provisional(case_id)
    case = registry.get_case(case_id)
    assert case["status"] == "CLOSED" and case["final_outcome"] == "OUTCOME_B"
    assert case["winner"].lower() == addr(challenger).lower()
    assert registry.get_credit(addr(challenger)) == str(BOUNTY + BOND)
    assert registry.get_credit(addr(direct_bob)) == str(BOND)
    assert registry.get_stats()["accounting_balanced"] is True


def test_insufficient_overturn_reopens_without_releasing_bounty(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    challenge_id = submit_challenge(direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie)
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review("VERDICT_OVERTURNED", "INSUFFICIENT_EVIDENCE"))
    case = registry.get_case(case_id)
    assert case["status"] == "REOPENED"
    assert case["remaining_bounty_atto"] == str(BOUNTY)
    assert registry.get_credit(addr(direct_bob)) == str(BOND)
    assert registry.get_credit(addr(direct_charlie)) == str(BOND)
    registry.reopen_case(case_id)
    assert registry.get_case(case_id)["status"] == "OPEN"
    assert registry.get_case(case_id)["can_submit"] is True
    assert registry.get_stats()["accounting_balanced"] is True


def test_reopen_extends_expired_case_and_preserves_bounty(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    original_expiry = NOW + 3000
    case_id = open_case(direct_vm, registry, direct_alice, closes_at=original_expiry)
    warp(direct_vm, NOW + 1700)
    case_id, submission_id = create_provisional(
        direct_vm, registry, direct_alice, direct_bob, direct_charlie, case_id=case_id,
    )
    challenge_id = submit_challenge(direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie)
    warp(direct_vm, NOW + 3100)
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review("VERDICT_OVERTURNED", "INSUFFICIENT_EVIDENCE"))
    case = registry.get_case(case_id)
    assert case["status"] == "REOPENED"
    assert int(case["closes_at"]) > original_expiry
    assert case["remaining_bounty_atto"] == str(BOUNTY)
    registry.reopen_case(case_id)
    assert registry.get_case(case_id)["status"] == "OPEN"
    assert registry.get_credit(addr(direct_bob)) == str(BOND)
    assert registry.get_credit(addr(direct_charlie)) == str(BOND)
    assert registry.get_stats()["accounting_balanced"] is True


def test_challenge_timeout_refunds_and_bounded_recovery_finalizes(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    challenge_id = submit_challenge(direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie)
    warp(direct_vm, NOW + 7201)
    with pytest.raises(Exception, match="case is not expirable in its current state"):
        registry.expire_case(case_id)
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review("VERDICT_OVERTURNED", "OUTCOME_B"))
    assert registry.get_challenge(challenge_id)["status"] == "REVIEW_PENDING"
    registry.expire_challenge(challenge_id)
    assert registry.get_challenge(challenge_id)["status"] == "REVIEW_TIMEOUT"
    assert registry.get_credit(addr(direct_charlie)) == "0"
    case = registry.get_case(case_id)
    with pytest.raises(Exception, match="recovery deadline has not passed"):
        registry.finalize_provisional(case_id)
    with pytest.raises(Exception, match="no credit available"):
        registry.withdraw_credit(addr(direct_charlie))
    warp(direct_vm, NOW + 7201 + 1801)
    registry.finalize_provisional(case_id)
    assert registry.get_case(case_id)["status"] == "CLOSED"
    assert registry.get_credit(addr(direct_charlie)) == str(BOND)
    assert registry.get_stats()["accounting_balanced"] is True


def test_unavailable_challenge_source_refund_waits_for_recovery_finality(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    challenge_id = submit_challenge(direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie)
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review("SOURCE_UNAVAILABLE"))
    assert registry.get_case(case_id)["challenge_status"] == "REVIEW_TIMEOUT_RECOVERY"
    assert registry.get_credit(addr(direct_charlie)) == "0"
    warp(direct_vm, NOW + 1801)
    registry.finalize_provisional(case_id)
    assert registry.get_credit(addr(direct_charlie)) == str(BOND)
    assert registry.get_stats()["accounting_balanced"] is True


def test_challenges_reject_wrong_wallet_target_bond_duplicate_and_late_review(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    digest = "aa" * 32
    direct_vm.sender, direct_vm.value = direct_alice, BOND
    with pytest.raises(Exception, match="cannot challenge"):
        registry.commit_challenge(case_id, submission_id, submission_id, digest)
    direct_vm.sender, direct_vm.value = direct_charlie, BOND - 1
    with pytest.raises(Exception, match="exact challenge bond"):
        registry.commit_challenge(case_id, submission_id, submission_id, digest)
    direct_vm.sender, direct_vm.value = direct_charlie, BOND
    with pytest.raises(Exception, match="different provisional decision"):
        registry.commit_challenge(case_id, "cs-999", submission_id, digest)
    with pytest.raises(Exception, match="evidence is not part"):
        registry.commit_challenge(case_id, submission_id, "cs-999", digest)
    direct_vm.value = 0
    challenge_id = submit_challenge(direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie)
    with pytest.raises(Exception, match="another challenge is under review"):
        registry.commit_challenge(case_id, submission_id, submission_id, "bb" * 32)
    warp(direct_vm, NOW + 1801)
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review("VERDICT_OVERTURNED", "OUTCOME_B"))
    assert registry.get_challenge(challenge_id)["status"] == "REVIEW_PENDING"
    registry.expire_challenge(challenge_id)
    before = registry.get_case(case_id)
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review("VERDICT_OVERTURNED", "OUTCOME_B"))
    after = registry.get_case(case_id)
    assert after["status"] == before["status"]
    assert after["pending_final_outcome"] == ""
    assert registry.get_stats()["accounting_balanced"] is True


def test_forged_duplicate_and_out_of_order_callbacks_cannot_change_challenge(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    challenge_id = submit_challenge(direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie)
    direct_vm.sender = direct_bob
    with pytest.raises(Exception, match="only the configured challenge adjudicator"):
        registry.record_challenge_review(challenge_id, review("VERDICT_OVERTURNED", "OUTCOME_B"))
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review("VERDICT_UPHELD", contradicts=False, material=False))
    case_after_first = registry.get_case(case_id)
    registry.record_challenge_review(challenge_id, review("VERDICT_OVERTURNED", "OUTCOME_B"))
    case_after_replay = registry.get_case(case_id)
    assert case_after_replay["status"] == case_after_first["status"] == "PROVISIONAL_CLOSURE"
    assert case_after_replay["provisional_outcome"] == "OUTCOME_A"
    assert case_after_replay["pending_final_outcome"] == ""
    assert registry.get_credit(addr(direct_charlie)) == "0"
    assert registry.get_stats()["accounting_balanced"] is True


def test_cross_case_challenge_identifiers_are_rejected(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_one, decision_one = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    case_two, decision_two = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    direct_vm.sender, direct_vm.value = direct_charlie, BOND
    with pytest.raises(Exception, match="different provisional decision"):
        registry.commit_challenge(case_one, decision_two, decision_two, "44" * 32)
    with pytest.raises(Exception, match="evidence is not part"):
        registry.commit_challenge(case_one, decision_one, decision_two, "55" * 32)
    direct_vm.value = 0
    assert registry.get_case(case_one)["pending_challenge"] == ""
    assert registry.get_case(case_two)["pending_challenge"] == ""
    assert registry.get_stats()["accounting_balanced"] is True


def test_challenge_cannot_be_submitted_at_window_boundary_or_after_finalization(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    direct_vm.sender, direct_vm.value = direct_charlie, BOND
    warp(direct_vm, NOW + 2400)
    with pytest.raises(Exception, match="challenge window has closed"):
        registry.commit_challenge(case_id, submission_id, submission_id, "66" * 32)
    direct_vm.value = 0
    warp(direct_vm, NOW + 3600)
    registry.finalize_provisional(case_id)
    with pytest.raises(Exception, match="case is not accepting challenges"):
        registry.commit_challenge(case_id, submission_id, submission_id, "77" * 32)
    direct_vm.value = 0
    assert registry.get_case(case_id)["status"] == "CLOSED"
    assert registry.get_stats()["accounting_balanced"] is True


def test_late_verifier_callback_cannot_resolve_expired_stage(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id = open_case(direct_vm, registry, direct_alice)
    submission_id = submit_evidence(direct_vm, registry, case_id, direct_bob,
                                    "https://example.com/fact", "A precise new fact about package X.")
    warp(direct_vm, NOW + 1801)
    direct_vm.sender = direct_charlie
    registry.record_verification(submission_id, json.dumps({
        "status": "VERIFIED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "Late but otherwise positive callback."
    }))
    assert registry.get_submission(submission_id)["status"] == "VERIFICATION_PENDING"
    registry.expire_submission(submission_id)
    assert registry.get_submission(submission_id)["status"] == "INCONCLUSIVE"
    assert registry.get_credit(addr(direct_bob)) == str(BOND)
    assert registry.get_stats()["accounting_balanced"] is True


def test_late_judge_callback_cannot_close_expired_stage(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id = open_case(direct_vm, registry, direct_alice)
    submission_id = submit_evidence(direct_vm, registry, case_id, direct_bob,
                                    "https://example.com/fact", "A precise new fact about package X.")
    direct_vm.sender = direct_charlie
    registry.record_verification(submission_id, json.dumps({
        "status": "VERIFIED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "Verified before its deadline."
    }))
    assert registry.get_submission(submission_id)["status"] == "CLOSURE_PENDING"
    warp(direct_vm, NOW + 1801)
    registry.record_closure(submission_id, json.dumps({
        "outcome": "OUTCOME_A", "sufficient": True,
        "decisive_evidence_ids": [submission_id], "basis": "Late closure callback."
    }))
    assert registry.get_submission(submission_id)["status"] == "CLOSURE_PENDING"
    registry.expire_submission(submission_id)
    assert registry.get_submission(submission_id)["status"] == "INCONCLUSIVE"
    assert registry.get_credit(addr(direct_bob)) == str(BOND)
    assert registry.get_case(case_id)["status"] == "OPEN"
    assert registry.get_stats()["accounting_balanced"] is True


def test_decisive_closure_must_include_the_candidate_evidence(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id = open_case(direct_vm, registry, direct_alice)
    submission_id = submit_evidence(
        direct_vm, registry, case_id, direct_bob,
        "https://example.com/licence", "The upstream licence permits commercial redistribution.",
    )
    direct_vm.sender = direct_charlie
    registry.record_verification(submission_id, json.dumps({
        "status": "VERIFIED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "The upstream licence supports permission.",
    }))

    with pytest.raises(Exception, match="a decisive closure must include its candidate evidence"):
        registry.record_closure(submission_id, json.dumps({
            "outcome": "OUTCOME_A", "sufficient": True,
            "decisive_evidence_ids": ["b-1"], "basis": "The case is decidable.",
        }))

    assert registry.get_submission(submission_id)["status"] == "CLOSURE_PENDING"
    assert registry.get_case(case_id)["status"] == "OPEN"
    assert registry.get_credit(addr(direct_bob)) == "0"
    assert registry.get_stats()["accounting_balanced"] is True
