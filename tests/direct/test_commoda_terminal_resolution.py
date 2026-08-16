"""Direct-runtime tests for bounded unresolved settlement resolution."""

from datetime import datetime, timezone
import json

import pytest


CONTRACT = "contract/CommodaProtection.py"
GEN = 10**18
SYMBOLS = {"WTI": ("CLUSDT", "CL_USDT")}


def _epoch(date):
    return int(datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp())


def _warp(vm, timestamp):
    vm.warp(timestamp)
    try:
        import genlayer.gl as gl

        gl.message_raw["datetime"] = timestamp
    except ImportError:
        pass


def _runtime_address(address):
    from genlayer.py.types import Address

    return Address(bytes(address))


def _add_operator(contract, address):
    contract._instance.add_operator(_runtime_address(address))


def _fund(vm, contract, owner, amount=30 * GEN):
    vm.sender = owner
    vm.value = amount
    contract.add_pool_funds()
    vm.value = 0


def _mock_reference(vm, price="100"):
    vm.clear_mocks()
    vm.mock_web(
        r"gateio\.ws/api/v4/futures/usdt/tickers",
        {"status": 200, "body": json.dumps([{"contract": "CL_USDT", "last": price}])},
    )


def _purchase(vm, contract, buyer):
    _mock_reference(vm)
    vm.sender = buyer
    vm.value = GEN
    protection_id = contract.purchase_protection("WTI", 7, 1)
    vm.value = 0
    return protection_id


def _mock_day(vm, date, binance="100", gate="100", binance_status=200, gate_status=200):
    start = _epoch(date)
    vm.clear_mocks()
    vm.mock_web(
        r"fapi\.binance\.com/fapi/v1/klines",
        {
            "status": binance_status,
            "body": json.dumps([[start * 1000, "", "", "", binance, "", (start + 86400) * 1000 - 1]]),
        },
    )
    vm.mock_web(
        r"gateio\.ws/api/v4/futures/usdt/candlesticks",
        {"status": gate_status, "body": json.dumps([[start, "", gate]])},
    )


def _deploy_funded(vm, deploy, owner, amount=30 * GEN):
    contract = deploy(CONTRACT)
    _fund(vm, contract, owner, amount)
    return contract


def _prepare(vm, deploy, owner, alice):
    _warp(vm, "2026-08-12T12:00:00Z")
    contract = _deploy_funded(vm, deploy, owner)
    _purchase(vm, contract, alice)
    return contract


