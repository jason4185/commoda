"""Focused direct-runtime tests for the isolated historical test contract."""

from datetime import datetime, timezone
import json

import pytest


CONTRACT = "contract/CommodaHistoricalTest.py"
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
        # genlayer-test 0.29.2 keeps the direct runner's clock self-contained.
        pass


def _mock_day(vm, date, binance="100", gate="100"):
    start = _epoch(date)
    vm.mock_web(
        rf"fapi\.binance\.com/fapi/v1/klines.*startTime={start * 1000}.*",
        {"status": 200, "body": json.dumps([[start * 1000, "", "", "", binance, "", (start + 86400) * 1000 - 1]])},
    )
    vm.mock_web(
        rf"gateio\.ws/api/v4/futures/usdt/candlesticks.*from={start}.*",
        {"status": 200, "body": json.dumps([[start, "", gate]])},
    )


def _fund(vm, contract, owner, amount=30 * GEN):
    vm.sender = owner
    vm.value = amount
    contract.add_pool_funds()
    vm.value = 0


def _historical_purchase(vm, contract, buyer, date="2026-07-20", duration=7, event=1):
    vm.clear_mocks()
    _mock_day(vm, date)
    vm.sender = buyer
    vm.value = GEN
    result = contract.purchase_historical_protection("WTI", duration, event, date)
    vm.value = 0
    return result


def test_historical_purchase_dates_reference_trigger_and_accounting(direct_vm, direct_deploy, direct_owner, direct_alice):
    _warp(direct_vm, "2026-08-12T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    _fund(direct_vm, contract, direct_owner)
    assert _historical_purchase(direct_vm, contract, direct_alice) == 0
    p = contract.get_protection(0)
    assert p["purchase_date"] == "2026-07-20"
    assert p["next_date"] == "2026-07-21"
    assert p["reference_price"] == 100 * 10**8
    assert p["trigger_price"] == 99 * 10**8
    assert p["settled_days"] == 0
    assert contract.get_pool_state()["reserved_liability"] == 2 * GEN
    assert contract.get_my_protections(p["owner"], 0, 50) == [0]


@pytest.mark.parametrize("date,message", [("2026-08-12", "historical purchase date"), ("2026-08-13", "historical purchase date")])
def test_historical_purchase_rejects_today_and_future(direct_vm, direct_deploy, direct_owner, direct_alice, date, message):
    _warp(direct_vm, "2026-08-12T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    _fund(direct_vm, contract, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    with direct_vm.expect_revert(message):
        contract.purchase_historical_protection("WTI", 7, 1, date)
    direct_vm.value = 0
    assert contract.get_pool_state()["protections"] == 0


def test_historical_purchase_rejects_incomplete_window(direct_vm, direct_deploy, direct_owner, direct_alice):
    _warp(direct_vm, "2026-08-12T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    _fund(direct_vm, contract, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    with direct_vm.expect_revert("historical window incomplete"):
        contract.purchase_historical_protection("WTI", 7, 1, "2026-08-05")
    direct_vm.value = 0


def test_historical_sequential_settlement_and_inconclusive_retry(direct_vm, direct_deploy, direct_owner, direct_alice):
    _warp(direct_vm, "2026-08-12T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    _fund(direct_vm, contract, direct_owner)
    _historical_purchase(direct_vm, contract, direct_alice)

    direct_vm.clear_mocks()
    _mock_day(direct_vm, "2026-07-21", "98", "100")
    direct_vm.sender = direct_owner
    assert contract.settle_protection(0) == "INCONCLUSIVE"
    assert contract.get_protection(0)["next_date"] == "2026-07-21"
    assert contract.get_current_market_settlement_version("WTI", "2026-07-21")["version"] == 1

    direct_vm.clear_mocks()
    _mock_day(direct_vm, "2026-07-21", "100", "100")
    assert contract.settle_protection(0) == "ACTIVE"
    assert contract.get_protection(0)["next_date"] == "2026-07-22"
    assert contract.get_protection_day_result(0, "2026-07-21")["evidence_version"] == 2

    direct_vm.clear_mocks()
    _mock_day(direct_vm, "2026-07-22", "100", "100")
    assert contract.settle_protection(0) == "ACTIVE"
    assert contract.get_protection(0)["next_date"] == "2026-07-23"


def test_historical_breach_claim_path(direct_vm, direct_deploy, direct_owner, direct_alice):
    _warp(direct_vm, "2026-08-12T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    _fund(direct_vm, contract, direct_owner, 5 * GEN)
    _historical_purchase(direct_vm, contract, direct_alice)
    direct_vm.clear_mocks()
    _mock_day(direct_vm, "2026-07-21", "98", "98")
    direct_vm.sender = direct_owner
    assert contract.settle_protection(0) == "CLAIMABLE"
    direct_vm.sender = direct_alice
    assert contract.claim_readiness(0)["can_claim"] is True
    contract.claim_payout(0)
    assert contract.get_protection(0)["state"] == "CLAIMED"
    assert contract.get_pool_state()["reserved_liability"] == 0


def test_historical_source_failure_does_not_advance_and_pause_only_blocks_purchase(direct_vm, direct_deploy, direct_owner, direct_alice):
    _warp(direct_vm, "2026-08-12T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    _fund(direct_vm, contract, direct_owner)
    _historical_purchase(direct_vm, contract, direct_alice)
    direct_vm.sender = direct_owner
    contract.pause_purchases()
    direct_vm.value = GEN
    with direct_vm.expect_revert("purchases paused"):
        contract.purchase_historical_protection("WTI", 7, 1, "2026-07-20")
    direct_vm.value = 0
    direct_vm.clear_mocks()
    _mock_day(direct_vm, "2026-07-21", "98", "98")
    # Replace both valid mocks with unavailable responses for this day.
    direct_vm.clear_mocks()
    start = _epoch("2026-07-21")
    direct_vm.mock_web(r"fapi\.binance\.com/fapi/v1/klines.*", {"status": 503, "body": ""})
    direct_vm.mock_web(r"gateio\.ws/api/v4/futures/usdt/candlesticks.*", {"status": 503, "body": ""})
    with direct_vm.expect_revert("Binance unavailable"):
        contract.settle_protection(0)
    assert contract.get_protection(0)["next_date"] == "2026-07-21"


def test_historical_all_clear_expires_and_releases_reserve(direct_vm, direct_deploy, direct_owner, direct_alice):
    _warp(direct_vm, "2026-08-12T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    _fund(direct_vm, contract, direct_owner, 5 * GEN)
    _historical_purchase(direct_vm, contract, direct_alice)
    direct_vm.clear_mocks()
    for day in ("2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26", "2026-07-27"):
        _mock_day(direct_vm, day, "100", "100")
    direct_vm.sender = direct_owner
    for _ in range(7):
        assert contract.settle_protection(0) == ("EXPIRED" if _ == 6 else "ACTIVE")
    assert contract.get_protection(0)["state"] == "EXPIRED"
    assert contract.get_pool_state()["reserved_liability"] == 0
    direct_vm.sender = direct_alice
    assert contract.claim_readiness(0)["status"] == "NOT_CLAIMABLE"
