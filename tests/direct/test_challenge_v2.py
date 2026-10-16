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


def submit_challenge(vm, registry, case_id, decision_id, challenger, callback_wallet,
                     challenged_evidence_id=None, salt="22" * 32, expected_status="REVIEW_PENDING"):
    challenged_evidence_id = challenged_evidence_id or decision_id
    source_url = "https://example.com/counterevidence"
    counterclaim = "The same version's official licence prohibits commercial redistribution."
    digest = challenge_commitment(vm, case_id, decision_id, challenged_evidence_id, challenger,
                                  source_url, counterclaim, salt)
    vm.sender, vm.value = challenger, BOND
    challenge_id = registry.commit_challenge(case_id, decision_id, challenged_evidence_id, digest)
    vm.value = 0
    registry.reveal_challenge(challenge_id, source_url, counterclaim, salt)
    assert registry.get_challenge(challenge_id)["status"] == expected_status
    return challenge_id


def commit_unrevealed(vm, registry, case_id, decision_id, challenger, commitment="aa" * 32):
    vm.sender, vm.value = challenger, BOND
    challenge_id = registry.commit_challenge(case_id, decision_id, decision_id, commitment)
    vm.value = 0
    return challenge_id


def start_review_with_queue(vm, registry, case_id, submission_id, challenger):
    active_id = submit_challenge(
        vm, registry, case_id, submission_id, challenger, challenger, salt="23" * 32,
    )
    queued_id = submit_challenge(
        vm, registry, case_id, submission_id, challenger, challenger,
        salt="24" * 32, expected_status="REVEALED_QUEUED",
    )
    return active_id, queued_id


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
        "material": True, "new_outcome": new_outcome, "basis": "Independent challenge review result.",
        "challenged_evidence_id": "cs-1",
    }
    result.update(overrides)
    return json.dumps(result)


def create_composed_provisional(vm, registry, sponsor, contributor, callback_wallet):
    case_id = open_case(vm, registry, sponsor)
    first_id = submit_evidence(
        vm, registry, case_id, contributor,
        "https://example.com/first-decisive-fact", "A first fact required by the decision rule.",
    )
    vm.sender = callback_wallet
    registry.record_verification(first_id, json.dumps({
        "status": "VERIFIED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "The first fact is independently supported.",
    }))
    registry.record_closure(first_id, json.dumps({
        "outcome": "INSUFFICIENT_EVIDENCE", "sufficient": False,
        "decisive_evidence_ids": [], "basis": "A second decisive fact is still missing.",
    }))

    second_id = submit_evidence(
        vm, registry, case_id, contributor,
        "https://example.com/second-decisive-fact", "A second fact that completes the decision rule.",
    )
    vm.sender = callback_wallet
    registry.record_verification(second_id, json.dumps({
        "status": "VERIFIED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "The second fact is independently supported.",
    }))
    registry.record_closure(second_id, json.dumps({
        "outcome": "OUTCOME_A", "sufficient": True,
        "decisive_evidence_ids": [first_id, second_id],
        "basis": "Both facts are decisive under the original rule.",
    }))
    assert registry.get_case(case_id)["status"] == "PROVISIONAL_CLOSURE"
    return case_id, first_id, second_id


