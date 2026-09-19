import hashlib
import json
import pytest

from tests.direct.conftest import NOW, addr, capture, warp

BOUNTY = 10**16
BOND = 10**14
BASELINE = json.dumps([{
    "url": "https://example.com/project",
    "fact": "Package X version 4.2 is published by Example Project."
}])
RULE = "Return ALLOWED only if the upstream licence for package X version 4.2 explicitly permits commercial redistribution. Return NOT ALLOWED only if it explicitly prohibits that redistribution. Otherwise remain insufficient."


def open_case(vm, contract, sponsor):
    vm.sender, vm.value = sponsor, BOUNTY
    try:
        cid = contract.create_case(
            "Package X redistribution",
            "Can package X version 4.2 be redistributed inside a paid commercial product?",
            RULE, "Allowed", "Not allowed",
            "Use first-party upstream documentation and official registries only.",
            BASELINE, NOW + 7200,
        )
    finally:
        vm.value = 0
    vm.sender = vm._contract_address
    vm.clear_mocks()
    vm.mock_web(r".*example\.com/project.*", {"status": 200, "body": "Example Project publishes package X version 4.2."})
    vm.mock_llm(r"(?s).*CRUX_BASELINE_V1.*", json.dumps({
        "status": "READY", "outcome": "INSUFFICIENT_EVIDENCE",
        "basis": "The package identity is established but the licence permission is absent."
    }))
    contract.validate_baseline(cid)
    assert vm.run_validator() is True
    return cid


def commitment(vm, cid, contributor, url, fact, salt):
    payload = ["crux-v1", "61999", addr(vm._contract_address).lower(), cid,
               addr(contributor).lower(), url, fact, salt]
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


def test_case_must_begin_insufficient(direct_vm, direct_deploy, direct_alice, direct_charlie):
    warp(direct_vm)
    contract = direct_deploy("contracts/crux_registry.py", addr(direct_charlie), addr(direct_charlie))
    direct_vm.sender, direct_vm.value = direct_alice, BOUNTY
    cid = contract.create_case(
        "Package X redistribution", "Can package X be redistributed commercially under the policy?",
        RULE, "Allowed", "Not allowed", "Use upstream primary sources only.", BASELINE, NOW + 7200,
    )
    direct_vm.value = 0
    direct_vm.sender = direct_vm._contract_address
    direct_vm.mock_web(r".*example\.com/project.*", {"status": 200, "body": "Licence explicitly permits commercial redistribution."})
    direct_vm.mock_llm(r"(?s).*CRUX_BASELINE_V1.*", json.dumps({
        "status": "READY", "outcome": "OUTCOME_A", "basis": "The baseline already establishes permission."
    }))
    contract.validate_baseline(cid)
    assert direct_vm.run_validator() is True
    case = contract.get_case(cid)
    assert case["status"] == "BASELINE_ALREADY_DECIDABLE"
    assert contract.get_credit(addr(direct_alice)) == str(BOUNTY)
    assert contract.get_stats()["accounting_balanced"] is True


