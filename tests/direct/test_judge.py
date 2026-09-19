import json
import pytest
from tests.direct.conftest import addr, capture, warp


def test_closure_judge_can_keep_verified_graph_insufficient(direct_vm, direct_deploy, direct_alice):
    warp(direct_vm)
    _, messages = capture(direct_vm)
    contract = direct_deploy("contracts/closure_judge.py", addr(direct_alice))
    direct_vm.sender = direct_alice
    direct_vm.mock_llm(r"(?s).*CRUX_CLOSURE_JUDGE_V1.*", json.dumps({
        "outcome": "INSUFFICIENT_EVIDENCE", "sufficient": False,
        "decisive_evidence_ids": [], "basis": "Maintainer identity does not establish licence permission."
    }))
    evidence = json.dumps([{"id":"b-1","url":"https://example.com/project","fact":"Example is upstream.","kind":"BASELINE"}])
    contract.judge_closure("cs-1", addr(direct_alice), "Can package X be redistributed?",
                           "Allowed only if licence permits redistribution.", "Allowed", "Not allowed", evidence, evidence)
    assert direct_vm.run_validator() is True
    assert contract.get_result("cs-1")["outcome"] == "INSUFFICIENT_EVIDENCE"
    assert messages[-1]["on"] == "finalized"


def test_closure_validator_rejects_opposite_outcome(direct_vm, direct_deploy, direct_alice):
    warp(direct_vm)
    contract = direct_deploy("contracts/closure_judge.py", addr(direct_alice))
    direct_vm.sender = direct_alice
    prior = json.dumps([{"id":"b-1","url":"https://example.com/project","fact":"Example is upstream.","kind":"BASELINE"}])
    evidence = json.dumps([{"id":"cs-2","url":"https://example.com/licence","fact":"Licence permits commercial redistribution.","kind":"CONTRIBUTED"}])
    direct_vm.mock_llm(r'(?s).*"id":"b-1".*', json.dumps({
        "outcome": "INSUFFICIENT_EVIDENCE", "sufficient": False,
        "decisive_evidence_ids": [], "basis": "The baseline lacks licence permission."
    }))
    direct_vm.mock_llm(r'(?s).*"id":"cs-2".*', json.dumps({
        "outcome": "OUTCOME_A", "sufficient": True, "decisive_evidence_ids": ["cs-2"], "basis": "Permission is explicit."
    }))
    contract.judge_closure("cs-2", addr(direct_alice), "Can package X be redistributed?",
                           "Allowed only if licence permits redistribution.", "Allowed", "Not allowed", prior, evidence)
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r'(?s).*"id":"cs-2".*', json.dumps({
        "outcome": "OUTCOME_B", "sufficient": True, "decisive_evidence_ids": ["cs-2"], "basis": "Validator disagrees."
    }))
    assert direct_vm.run_validator() is False


def test_judge_rejects_unconfigured_registry_sender(direct_vm, direct_deploy, direct_alice, direct_bob):
    warp(direct_vm)
    contract = direct_deploy("contracts/closure_judge.py", addr(direct_alice))
    direct_vm.sender = direct_bob
    with pytest.raises(Exception, match="configured registry"):
        contract.judge_closure("cs-unauthorized", addr(direct_bob), "Question", "Rule", "A", "B",
                               '[{"id":"b-1","fact":"Context"}]', '[{"id":"b-1","fact":"Context"}]')