def test_cancellation_boundary_is_exactly_three_complete_retry_days(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _prepare(direct_vm, direct_deploy, direct_owner, direct_alice)
    direct_vm.sender = direct_owner

    for timestamp in (
        "2026-08-14T00:00:00Z",
        "2026-08-15T00:00:00Z",
        "2026-08-16T23:59:59Z",
    ):
        _warp(direct_vm, timestamp)
        readiness = contract.cancellation_readiness(0)
        assert readiness["unresolved_date"] == "2026-08-13"
        assert readiness["eligible_date"] == "2026-08-17"
        assert readiness["terminal_grace_days"] == 3
        assert readiness["status"] == "GRACE_PERIOD"
        assert readiness["can_cancel"] is False
        with direct_vm.expect_revert("terminal grace period active"):
            contract.cancel_unresolved_protection(0)

    _warp(direct_vm, "2026-08-17T00:00:00Z")
    assert contract.cancellation_readiness(0)["status"] == "READY"
    assert contract.cancellation_readiness(0)["can_cancel"] is True
    contract.cancel_unresolved_protection(0)
    assert contract.get_protection(0)["state"] == "CANCELLED"


def test_unprocessed_source_failure_can_cancel_and_refunds_accounting(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _prepare(direct_vm, direct_deploy, direct_owner, direct_alice)
    _warp(direct_vm, "2026-08-14T00:00:00Z")
    _mock_day(direct_vm, "2026-08-13", binance_status=503, gate_status=503)
    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("Binance unavailable"):
        contract.settle_protection(0)
    assert contract.get_protection_day_result(0, "2026-08-13")["status"] == "UNPROCESSED"

    before = contract.get_pool_state()
    assert before["pool_balance"] == 31 * GEN
    assert before["reserved_liability"] == 2 * GEN
    assert before["premiums"] == GEN
    assert before["premiums_refunded"] == 0

    _warp(direct_vm, "2026-08-17T00:00:00Z")
    direct_vm.sender = direct_alice
    contract.cancel_unresolved_protection(0)
    after = contract.get_pool_state()
    assert after["pool_balance"] == 30 * GEN
    assert after["reserved_liability"] == 0
    assert after["available_liquidity"] == 30 * GEN
    assert after["premiums"] == before["premiums"] == GEN
    assert after["premiums_refunded"] == GEN
    assert after["net_retained_premiums"] == 0
    assert after["active"] == 0
    assert after["cancelled"] == 1
    summary = contract.get_user_summary(contract.get_protection(0)["owner"])
    assert summary["active"] == 0
    assert summary["cancelled"] == 1
    assert summary["premiums"] == GEN
    assert summary["premiums_refunded"] == GEN
    assert summary["payouts"] == 0


def test_inconclusive_retries_during_grace_then_cancels(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _prepare(direct_vm, direct_deploy, direct_owner, direct_alice)
    _warp(direct_vm, "2026-08-14T00:00:00Z")
    _mock_day(direct_vm, "2026-08-13", "98", "100")
    direct_vm.sender = direct_owner
    assert contract.settle_protection(0) == "INCONCLUSIVE"
    assert contract.get_protection(0)["next_date"] == "2026-08-13"
    assert contract.cancellation_readiness(0)["day_status"] == "INCONCLUSIVE"

    _warp(direct_vm, "2026-08-16T23:59:59Z")
    _mock_day(direct_vm, "2026-08-13", "98", "100")
    assert contract.settle_protection(0) == "INCONCLUSIVE"
    assert contract.get_current_market_settlement_version("WTI", "2026-08-13")["version"] == 2
    assert contract.cancellation_readiness(0)["status"] == "GRACE_PERIOD"

    _warp(direct_vm, "2026-08-17T00:00:00Z")
    direct_vm.sender = direct_alice
    assert contract.cancellation_readiness(0)["status"] == "READY"
    contract.cancel_unresolved_protection(0)
    assert contract.get_protection(0)["state"] == "CANCELLED"


def test_inconclusive_recovery_before_deadline_advances_normally(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _prepare(direct_vm, direct_deploy, direct_owner, direct_alice)
    _warp(direct_vm, "2026-08-14T00:00:00Z")
    _mock_day(direct_vm, "2026-08-13", "98", "100")
    direct_vm.sender = direct_owner
    assert contract.settle_protection(0) == "INCONCLUSIVE"

    _warp(direct_vm, "2026-08-15T00:00:00Z")
    _mock_day(direct_vm, "2026-08-13", "100", "100")
    assert contract.settle_protection(0) == "ACTIVE"
    protection = contract.get_protection(0)
    assert protection["next_date"] == "2026-08-14"
    assert contract.get_protection_day_result(0, "2026-08-13")["status"] == "NOT_BREACHED"
    assert contract.cancellation_readiness(0)["can_cancel"] is False


def test_breach_before_deadline_is_claimable_not_cancellable(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _prepare(direct_vm, direct_deploy, direct_owner, direct_alice)
    _warp(direct_vm, "2026-08-14T00:00:00Z")
    _mock_day(direct_vm, "2026-08-13", "98", "100")
    direct_vm.sender = direct_owner
    assert contract.settle_protection(0) == "INCONCLUSIVE"

    _warp(direct_vm, "2026-08-15T00:00:00Z")
    _mock_day(direct_vm, "2026-08-13", "98", "98")
    assert contract.settle_protection(0) == "CLAIMABLE"
    assert contract.cancellation_readiness(0)["status"] == "NOT_ACTIVE"
    assert contract.get_pool_state()["reserved_liability"] == 2 * GEN
    with direct_vm.expect_revert("protection not active"):
        contract.cancel_unresolved_protection(0)


def test_cancelled_protection_cannot_settle_claim_or_cancel_again(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _prepare(direct_vm, direct_deploy, direct_owner, direct_alice)
    _warp(direct_vm, "2026-08-17T00:00:00Z")
    direct_vm.sender = direct_alice
    contract.cancel_unresolved_protection(0)
    pool = contract.get_pool_state()
    with direct_vm.expect_revert("protection not active"):
        contract.cancel_unresolved_protection(0)
    with direct_vm.expect_revert("protection not active"):
        contract.settle_protection(0)
    with direct_vm.expect_revert("not claimable"):
        contract.claim_payout(0)
    assert contract.get_pool_state() == pool


def test_paused_contract_still_allows_eligible_cancellation(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = _prepare(direct_vm, direct_deploy, direct_owner, direct_alice)
    direct_vm.sender = direct_owner
    contract.pause_purchases()
    _warp(direct_vm, "2026-08-17T00:00:00Z")
    direct_vm.sender = direct_alice
    assert contract.cancellation_readiness(0)["can_cancel"] is True
    contract.cancel_unresolved_protection(0)
    assert contract.get_protection(0)["state"] == "CANCELLED"


def test_cancellation_authorization_and_owner_refund_accounting(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie):
    _warp(direct_vm, "2026-08-12T12:00:00Z")
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner, 30 * GEN)
    _purchase(direct_vm, contract, direct_alice)
    _purchase(direct_vm, contract, direct_alice)
    _purchase(direct_vm, contract, direct_alice)
    _purchase(direct_vm, contract, direct_alice)
    direct_vm.sender = direct_owner
    _add_operator(contract, direct_bob)

    _warp(direct_vm, "2026-08-17T00:00:00Z")
    direct_vm.sender = direct_charlie
    assert contract.cancellation_readiness(0)["status"] == "UNAUTHORIZED"
    with direct_vm.expect_revert("unauthorized"):
        contract.cancel_unresolved_protection(0)

    direct_vm.sender = direct_alice
    contract.cancel_unresolved_protection(0)
    direct_vm.sender = direct_owner
    contract.cancel_unresolved_protection(1)
    direct_vm.sender = direct_bob
    contract.cancel_unresolved_protection(2)
    assert contract.get_pool_state()["cancelled"] == 3
    assert contract.get_pool_state()["premiums_refunded"] == 3 * GEN
    assert contract.get_user_summary(contract.get_protection(0)["owner"])["premiums_refunded"] == 3 * GEN
    direct_vm.sender = direct_alice
    assert contract.get_protection(3)["state"] == "ACTIVE"


@pytest.mark.parametrize(("final_binance", "final_gate", "final_state"), [("100", "100", "ACTIVE"), ("98", "98", "CLAIMABLE")])
def test_conclusive_protection_result_is_immutable_when_shared_evidence_gets_new_version(
    direct_vm, direct_deploy, direct_owner, direct_alice, final_binance, final_gate, final_state
):
    _warp(direct_vm, "2026-08-12T12:00:00Z")
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner, 30 * GEN)
    _purchase(direct_vm, contract, direct_alice)
    _purchase(direct_vm, contract, direct_alice)

    _warp(direct_vm, "2026-08-14T00:00:00Z")
    _mock_day(direct_vm, "2026-08-13", "98", "100")
    direct_vm.sender = direct_owner
    assert contract.settle_protection(0) == "INCONCLUSIVE"
    assert contract.settle_protection(1) == "INCONCLUSIVE"

    _mock_day(direct_vm, "2026-08-13", final_binance, final_gate)
    assert contract.settle_protection(0) == final_state
    first = contract.get_protection_day_result(0, "2026-08-13")
    assert first["status"] == ("BREACHED" if final_state == "CLAIMABLE" else "NOT_BREACHED")
    assert first["evidence_version"] == 2

    _mock_day(direct_vm, "2026-08-13", "98", "100")
    assert contract.settle_protection(1) == "INCONCLUSIVE"
    current = contract.get_current_market_settlement_version("WTI", "2026-08-13")
    assert current["version"] == 3
    unchanged = contract.get_protection_day_result(0, "2026-08-13")
    assert unchanged == first
    assert contract.get_protection(0)["state"] == final_state