def test_component_bootstrap_is_one_time_and_not_rebindable(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/crux_registry.py", "", "")
    direct_vm.sender = direct_bob
    with pytest.raises(Exception, match="bootstrapper"):
        contract.configure_components(addr(direct_charlie), addr(direct_charlie))
    direct_vm.sender = direct_alice
    contract.configure_components(addr(direct_charlie), addr(direct_charlie))
    assert contract.get_stats()["components_configured"] is True
    with pytest.raises(Exception, match="already configured"):
        contract.configure_components(addr(direct_bob), addr(direct_bob))


def test_commit_reveal_verify_compose_close_and_withdraw(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    transfers, messages = capture(direct_vm)
    verifier = addr(direct_charlie)
    contract = direct_deploy("contracts/crux_registry.py", verifier, verifier)
    cid = open_case(direct_vm, contract, direct_alice)
    assert contract.get_case(cid)["status"] == "OPEN"

    url1 = "https://example.com/maintainer"
    fact1 = "Example Project is the upstream maintainer of package X version 4.2."
    salt1 = "11" * 32
    digest1 = commitment(direct_vm, cid, direct_bob, url1, fact1, salt1)
    direct_vm.sender, direct_vm.value = direct_bob, BOND
    sid1 = contract.commit_evidence(cid, digest1)
    direct_vm.value = 0
    assert contract.get_submission_for_commitment(digest1) == sid1
    contract.reveal_evidence(sid1, url1, fact1, salt1)
    assert contract.get_submission(sid1)["status"] == "VERIFICATION_PENDING"
    assert messages[-1]["on"] == "finalized"

    direct_vm.sender = direct_charlie
    verified = {
        "status": "VERIFIED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "The upstream page establishes maintainer identity."
    }
    contract.record_verification(sid1, json.dumps(verified))
    assert contract.get_submission(sid1)["status"] == "CLOSURE_PENDING"
    contract.record_closure(sid1, json.dumps({
        "outcome": "INSUFFICIENT_EVIDENCE", "sufficient": False,
        "decisive_evidence_ids": [], "basis": "Licence permission is still missing."
    }))
    assert contract.get_submission(sid1)["status"] == "VERIFIED_NON_CLOSING"
    assert len(contract.get_case(cid)["accepted_evidence"]) == 2
    assert contract.get_credit(addr(direct_bob)) == str(BOND)

    url2 = "https://example.com/licence"
    fact2 = "The upstream licence for package X version 4.2 permits commercial redistribution."
    salt2 = "22" * 32
    digest2 = commitment(direct_vm, cid, direct_bob, url2, fact2, salt2)
    direct_vm.sender, direct_vm.value = direct_bob, BOND
    sid2 = contract.commit_evidence(cid, digest2)
    direct_vm.value = 0
    contract.reveal_evidence(sid2, url2, fact2, salt2)
    direct_vm.sender = direct_charlie
    contract.record_verification(sid2, json.dumps({**verified, "basis": "The official licence establishes permission."}))
    contract.record_closure(sid2, json.dumps({
        "outcome": "OUTCOME_A", "sufficient": True,
        "decisive_evidence_ids": [sid2], "basis": "The verified licence satisfies the rule."
    }))
    case = contract.get_case(cid)
    assert case["status"] == "CLOSED" and case["final_outcome"] == "OUTCOME_A"
    assert case["winner"].lower() == addr(direct_bob).lower()
    assert contract.get_credit(addr(direct_bob)) == str(BOUNTY + 2 * BOND)
    assert contract.get_stats()["accounting_balanced"] is True

    direct_vm.sender = direct_alice
    contract.withdraw_credit(addr(direct_bob))
    assert int(transfers[-1]["value"]) == BOUNTY + 2 * BOND
    assert contract.get_stats()["accounting_balanced"] is True


def test_rejected_evidence_cannot_take_bounty(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    contract = direct_deploy("contracts/crux_registry.py", addr(direct_charlie), addr(direct_charlie))
    cid = open_case(direct_vm, contract, direct_alice)
    url, fact, salt = "https://example.com/blog", "A random blog says redistribution is allowed.", "33" * 32
    digest = commitment(direct_vm, cid, direct_bob, url, fact, salt)
    direct_vm.sender, direct_vm.value = direct_bob, BOND
    sid = contract.commit_evidence(cid, digest)
    direct_vm.value = 0
    contract.reveal_evidence(sid, url, fact, salt)
    direct_vm.sender = direct_charlie
    contract.record_verification(sid, json.dumps({
        "status": "REJECTED", "same_subject": True, "source_allowed": False,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "The source policy excludes third-party blogs."
    }))
    assert contract.get_submission(sid)["status"] == "REJECTED"
    assert contract.get_case(cid)["status"] == "OPEN"
    assert contract.get_credit(addr(direct_alice)) == str(BOND)
    assert contract.get_credit(addr(direct_bob)) == "0"


def test_commitment_is_bound_to_registry_case_wallet_and_reveal(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    contract = direct_deploy("contracts/crux_registry.py", addr(direct_charlie), addr(direct_charlie))
    cid = open_case(direct_vm, contract, direct_alice)
    url, fact, salt = "https://example.com/licence", "The licence permits redistribution.", "44" * 32
    wrong_payload = ["crux-v1", "61998", addr(direct_vm._contract_address).lower(), cid, addr(direct_bob).lower(), url, fact, salt]
    digest = hashlib.sha256(json.dumps(wrong_payload, separators=(",", ":"), sort_keys=True).encode()).hexdigest()
    direct_vm.sender, direct_vm.value = direct_bob, BOND
    sid = contract.commit_evidence(cid, digest)
    direct_vm.value = 0
    with pytest.raises(Exception, match="bound commitment"):
        contract.reveal_evidence(sid, url, fact, salt)


def test_terminal_submissions_release_capacity_but_history_remains(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    contract = direct_deploy("contracts/crux_registry.py", addr(direct_charlie), addr(direct_charlie))
    cid = open_case(direct_vm, contract, direct_alice)
    url, fact, salt = "https://example.com/rejected", "A rejected fact for capacity testing.", "99" * 32
    first_digest = commitment(direct_vm, cid, direct_bob, url, fact, salt)
    direct_vm.sender, direct_vm.value = direct_bob, BOND
    contract.commit_evidence(cid, first_digest)
    for index in range(39):
        contract.commit_evidence(cid, f"{index + 2:064x}")
    with pytest.raises(Exception, match="submission limit"):
        contract.commit_evidence(cid, "aa" * 32)
    direct_vm.value = 0
    digest = commitment(direct_vm, cid, direct_bob, "https://example.com/accepted", "A new fact after release.", "aa" * 32)
    # Replace the first historical commitment with a real terminal rejection.
    # The first 40 records remain auditable; only active capacity is released.
    first = contract.get_submission_for_commitment(first_digest)
    assert first == "cs-1"
    direct_vm.sender = direct_bob
    contract.reveal_evidence(first, url, fact, salt)
    direct_vm.sender = direct_charlie
    contract.record_verification(first, json.dumps({
        "status": "REJECTED", "same_subject": True, "source_allowed": False,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "Capacity regression test rejection."
    }))
    direct_vm.sender, direct_vm.value = direct_bob, BOND
    sid = contract.commit_evidence(cid, digest)
    assert sid == "cs-41"
    direct_vm.value = 0


def test_commit_rejected_when_reveal_window_reaches_case_deadline(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    contract = direct_deploy("contracts/crux_registry.py", addr(direct_charlie), addr(direct_charlie))
    cid = open_case(direct_vm, contract, direct_alice)
    warp(direct_vm, NOW + 6000)
    direct_vm.sender, direct_vm.value = direct_bob, BOND
    with pytest.raises(Exception, match="case is not open"):
        contract.commit_evidence(cid, "ab" * 32)
    direct_vm.value = 0


def test_source_unavailable_is_retryable_and_refunds_bond(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    contract = direct_deploy("contracts/crux_registry.py", addr(direct_charlie), addr(direct_charlie))
    cid = open_case(direct_vm, contract, direct_alice)
    url, fact, salt = "https://example.com/down", "The official source establishes a licence fact.", "55" * 32
    digest = commitment(direct_vm, cid, direct_bob, url, fact, salt)
    direct_vm.sender, direct_vm.value = direct_bob, BOND
    sid = contract.commit_evidence(cid, digest)
    direct_vm.value = 0
    contract.reveal_evidence(sid, url, fact, salt)
    direct_vm.sender = direct_charlie
    contract.record_verification(sid, json.dumps({
        "status": "SOURCE_UNAVAILABLE", "same_subject": False, "source_allowed": False,
        "claim_supported": False, "correct_time_scope": False, "materially_new": False,
        "non_contradictory": False, "basis": "Source could not be fetched."
    }))
    assert contract.get_submission(sid)["status"] == "RETRYABLE_SOURCE"
    assert contract.get_credit(addr(direct_bob)) == str(BOND)
    assert contract.get_case(cid)["status"] == "OPEN"


def test_sponsor_cannot_compete_and_bond_must_match(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    contract = direct_deploy("contracts/crux_registry.py", addr(direct_charlie), addr(direct_charlie))
    cid = open_case(direct_vm, contract, direct_alice)
    digest = "aa" * 32
    direct_vm.sender, direct_vm.value = direct_alice, BOND
    with pytest.raises(Exception, match="sponsor cannot"):
        contract.commit_evidence(cid, digest)
    direct_vm.sender, direct_vm.value = direct_bob, BOND - 1
    with pytest.raises(Exception, match="exact evidence bond"):
        contract.commit_evidence(cid, digest)
    direct_vm.value = 0


def test_duplicate_commitment_rejected_and_unrevealed_bond_goes_to_sponsor(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    contract = direct_deploy("contracts/crux_registry.py", addr(direct_charlie), addr(direct_charlie))
    cid = open_case(direct_vm, contract, direct_alice)
    url, fact, salt = "https://example.com/licence", "The upstream licence permits redistribution.", "66" * 32
    digest = commitment(direct_vm, cid, direct_bob, url, fact, salt)
    direct_vm.sender, direct_vm.value = direct_bob, BOND
    sid = contract.commit_evidence(cid, digest)
    with pytest.raises(Exception, match="commitment already used"):
        contract.commit_evidence(cid, digest)
    direct_vm.value = 0
    warp(direct_vm, NOW + 1200)
    contract.expire_submission(sid)
    assert contract.get_submission(sid)["status"] == "UNREVEALED"
    assert contract.get_credit(addr(direct_alice)) == str(BOND)
    assert contract.get_stats()["accounting_balanced"] is True


def test_pending_stage_timeout_is_inconclusive_and_refunds_contributor(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    contract = direct_deploy("contracts/crux_registry.py", addr(direct_charlie), addr(direct_charlie))
    cid = open_case(direct_vm, contract, direct_alice)
    url, fact, salt = "https://example.com/licence", "The upstream licence permits redistribution.", "77" * 32
    digest = commitment(direct_vm, cid, direct_bob, url, fact, salt)
    direct_vm.sender, direct_vm.value = direct_bob, BOND
    sid = contract.commit_evidence(cid, digest)
    direct_vm.value = 0
    contract.reveal_evidence(sid, url, fact, salt)
    warp(direct_vm, NOW + 1800)
    contract.expire_submission(sid)
    assert contract.get_submission(sid)["status"] == "INCONCLUSIVE"
    assert contract.get_credit(addr(direct_bob)) == str(BOND)
    assert contract.get_case(cid)["status"] == "OPEN"


def test_expired_case_refunds_sponsor_and_late_verification_goes_stale(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    contract = direct_deploy("contracts/crux_registry.py", addr(direct_charlie), addr(direct_charlie))
    cid = open_case(direct_vm, contract, direct_alice)
    url, fact, salt = "https://example.com/licence", "The upstream licence permits redistribution.", "88" * 32
    digest = commitment(direct_vm, cid, direct_bob, url, fact, salt)
    direct_vm.sender, direct_vm.value = direct_bob, BOND
    sid = contract.commit_evidence(cid, digest)
    direct_vm.value = 0
    contract.reveal_evidence(sid, url, fact, salt)
    warp(direct_vm, NOW + 7200)
    direct_vm.sender = direct_alice
    contract.expire_case(cid)
    assert contract.get_credit(addr(direct_alice)) == str(BOUNTY)
    direct_vm.sender = direct_charlie
    contract.record_verification(sid, json.dumps({
        "status": "VERIFIED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "The official licence establishes permission."
    }))
    assert contract.get_submission(sid)["status"] == "STALE"
    assert contract.get_credit(addr(direct_bob)) == str(BOND)
    assert contract.get_stats()["accounting_balanced"] is True


def test_two_contributors_can_reveal_while_one_is_pending_and_queue_is_fair(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    contract = direct_deploy("contracts/crux_registry.py", addr(direct_charlie), addr(direct_charlie))
    cid = open_case(direct_vm, contract, direct_alice)
    url1, fact1, salt1 = "https://example.com/first", "The first source is admissible but non-closing.", "a1" * 32
    url2, fact2, salt2 = "https://example.com/second", "The second source is admissible and complementary.", "a2" * 32
    d1 = commitment(direct_vm, cid, direct_bob, url1, fact1, salt1)
    d2 = commitment(direct_vm, cid, direct_charlie, url2, fact2, salt2)
    direct_vm.sender, direct_vm.value = direct_bob, BOND
    sid1 = contract.commit_evidence(cid, d1)
    direct_vm.sender, direct_vm.value = direct_charlie, BOND
    sid2 = contract.commit_evidence(cid, d2)
    direct_vm.value = 0
    direct_vm.sender = direct_bob
    contract.reveal_evidence(sid1, url1, fact1, salt1)
    direct_vm.sender = direct_charlie
    contract.reveal_evidence(sid2, url2, fact2, salt2)
    assert contract.get_submission(sid1)["status"] == "VERIFICATION_PENDING"
    assert contract.get_submission(sid2)["status"] == "REVEAL_QUEUED"
    direct_vm.sender = direct_charlie
    contract.record_verification(sid1, json.dumps({
        "status": "SOURCE_UNAVAILABLE", "same_subject": False, "source_allowed": False,
        "claim_supported": False, "correct_time_scope": False, "materially_new": False,
        "non_contradictory": False, "basis": "The source was unavailable."
    }))
    assert contract.get_credit(addr(direct_bob)) == str(BOND)
    assert contract.get_submission(sid2)["status"] == "VERIFICATION_PENDING"
    assert contract.get_stats()["accounting_balanced"] is True


def test_winning_case_refunds_other_protocol_blocked_commitment(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    contract = direct_deploy("contracts/crux_registry.py", addr(direct_charlie), addr(direct_charlie))
    cid = open_case(direct_vm, contract, direct_alice)
    url1, fact1, salt1 = "https://example.com/winner", "The official source proves the decisive licence permission.", "b1" * 32
    url2, fact2, salt2 = "https://example.com/queued", "A second contributor committed before closure.", "b2" * 32
    d1 = commitment(direct_vm, cid, direct_bob, url1, fact1, salt1)
    d2 = commitment(direct_vm, cid, direct_charlie, url2, fact2, salt2)
    direct_vm.sender, direct_vm.value = direct_bob, BOND
    sid1 = contract.commit_evidence(cid, d1)
    direct_vm.sender, direct_vm.value = direct_charlie, BOND
    sid2 = contract.commit_evidence(cid, d2)
    direct_vm.value = 0
    direct_vm.sender = direct_bob
    contract.reveal_evidence(sid1, url1, fact1, salt1)
    direct_vm.sender = direct_charlie
    contract.reveal_evidence(sid2, url2, fact2, salt2)
    direct_vm.sender = direct_charlie
    verified = {"status": "VERIFIED", "same_subject": True, "source_allowed": True,
                "claim_supported": True, "correct_time_scope": True, "materially_new": True,
                "non_contradictory": True, "basis": "The source is decisive."}
    contract.record_verification(sid1, json.dumps(verified))
    contract.record_closure(sid1, json.dumps({"outcome": "OUTCOME_A", "sufficient": True,
                                              "decisive_evidence_ids": [sid1], "basis": "It closes the rule."}))
    assert contract.get_case(cid)["status"] == "CLOSED"
    assert contract.get_submission(sid2)["status"] == "PROTOCOL_BLOCKED"
    assert contract.get_credit(addr(direct_charlie)) == str(BOND)
    assert contract.get_credit(addr(direct_bob)) == str(BOUNTY + BOND)
    assert contract.get_stats()["accounting_balanced"] is True


def test_winning_closure_refunds_timely_unrevealed_commitment(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    """Closure makes B's still-timely reveal impossible, so B gets the bond."""
    warp(direct_vm)
    contract = direct_deploy("contracts/crux_registry.py", addr(direct_charlie), addr(direct_charlie))
    cid = open_case(direct_vm, contract, direct_alice)
    url, fact, salt = "https://example.com/winner", "The winner proves the decisive fact.", "d1" * 32
    digest = commitment(direct_vm, cid, direct_bob, url, fact, salt)
    direct_vm.sender, direct_vm.value = direct_bob, BOND
    sid_b = contract.commit_evidence(cid, digest)
    direct_vm.sender, direct_vm.value = direct_charlie, BOND
    sid_a = contract.commit_evidence(cid, commitment(direct_vm, cid, direct_charlie, url, fact, "d2" * 32))
    direct_vm.value = 0
    direct_vm.sender = direct_charlie
    contract.reveal_evidence(sid_a, url, fact, "d2" * 32)
    verified = {"status": "VERIFIED", "same_subject": True, "source_allowed": True,
                "claim_supported": True, "correct_time_scope": True, "materially_new": True,
                "non_contradictory": True, "basis": "The source is decisive."}
    contract.record_verification(sid_a, json.dumps(verified))
    contract.record_closure(sid_a, json.dumps({"outcome": "OUTCOME_A", "sufficient": True,
                                              "decisive_evidence_ids": [sid_a], "basis": "It closes the rule."}))
    assert contract.get_submission(sid_b)["status"] == "PROTOCOL_BLOCKED"
    assert contract.get_credit(addr(direct_bob)) == str(BOND)
    assert contract.get_credit(addr(direct_alice)) == str(BOUNTY)
    assert contract.get_stats()["accounting_balanced"] is True


def test_queued_reveal_at_expiry_refunds_contributor_but_unrevealed_forfeits(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    warp(direct_vm)
    contract = direct_deploy("contracts/crux_registry.py", addr(direct_charlie), addr(direct_charlie))
    cid = open_case(direct_vm, contract, direct_alice)
    url, fact, salt = "https://example.com/queued-expiry", "A queued source should remain recoverable.", "c1" * 32
    digest = commitment(direct_vm, cid, direct_bob, url, fact, salt)
    direct_vm.sender, direct_vm.value = direct_bob, BOND
    sid = contract.commit_evidence(cid, digest)
    direct_vm.value = 0
    contract.reveal_evidence(sid, url, fact, salt)
    warp(direct_vm, NOW + 7200)
    direct_vm.sender = direct_alice
    contract.expire_case(cid)
    assert contract.get_submission(sid)["status"] == "PROTOCOL_BLOCKED"
    assert contract.get_credit(addr(direct_bob)) == str(BOND)
    assert contract.get_stats()["accounting_balanced"] is True
