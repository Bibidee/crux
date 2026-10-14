import json

import pytest

from tests.direct.conftest import addr, warp


def test_v2_verifier_rejects_contradictory_rejected_result(direct_vm, direct_deploy, direct_alice):
    warp(direct_vm)
    verifier = direct_deploy("contracts/challenge_evidence_verifier.py", addr(direct_alice))
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*example\.com/licence.*", {"status": 200, "body": "Commercial redistribution is permitted."})
    direct_vm.mock_llm(r"(?s).*CRUX_CHALLENGE_EVIDENCE_VERIFIER_V2.*", json.dumps({
        "status": "REJECTED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "All substantive checks passed.",
    }))

    with pytest.raises(Exception, match="REJECTED requires a failed substantive verification flag"):
        verifier.verify_evidence(
            "cs-1", addr(direct_alice), "Can package X be redistributed?",
            "Only if the licence permits it.", "Official upstream sources only.", "[]",
            "https://example.com/licence", "The upstream licence permits commercial redistribution.",
        )


def test_v2_closure_validator_replays_decisive_evidence_ids(direct_vm, direct_deploy, direct_alice):
    warp(direct_vm)
    judge = direct_deploy("contracts/challenge_closure_judge.py", addr(direct_alice))
    direct_vm.sender = direct_alice
    prior = json.dumps([{"id": "b-1", "url": "https://example.com/project",
                         "fact": "Example is the upstream project.", "kind": "BASELINE"}])
    expanded = json.dumps([
        {"id": "b-1", "url": "https://example.com/project",
         "fact": "Example is the upstream project.", "kind": "BASELINE"},
        {"id": "cs-1", "url": "https://example.com/licence",
         "fact": "The licence permits commercial redistribution.", "kind": "CONTRIBUTED"},
    ])
    prior_result = {
        "outcome": "INSUFFICIENT_EVIDENCE", "sufficient": False,
        "decisive_evidence_ids": [], "basis": "The baseline lacks licence permission.",
    }
    candidate_result = {
        "outcome": "OUTCOME_A", "sufficient": True,
        "decisive_evidence_ids": ["cs-1"], "basis": "The licence permits redistribution.",
    }
    direct_vm.mock_llm(r"(?s).*CRUX_CHALLENGE_CLOSURE_JUDGE_V2.*", json.dumps(prior_result))
    direct_vm.mock_llm(r"(?s).*CRUX_CHALLENGE_CLOSURE_JUDGE_V2.*", json.dumps(candidate_result))

    judge.judge_closure(
        "cs-1", addr(direct_alice), "Can package X be redistributed?",
        "Only if the licence permits it.", "Allowed", "Not allowed", prior, expanded,
    )

    direct_vm.clear_mocks()
    direct_vm.mock_llm(r"(?s).*CRUX_CHALLENGE_CLOSURE_JUDGE_V2.*", json.dumps({
        **candidate_result, "decisive_evidence_ids": ["b-1"],
        "basis": "The validators selected a different evidence item.",
    }))
    assert direct_vm.run_validator(index=-1) is False


def test_v2_closure_rejects_decisive_id_outside_packet(direct_vm, direct_deploy, direct_alice):
    warp(direct_vm)
    judge = direct_deploy("contracts/challenge_closure_judge.py", addr(direct_alice))
    direct_vm.sender = direct_alice
    evidence = json.dumps([{"id": "b-1", "url": "https://example.com/project",
                            "fact": "Example is the upstream project.", "kind": "BASELINE"}])
    direct_vm.mock_llm(r"(?s).*CRUX_CHALLENGE_CLOSURE_JUDGE_V2.*", json.dumps({
        "outcome": "OUTCOME_A", "sufficient": True,
        "decisive_evidence_ids": ["cs-not-in-packet"], "basis": "A decisive result.",
    }))

    with pytest.raises(Exception, match="decisive evidence id is not in the evidence packet"):
        judge.judge_closure(
            "cs-1", addr(direct_alice), "Can package X be redistributed?",
            "Only if the licence permits it.", "Allowed", "Not allowed", evidence, evidence,
        )