def test_provisional_bounty_locked_and_permissionless_finalize(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    assert registry.get_credit(addr(direct_bob)) == "0"
    assert registry.get_submission(submission_id)["status"] == "PROVISIONAL_WINNER"
    with pytest.raises(Exception, match="challenge (window has not closed|recovery deadline has not passed)"):
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


def test_withdrawal_is_recipient_bound_and_one_shot(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, _submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    warp(direct_vm, NOW + 3601)
    registry.finalize_provisional(case_id)
    direct_vm.sender = direct_charlie
    with pytest.raises(Exception, match="only the credited recipient"):
        registry.withdraw_credit(addr(direct_bob))
    direct_vm.sender = direct_bob
    registry.withdraw_credit(addr(direct_bob))
    assert registry.get_credit(addr(direct_bob)) == "0"
    assert registry.get_stats()["withdrawn_atto"] == str(BOUNTY + BOND)
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


def test_forfeited_penalty_survives_insufficient_overturn_and_new_round(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    """A prior round's forfeited bond remains payable after reopening."""
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    invalid_challenger = direct_charlie
    successful_challenger = "0x" + ("44" * 20)

    invalid_id = submit_challenge(
        direct_vm, registry, case_id, submission_id, invalid_challenger, direct_charlie,
        salt="44" * 32,
    )
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(invalid_id, review("CHALLENGE_REJECTED", source_allowed=False))
    first_round = registry.get_case(case_id)
    assert first_round["pending_invalid_challenge_penalty_atto"] == str(BOND)
    assert registry.get_stats()["bond_escrow_atto"] == str(2 * BOND)

    overturn_id = submit_challenge(
        direct_vm, registry, case_id, submission_id, successful_challenger, direct_charlie,
        salt="55" * 32,
    )
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(overturn_id, review(
        "VERDICT_OVERTURNED", "INSUFFICIENT_EVIDENCE",
        challenged_evidence_id=submission_id,
    ))
    reopened = registry.get_case(case_id)
    assert reopened["status"] == "REOPENED"
    assert reopened["pending_invalid_challenge_penalty_atto"] == str(BOND)
    assert registry.get_credit(addr(successful_challenger)) == str(BOND)
    assert registry.get_credit(addr(direct_bob)) == str(BOND)

    registry.reopen_case(case_id)
    replacement_id = submit_evidence(
        direct_vm, registry, case_id, direct_bob,
        "https://example.com/replacement-round-penalty",
        "A fresh fact after the prior invalid challenge and reopening.",
        salt="66" * 32,
    )
    direct_vm.sender = direct_charlie
    registry.record_verification(replacement_id, json.dumps({
        "status": "VERIFIED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "The replacement fact is independently supported.",
    }))
    registry.record_closure(replacement_id, json.dumps({
        "outcome": "OUTCOME_A", "sufficient": True,
        "decisive_evidence_ids": [replacement_id],
        "basis": "The replacement fact closes the reopened case.",
    }))
    second_round = registry.get_case(case_id)
    assert second_round["pending_invalid_challenge_penalty_atto"] == str(BOND)

    warp(direct_vm, NOW + 3601)
    registry.finalize_provisional(case_id)
    final_case = registry.get_case(case_id)
    assert final_case["status"] == "CLOSED"
    assert final_case["winner"].lower() == addr(direct_bob).lower()
    assert registry.get_credit(addr(direct_bob)) == str(BOUNTY + 3 * BOND)
    assert registry.get_credit(addr(successful_challenger)) == str(BOND)
    assert registry.get_stats()["bond_escrow_atto"] == "0"
    assert registry.get_stats()["accounting_balanced"] is True


def test_forfeited_penalty_is_refunded_to_sponsor_when_reopened_case_expires(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    invalid_id = submit_challenge(
        direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie,
        salt="77" * 32,
    )
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(invalid_id, review("CHALLENGE_REJECTED", source_allowed=False))

    successful_challenger = "0x" + ("66" * 20)
    overturn_id = submit_challenge(
        direct_vm, registry, case_id, submission_id, successful_challenger, direct_charlie,
        salt="88" * 32,
    )
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(overturn_id, review(
        "VERDICT_OVERTURNED", "INSUFFICIENT_EVIDENCE", challenged_evidence_id=submission_id,
    ))
    registry.reopen_case(case_id)
    warp(direct_vm, NOW + 7201)
    registry.expire_case(case_id)

    case = registry.get_case(case_id)
    assert case["status"] == "EXPIRED"
    assert registry.get_credit(addr(direct_alice)) == str(BOUNTY + BOND)
    assert registry.get_credit(addr(direct_bob)) == str(BOND)
    assert registry.get_credit(addr(successful_challenger)) == str(BOND)
    assert registry.get_stats()["bond_escrow_atto"] == "0"
    assert registry.get_stats()["accounting_balanced"] is True


def test_multiple_reopenings_carry_all_prior_forfeitures_to_terminal_beneficiary(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, first_submission = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    challenger_one = "0x" + ("77" * 20)
    challenger_two = "0x" + ("88" * 20)

    invalid_one = submit_challenge(
        direct_vm, registry, case_id, first_submission, direct_charlie, direct_charlie,
        salt="91" * 32,
    )
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(invalid_one, review("CHALLENGE_REJECTED", source_allowed=False))
    overturn_one = submit_challenge(
        direct_vm, registry, case_id, first_submission, challenger_one, direct_charlie,
        salt="92" * 32,
    )
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(overturn_one, review(
        "VERDICT_OVERTURNED", "INSUFFICIENT_EVIDENCE", challenged_evidence_id=first_submission,
    ))
    registry.reopen_case(case_id)

    second_submission = submit_evidence(
        direct_vm, registry, case_id, direct_bob,
        "https://example.com/second-round", "A second-round fact after the first reopening.",
        salt="93" * 32,
    )
    direct_vm.sender = direct_charlie
    registry.record_verification(second_submission, json.dumps({
        "status": "VERIFIED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "The second-round fact is supported.",
    }))
    registry.record_closure(second_submission, json.dumps({
        "outcome": "OUTCOME_A", "sufficient": True,
        "decisive_evidence_ids": [second_submission], "basis": "The second-round fact is decisive.",
    }))
    invalid_two = submit_challenge(
        direct_vm, registry, case_id, second_submission, direct_charlie, direct_charlie,
        salt="94" * 32,
    )
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(invalid_two, review(
        "CHALLENGE_REJECTED", source_allowed=False, challenged_evidence_id=second_submission,
    ))
    overturn_two = submit_challenge(
        direct_vm, registry, case_id, second_submission, challenger_two, direct_charlie,
        salt="95" * 32,
    )
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(overturn_two, review(
        "VERDICT_OVERTURNED", "INSUFFICIENT_EVIDENCE", challenged_evidence_id=second_submission,
    ))
    registry.reopen_case(case_id)

    final_submission = submit_evidence(
        direct_vm, registry, case_id, direct_bob,
        "https://example.com/final-round", "A final fact after two prior reopenings.",
        salt="96" * 32,
    )
    direct_vm.sender = direct_charlie
    registry.record_verification(final_submission, json.dumps({
        "status": "VERIFIED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "The final-round fact is supported.",
    }))
    registry.record_closure(final_submission, json.dumps({
        "outcome": "OUTCOME_A", "sufficient": True,
        "decisive_evidence_ids": [final_submission], "basis": "The final-round fact is decisive.",
    }))
    assert registry.get_case(case_id)["pending_invalid_challenge_penalty_atto"] == str(2 * BOND)
    warp(direct_vm, NOW + 3601)
    registry.finalize_provisional(case_id)

    assert registry.get_case(case_id)["status"] == "CLOSED"
    assert registry.get_credit(addr(direct_bob)) == str(BOUNTY + 5 * BOND)
    assert registry.get_credit(addr(challenger_one)) == str(BOND)
    assert registry.get_credit(addr(challenger_two)) == str(BOND)
    assert registry.get_stats()["bond_escrow_atto"] == "0"
    assert registry.get_stats()["accounting_balanced"] is True


def test_eight_rejected_challenges_exhaust_the_bounded_round_budget(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    """The bounded permissionless cap is observable and can deny a late challenger."""
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)

    for index in range(8):
        challenge_id = submit_challenge(
            direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie,
            salt=f"{80 + index:02x}" * 32,
        )
        direct_vm.sender = direct_charlie
        registry.record_challenge_review(challenge_id, review("CHALLENGE_REJECTED", source_allowed=False))

    case = registry.get_case(case_id)
    assert case["challenge_count"] == 8
    assert case["pending_invalid_challenge_penalty_atto"] == str(8 * BOND)
    assert registry.get_stats()["bond_escrow_atto"] == str(9 * BOND)

    honest_challenger = "0x" + ("55" * 20)
    direct_vm.sender, direct_vm.value = honest_challenger, BOND
    with pytest.raises(Exception, match="challenge limit reached"):
        registry.commit_challenge(case_id, submission_id, submission_id, "99" * 32)
    direct_vm.value = 0
    assert registry.get_case(case_id)["challenge_count"] == 8
    assert registry.get_stats()["accounting_balanced"] is True
    warp(direct_vm, NOW + 3601)
    registry.finalize_provisional(case_id)
    assert registry.get_credit(addr(direct_bob)) == str(BOUNTY + BOND + 8 * BOND)
    assert registry.get_stats()["bond_escrow_atto"] == "0"


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
    assert submission_id in [item["id"] for item in registry.get_case(case_id)["accepted_evidence"]]
    challenge_id = submit_challenge(direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie)
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review("VERDICT_OVERTURNED", "INSUFFICIENT_EVIDENCE"))
    case = registry.get_case(case_id)
    assert case["status"] == "REOPENED"
    assert submission_id not in [item["id"] for item in case["accepted_evidence"]]
    assert case["remaining_bounty_atto"] == str(BOUNTY)
    assert registry.get_credit(addr(direct_bob)) == str(BOND)
    assert registry.get_credit(addr(direct_charlie)) == str(BOND)
    registry.reopen_case(case_id)
    case = registry.get_case(case_id)
    assert case["status"] == "OPEN"
    assert case["can_submit"] is True
    assert case["closing_submission"] == ""
    assert submission_id not in [item["id"] for item in case["accepted_evidence"]]

    next_submission = submit_evidence(
        direct_vm, registry, case_id, direct_bob,
        "https://example.com/replacement", "A newly sourced fact after the case reopened.",
    )
    direct_vm.sender = direct_charlie
    registry.record_verification(next_submission, json.dumps({
        "status": "VERIFIED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "The replacement fact is independently verified.",
    }))
    with pytest.raises(Exception, match="decisive evidence id is not in the accepted graph"):
        registry.record_closure(next_submission, json.dumps({
            "outcome": "OUTCOME_A", "sufficient": True,
            "decisive_evidence_ids": [submission_id, next_submission],
            "basis": "An overturned fact must not be reused after reopening.",
        }))
    assert registry.get_stats()["accounting_balanced"] is True


def test_insufficient_overturn_removes_the_exact_prior_decisive_fact_and_keeps_other_evidence(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, challenged_id, closing_id = create_composed_provisional(
        direct_vm, registry, direct_alice, direct_bob, direct_charlie,
    )
    challenge_id = submit_challenge(
        direct_vm, registry, case_id, closing_id, direct_charlie, direct_charlie,
        challenged_evidence_id=challenged_id,
    )
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review(
        "VERDICT_OVERTURNED", "INSUFFICIENT_EVIDENCE", challenged_evidence_id=challenged_id,
    ))

    case = registry.get_case(case_id)
    active_ids = [item["id"] for item in case["accepted_evidence"]]
    assert case["status"] == "REOPENED"
    assert challenged_id not in active_ids
    assert closing_id in active_ids
    assert case["closing_submission"] == ""
    assert registry.get_submission(challenged_id)["status"] == "OVERTURNED"
    assert registry.get_submission(closing_id)["status"] == "VERIFIED_NON_CLOSING"
    assert registry.get_challenge(challenge_id)["challenged_evidence_id"] == challenged_id
    assert challenged_id in [item["id"] for item in registry.list_submissions(case_id)]
    assert registry.get_stats()["accounting_balanced"] is True

    registry.reopen_case(case_id)
    next_id = submit_evidence(
        direct_vm, registry, case_id, direct_bob,
        "https://example.com/replacement", "A fresh fact after the challenge invalidated the earlier one.",
    )
    direct_vm.sender = direct_charlie
    registry.record_verification(next_id, json.dumps({
        "status": "VERIFIED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "The replacement fact is independently verified.",
    }))
    with pytest.raises(Exception, match="decisive evidence id is not in the accepted graph"):
        registry.record_closure(next_id, json.dumps({
            "outcome": "OUTCOME_A", "sufficient": True,
            "decisive_evidence_ids": [challenged_id, next_id],
            "basis": "An overturned fact must not be reused.",
        }))
    registry.record_closure(next_id, json.dumps({
        "outcome": "OUTCOME_A", "sufficient": True,
        "decisive_evidence_ids": [closing_id, next_id],
        "basis": "The remaining valid fact and new evidence satisfy the rule.",
    }))
    assert registry.get_case(case_id)["status"] == "PROVISIONAL_CLOSURE"
    assert registry.get_stats()["accounting_balanced"] is True


def test_opposite_outcome_overturn_also_removes_the_specific_challenged_fact(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, challenged_id, closing_id = create_composed_provisional(
        direct_vm, registry, direct_alice, direct_bob, direct_charlie,
    )
    challenge_id = submit_challenge(
        direct_vm, registry, case_id, closing_id, direct_charlie, direct_charlie,
        challenged_evidence_id=challenged_id,
    )
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review(
        "VERDICT_OVERTURNED", "OUTCOME_B", challenged_evidence_id=challenged_id,
    ))

    case = registry.get_case(case_id)
    active_ids = [item["id"] for item in case["accepted_evidence"]]
    assert case["status"] == "CHALLENGE_RESOLVED"
    assert challenged_id not in active_ids
    assert closing_id in active_ids
    assert registry.get_submission(challenged_id)["status"] == "OVERTURNED"
    registry.finalize_provisional(case_id)
    case = registry.get_case(case_id)
    assert case["status"] == "CLOSED" and case["final_outcome"] == "OUTCOME_B"
    assert registry.get_stats()["accounting_balanced"] is True


def test_challenge_callback_must_match_the_committed_evidence_target(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    challenge_id = submit_challenge(direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie)
    direct_vm.sender = direct_charlie
    with pytest.raises(Exception, match="challenge review targets different evidence"):
        registry.record_challenge_review(challenge_id, review(
            "VERDICT_UPHELD", contradicts=False, material=False,
            challenged_evidence_id="cs-forged",
        ))
    assert registry.get_challenge(challenge_id)["status"] == "REVIEW_PENDING"
    assert registry.get_case(case_id)["pending_challenge"] == challenge_id
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
    with pytest.raises(Exception, match="challenge (window has not closed|recovery deadline has not passed)"):
        registry.finalize_provisional(case_id)
    warp(direct_vm, NOW + 3601)
    registry.finalize_provisional(case_id)
    assert registry.get_credit(addr(direct_charlie)) == str(BOND)
    assert registry.get_stats()["accounting_balanced"] is True


def test_recovery_deadline_survives_later_queued_review_result(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    warp(direct_vm, NOW + 2000)
    first_id = submit_challenge(direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie)
    second_id = submit_challenge(direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie,
                                  challenged_evidence_id=submission_id, salt="23" * 32,
                                  expected_status="REVEALED_QUEUED")
    assert registry.get_challenge(second_id)["status"] == "REVEALED_QUEUED"

    direct_vm.sender = direct_charlie
    registry.record_challenge_review(first_id, review("SOURCE_UNAVAILABLE"))
    assert registry.get_challenge(second_id)["status"] == "REVIEW_PENDING"
    registry.record_challenge_review(second_id, review("CHALLENGE_REJECTED", contradicts=False, material=False))
    recovery_deadline = int(registry.get_case(case_id)["challenge_recovery_deadline"])
    assert recovery_deadline > NOW + 3600

    warp(direct_vm, NOW + 3601)
    with pytest.raises(Exception, match="challenge recovery deadline has not passed"):
        registry.finalize_provisional(case_id)
    warp(direct_vm, recovery_deadline + 1)
    registry.finalize_provisional(case_id)
    assert registry.get_case(case_id)["status"] == "CLOSED"
    assert registry.get_stats()["accounting_balanced"] is True


def test_expiring_unrevealed_challenge_preserves_another_active_review(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)

    direct_vm.sender, direct_vm.value = direct_charlie, BOND
    abandoned_id = registry.commit_challenge(case_id, submission_id, submission_id, "aa" * 32)
    direct_vm.value = 0

    # Admit and reveal B just before A's reveal deadline. B's review is still
    # live when an unrelated wallet expires A.
    warp(direct_vm, NOW + 1190)
    active_id = submit_challenge(
        direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie,
        salt="23" * 32,
    )
    assert registry.get_challenge(active_id)["status"] == "REVIEW_PENDING"
    assert registry.get_case(case_id)["pending_challenge"] == active_id

    warp(direct_vm, NOW + 1201)
    direct_vm.sender = direct_bob
    registry.expire_challenge(abandoned_id)

    case = registry.get_case(case_id)
    assert registry.get_challenge(abandoned_id)["status"] == "UNREVEALED"
    assert registry.get_challenge(active_id)["status"] == "REVIEW_PENDING"
    assert case["status"] == "CHALLENGE_REVIEW"
    assert case["challenge_status"] == "REVIEW_PENDING"
    assert case["pending_challenge"] == active_id
    assert active_id in case["pending_challenge_ids"]

    direct_vm.sender = direct_charlie
    registry.record_challenge_review(active_id, review("VERDICT_UPHELD", contradicts=False, material=False))
    assert registry.get_challenge(active_id)["status"] == "VERDICT_UPHELD"
    assert registry.get_case(case_id)["status"] == "PROVISIONAL_CLOSURE"

    warp(direct_vm, NOW + 3601)
    registry.finalize_provisional(case_id)
    final_case = registry.get_case(case_id)
    assert final_case["status"] == "CLOSED"
    assert final_case["winner"].lower() == addr(direct_bob).lower()
    assert final_case["remaining_bounty_atto"] == "0"
    assert registry.get_credit(addr(direct_charlie)) == str(BOND)
    assert registry.get_stats()["accounting_balanced"] is True


def test_expiring_unrevealed_challenge_preserves_a_queued_review(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    abandoned_id = commit_unrevealed(direct_vm, registry, case_id, submission_id, direct_charlie)

    warp(direct_vm, NOW + 700)
    active_id, queued_id = start_review_with_queue(direct_vm, registry, case_id, submission_id, direct_charlie)
    warp(direct_vm, NOW + 1201)
    direct_vm.sender = direct_bob
    registry.expire_challenge(abandoned_id)

    case = registry.get_case(case_id)
    assert case["pending_challenge"] == active_id
    assert queued_id in case["challenge_review_queue"]
    assert registry.get_challenge(queued_id)["status"] == "REVEALED_QUEUED"
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(active_id, review("VERDICT_UPHELD", contradicts=False, material=False))
    assert registry.get_challenge(queued_id)["status"] == "REVIEW_PENDING"
    assert registry.get_case(case_id)["pending_challenge"] == queued_id
    assert registry.get_stats()["accounting_balanced"] is True


def test_review_timeout_promotes_queued_review_and_preserves_recovery(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    active_id, queued_id = start_review_with_queue(direct_vm, registry, case_id, submission_id, direct_charlie)

    warp(direct_vm, NOW + 1801)
    direct_vm.sender = direct_bob
    registry.expire_challenge(active_id)
    case = registry.get_case(case_id)
    assert registry.get_challenge(active_id)["status"] == "REVIEW_TIMEOUT"
    assert registry.get_challenge(queued_id)["status"] == "REVIEW_PENDING"
    assert case["pending_challenge"] == queued_id
    recovery_deadline = int(case["challenge_recovery_deadline"])
    assert recovery_deadline >= NOW + 3600

    direct_vm.sender = direct_charlie
    registry.record_challenge_review(queued_id, review("VERDICT_UPHELD", contradicts=False, material=False))
    with pytest.raises(Exception, match="challenge recovery deadline has not passed"):
        registry.finalize_provisional(case_id)
    warp(direct_vm, recovery_deadline + 1)
    registry.finalize_provisional(case_id)
    assert registry.get_case(case_id)["status"] == "CLOSED"
    assert registry.get_stats()["accounting_balanced"] is True


def test_source_unavailable_callback_preserves_unresolved_commitment(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    abandoned_id = commit_unrevealed(direct_vm, registry, case_id, submission_id, direct_charlie)
    warp(direct_vm, NOW + 700)
    active_id = submit_challenge(direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie)
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(active_id, review("SOURCE_UNAVAILABLE"))

    case = registry.get_case(case_id)
    assert case["status"] == "PROVISIONAL_CLOSURE"
    assert case["challenge_status"] == "REVIEW_TIMEOUT_RECOVERY"
    assert case["pending_challenge"] == ""
    assert case["pending_challenge_ids"] == [abandoned_id]
    warp(direct_vm, NOW + 1201)
    direct_vm.sender = direct_bob
    registry.expire_challenge(abandoned_id)
    warp(direct_vm, NOW + 3601)
    registry.finalize_provisional(case_id)
    assert registry.get_case(case_id)["status"] == "CLOSED"
    assert registry.get_stats()["accounting_balanced"] is True


def test_rejected_active_review_promotes_valid_queued_review(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    active_id, queued_id = start_review_with_queue(direct_vm, registry, case_id, submission_id, direct_charlie)

    direct_vm.sender = direct_charlie
    registry.record_challenge_review(active_id, review("CHALLENGE_REJECTED"))
    assert registry.get_challenge(queued_id)["status"] == "REVIEW_PENDING"
    assert registry.get_case(case_id)["pending_challenge"] == queued_id
    registry.record_challenge_review(queued_id, review("VERDICT_UPHELD", contradicts=False, material=False))
    warp(direct_vm, NOW + 3601)
    registry.finalize_provisional(case_id)
    assert registry.get_case(case_id)["status"] == "CLOSED"
    assert registry.get_stats()["accounting_balanced"] is True


def test_upheld_active_review_promotes_pending_review_and_preserves_original_beneficiary(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    active_id, queued_id = start_review_with_queue(direct_vm, registry, case_id, submission_id, direct_charlie)

    direct_vm.sender = direct_charlie
    registry.record_challenge_review(active_id, review("VERDICT_UPHELD", contradicts=False, material=False))
    assert registry.get_challenge(queued_id)["status"] == "REVIEW_PENDING"
    assert registry.get_case(case_id)["pending_challenge"] == queued_id
    assert registry.get_credit(addr(direct_charlie)) == "0"

    registry.record_challenge_review(queued_id, review("VERDICT_UPHELD", contradicts=False, material=False))
    warp(direct_vm, NOW + 3601)
    registry.finalize_provisional(case_id)
    case = registry.get_case(case_id)
    assert case["status"] == "CLOSED"
    assert case["winner"].lower() == addr(direct_bob).lower()
    assert registry.get_credit(addr(direct_bob)) == str(BOUNTY + BOND)
    assert registry.get_credit(addr(direct_charlie)) == str(2 * BOND)
    assert registry.get_stats()["accounting_balanced"] is True


def test_successful_overturn_blocks_other_queued_reviews_safely(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    active_id, queued_id = start_review_with_queue(direct_vm, registry, case_id, submission_id, direct_charlie)

    direct_vm.sender = direct_charlie
    registry.record_challenge_review(active_id, review("VERDICT_OVERTURNED", "OUTCOME_B"))
    case = registry.get_case(case_id)
    assert case["status"] == "CHALLENGE_RESOLVED"
    assert case["pending_challenge"] == ""
    assert case["pending_challenge_ids"] == []
    assert registry.get_challenge(queued_id)["status"] == "PROTOCOL_BLOCKED"
    registry.finalize_provisional(case_id)
    assert registry.get_case(case_id)["winner"].lower() == addr(direct_charlie).lower()
    assert registry.get_stats()["accounting_balanced"] is True


def test_multiple_same_time_expirations_settle_each_bond_once(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    first_id = commit_unrevealed(direct_vm, registry, case_id, submission_id, direct_charlie, "aa" * 32)
    second_id = commit_unrevealed(direct_vm, registry, case_id, submission_id, direct_charlie, "bb" * 32)
    warp(direct_vm, NOW + 1201)
    direct_vm.sender = direct_bob
    registry.expire_challenge(first_id)
    registry.expire_challenge(second_id)
    case = registry.get_case(case_id)
    assert case["pending_challenge_ids"] == []
    assert case["pending_invalid_challenge_penalty_atto"] == str(2 * BOND)
    assert registry.get_challenge(first_id)["status"] == "UNREVEALED"
    assert registry.get_challenge(second_id)["status"] == "UNREVEALED"
    warp(direct_vm, NOW + 3601)
    registry.finalize_provisional(case_id)
    assert registry.get_case(case_id)["status"] == "CLOSED"
    assert registry.get_stats()["accounting_balanced"] is True


def test_automatic_cleanup_inside_new_commitment_preserves_new_work(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    abandoned_id = commit_unrevealed(direct_vm, registry, case_id, submission_id, direct_charlie, "aa" * 32)
    warp(direct_vm, NOW + 1201)
    replacement_id = commit_unrevealed(direct_vm, registry, case_id, submission_id, direct_charlie, "bb" * 32)
    case = registry.get_case(case_id)
    assert registry.get_challenge(abandoned_id)["status"] == "UNREVEALED"
    assert registry.get_challenge(replacement_id)["status"] == "COMMITTED"
    assert case["pending_challenge_ids"] == [replacement_id]
    assert registry.get_stats()["accounting_balanced"] is True


def test_automatic_cleanup_during_finalization_preserves_finalization_state(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    abandoned_id = commit_unrevealed(direct_vm, registry, case_id, submission_id, direct_charlie)
    warp(direct_vm, NOW + 1201)
    with pytest.raises(Exception, match="challenge window has not closed"):
        registry.finalize_provisional(case_id)
    case = registry.get_case(case_id)
    assert registry.get_challenge(abandoned_id)["status"] == "UNREVEALED"
    assert case["pending_challenge_ids"] == []
    assert registry.get_stats()["accounting_balanced"] is True


def test_insufficient_overturn_blocks_queued_work_before_reopening(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    active_id, queued_id = start_review_with_queue(direct_vm, registry, case_id, submission_id, direct_charlie)
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(active_id, review("VERDICT_OVERTURNED", "INSUFFICIENT_EVIDENCE"))
    case = registry.get_case(case_id)
    assert case["status"] == "REOPENED"
    assert case["pending_challenge_ids"] == []
    assert registry.get_challenge(queued_id)["status"] == "PROTOCOL_BLOCKED"
    registry.reopen_case(case_id)
    assert registry.get_case(case_id)["status"] == "OPEN"
    assert registry.get_stats()["accounting_balanced"] is True


def test_old_callback_cannot_change_a_new_provisional_round(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    old_challenge_id = submit_challenge(direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie)
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(old_challenge_id, review("VERDICT_OVERTURNED", "INSUFFICIENT_EVIDENCE"))
    registry.reopen_case(case_id)
    new_id = submit_evidence(
        direct_vm, registry, case_id, direct_bob,
        "https://example.com/new-round", "A fresh fact for the reopened case.", salt="55" * 32,
    )
    direct_vm.sender = direct_charlie
    registry.record_verification(new_id, json.dumps({
        "status": "VERIFIED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "The new-round fact is supported.",
    }))
    registry.record_closure(new_id, json.dumps({
        "outcome": "OUTCOME_A", "sufficient": True, "decisive_evidence_ids": [new_id],
        "basis": "The new-round fact closes the case.",
    }))
    before = registry.get_case(case_id)
    registry.record_challenge_review(old_challenge_id, review("VERDICT_OVERTURNED", "OUTCOME_B"))
    after = registry.get_case(case_id)
    assert after["status"] == before["status"] == "PROVISIONAL_CLOSURE"
    assert after["challenge_round"] == new_id
    assert after["pending_final_outcome"] == ""
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
    direct_vm.sender, direct_vm.value = direct_charlie, BOND
    second_id = registry.commit_challenge(case_id, submission_id, submission_id, "bb" * 32)
    direct_vm.value = 0
    assert second_id in registry.get_case(case_id)["pending_challenge_ids"]
    warp(direct_vm, NOW + 1801)
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review("VERDICT_OVERTURNED", "OUTCOME_B"))
    assert registry.get_challenge(challenge_id)["status"] == "REVIEW_PENDING"
    registry.expire_challenge(challenge_id)
    registry.expire_challenge(second_id)
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
    challenge_id = registry.commit_challenge(case_id, submission_id, submission_id, "66" * 32)
    assert registry.get_challenge(challenge_id)["status"] == "COMMITTED"
    direct_vm.value = 0
    warp(direct_vm, NOW + 3600)
    registry.finalize_provisional(case_id)
    with pytest.raises(Exception, match="case is not accepting challenges"):
        registry.commit_challenge(case_id, submission_id, submission_id, "77" * 32)
    direct_vm.value = 0
    assert registry.get_case(case_id)["status"] == "CLOSED"
    assert registry.get_stats()["accounting_balanced"] is True


def test_finalization_at_challenge_deadline_waits_for_an_admitted_unresolved_commitment(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    warp(direct_vm, NOW + 3599)
    challenge_id = commit_unrevealed(direct_vm, registry, case_id, submission_id, direct_charlie, "88" * 32)

    warp(direct_vm, NOW + 3600)
    with pytest.raises(Exception, match="challenge commitments are unresolved"):
        registry.finalize_provisional(case_id)
    case = registry.get_case(case_id)
    assert case["status"] == "PROVISIONAL_CLOSURE"
    assert case["pending_challenge"] == ""
    assert case["pending_challenge_ids"] == [challenge_id]
    assert registry.get_challenge(challenge_id)["status"] == "COMMITTED"
    assert case["can_finalize"] is False
    assert registry.get_stats()["accounting_balanced"] is True


def test_bounded_pending_challenges_cannot_monopolize_the_window(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    challenge_ids = []
    direct_vm.sender, direct_vm.value = direct_charlie, BOND
    for index in range(4):
        challenge_ids.append(registry.commit_challenge(
            case_id, submission_id, submission_id, f"{index + 1:064x}"
        ))
    with pytest.raises(Exception, match="challenge queue is full"):
        registry.commit_challenge(case_id, submission_id, submission_id, "aa" * 32)
    direct_vm.value = 0
    warp(direct_vm, NOW + 1201)
    registry.expire_challenge(challenge_ids[0])
    direct_vm.sender, direct_vm.value = direct_charlie, BOND
    replacement = registry.commit_challenge(case_id, submission_id, submission_id, "aa" * 32)
    direct_vm.value = 0
    assert replacement in registry.get_case(case_id)["pending_challenge_ids"]
    assert registry.get_case(case_id)["challenge_count"] == 5
    assert registry.get_stats()["accounting_balanced"] is True


def test_challenge_committed_before_deadline_can_reveal_after_deadline(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    source_url = "https://example.com/late-counterevidence"
    counterclaim = "The official licence prohibits commercial redistribution."
    salt = "44" * 32
    digest = challenge_commitment(
        direct_vm, case_id, submission_id, submission_id, direct_charlie,
        source_url, counterclaim, salt,
    )
    warp(direct_vm, NOW + 3500)
    direct_vm.sender, direct_vm.value = direct_charlie, BOND
    challenge_id = registry.commit_challenge(case_id, submission_id, submission_id, digest)
    direct_vm.value = 0
    warp(direct_vm, NOW + 3601)
    registry.reveal_challenge(challenge_id, source_url, counterclaim, salt)
    assert registry.get_challenge(challenge_id)["status"] == "REVIEW_PENDING"
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review("VERDICT_UPHELD", contradicts=False, material=False))
    registry.finalize_provisional(case_id)
    assert registry.get_case(case_id)["status"] == "CLOSED"
    assert registry.get_stats()["accounting_balanced"] is True


def test_challenge_budget_resets_for_a_new_provisional_decision(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, submission_id = create_provisional(direct_vm, registry, direct_alice, direct_bob, direct_charlie)
    challenge_id = submit_challenge(direct_vm, registry, case_id, submission_id, direct_charlie, direct_charlie)
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review("VERDICT_OVERTURNED", "INSUFFICIENT_EVIDENCE"))
    registry.reopen_case(case_id)
    next_id = submit_evidence(
        direct_vm, registry, case_id, direct_bob,
        "https://example.com/new-fact", "A new fact after the previous decision round.",
    )
    direct_vm.sender = direct_charlie
    registry.record_verification(next_id, json.dumps({
        "status": "VERIFIED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "The replacement fact is supported.",
    }))
    registry.record_closure(next_id, json.dumps({
        "outcome": "OUTCOME_A", "sufficient": True,
        "decisive_evidence_ids": [next_id], "basis": "The replacement fact closes the reopened case.",
    }))
    case = registry.get_case(case_id)
    assert case["challenge_count"] == 0
    assert case["challenge_round"] == next_id
    direct_vm.sender, direct_vm.value = direct_charlie, BOND
    second_round_challenge = registry.commit_challenge(case_id, next_id, next_id, "cc" * 32)
    direct_vm.value = 0
    assert second_round_challenge != challenge_id
    assert registry.get_stats()["accounting_balanced"] is True


def test_retained_verified_fact_is_not_marked_disproven_by_an_earlier_fact_overturn(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    registry = deploy_registry(direct_vm, direct_deploy, direct_alice, direct_charlie)
    case_id, challenged_id, closing_id = create_composed_provisional(
        direct_vm, registry, direct_alice, direct_bob, direct_charlie,
    )
    challenge_id = submit_challenge(
        direct_vm, registry, case_id, closing_id, direct_charlie, direct_charlie,
        challenged_evidence_id=challenged_id,
    )
    direct_vm.sender = direct_charlie
    registry.record_challenge_review(challenge_id, review(
        "VERDICT_OVERTURNED", "OUTCOME_B", challenged_evidence_id=challenged_id,
    ))
    case = registry.get_case(case_id)
    assert registry.get_submission(challenged_id)["status"] == "OVERTURNED"
    assert registry.get_submission(closing_id)["status"] == "VERIFIED_NON_CLOSING"
    assert case["final_decision_evidence"]["challenged_evidence_id"] == challenged_id
    registry.finalize_provisional(case_id)
    assert registry.get_case(case_id)["status"] == "CLOSED"
    assert registry.get_submission(closing_id)["status"] == "VERIFIED_NON_CLOSING"
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
