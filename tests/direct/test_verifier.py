import json
from tests.direct.conftest import addr, capture, warp


def good():
    return {
        "status": "VERIFIED", "same_subject": True, "source_allowed": True,
        "claim_supported": True, "correct_time_scope": True, "materially_new": True,
        "non_contradictory": True, "basis": "Official upstream text directly supports the candidate fact."
    }


def test_verifier_replays_substantive_fields(direct_vm, direct_deploy, direct_alice):
    warp(direct_vm)
    _, messages = capture(direct_vm)
    contract = direct_deploy("contracts/evidence_verifier.py")
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*example\.com/licence.*", {"status": 200, "body": "Commercial redistribution is permitted."})
    direct_vm.mock_llm(r"(?s).*CRUX_EVIDENCE_VERIFIER_V1.*", json.dumps(good()))
    contract.verify_evidence("cs-1", addr(direct_alice), "Can package X be redistributed?", "Allow only if licence permits it.",
                             "Official upstream sources only.", "[]", "https://example.com/licence",
                             "The upstream licence permits commercial redistribution.")
    assert direct_vm.run_validator() is True
    assert contract.get_result("cs-1")["status"] == "VERIFIED"
    assert messages[-1]["on"] == "finalized"


def test_verifier_validator_rejects_semantic_disagreement(direct_vm, direct_deploy, direct_alice):
    warp(direct_vm)
    contract = direct_deploy("contracts/evidence_verifier.py")
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*example\.com/licence.*", {"status": 200, "body": "Commercial redistribution is permitted."})
    direct_vm.mock_llm(r"(?s).*CRUX_EVIDENCE_VERIFIER_V1.*", json.dumps(good()))
    contract.verify_evidence("cs-2", addr(direct_alice), "Can package X be redistributed?", "Allow only if licence permits it.",
                             "Official upstream sources only.", "[]", "https://example.com/licence",
                             "The upstream licence permits commercial redistribution.")
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*example\.com/licence.*", {"status": 200, "body": "Commercial redistribution is permitted."})
    direct_vm.mock_llm(r"(?s).*CRUX_EVIDENCE_VERIFIER_V1.*", json.dumps({**good(), "source_allowed": False, "status": "REJECTED"}))
    assert direct_vm.run_validator() is False
