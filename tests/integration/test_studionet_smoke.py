"""Opt-in deployment smoke test for stable Studionet (chain 61999).

Run only after the direct suite is green:
  CRUX_RUN_STUDIONET_INTEGRATION=1 gltest tests/integration/ -v -s

This deploys three contracts to the configured Studionet account. It intentionally
stops before funding a case because a complete market demo needs two funded wallets.
"""
import os
import pytest

from gltest import get_contract_factory, get_default_account

pytestmark = pytest.mark.skipif(
    os.getenv("CRUX_RUN_STUDIONET_INTEGRATION") != "1",
    reason="set CRUX_RUN_STUDIONET_INTEGRATION=1 to write to Studionet",
)


def test_three_contract_deployment_and_schema_wiring():
    account = get_default_account()
    verifier = get_contract_factory(contract_file_path="evidence_verifier.py").deploy(
        args=[], account=account, wait_retries=180,
    )
    judge = get_contract_factory(contract_file_path="closure_judge.py").deploy(
        args=[], account=account, wait_retries=180,
    )
    registry = get_contract_factory(contract_file_path="crux_registry.py").deploy(
        args=[str(verifier.address), str(judge.address)], account=account, wait_retries=180,
    )

    stats = registry.get_stats().call()
    assert str(stats["chain_id"]) == "61999"
    assert str(stats["network"]) == "StudioNet"
    assert str(stats["verifier"]).lower() == str(verifier.address).lower()
    assert str(stats["judge"]).lower() == str(judge.address).lower()
    assert stats["admin_controls"] is False
    assert stats["accounting_balanced"] is True
