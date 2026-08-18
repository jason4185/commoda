"""Official GenLayer direct-runtime adversarial audit tests for Commoda v1."""

from datetime import datetime, timezone
import json

import pytest


CONTRACT = "contract/CommodaProtection.py"
GEN = 10**18
SCALE = 10**8
SYMBOLS = {
    "WTI": ("CLUSDT", "CL_USDT"),
    "BRENT": ("BZUSDT", "BZ_USDT"),
    "NATGAS": ("NATGASUSDT", "NG_USDT"),
}


def _hex(address):
    return "0x" + bytes(address).hex()


def _warp(vm, timestamp):
    """Work around direct-runner 0.29.2 not refreshing message_raw time."""
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
    # Direct runner generic calldata loses Address typing; invoke the decoded runtime type.
    contract._instance.add_operator(_runtime_address(address))


def _remove_operator(contract, address):
    contract._instance.remove_operator(_runtime_address(address))


def _fund(vm, contract, owner, amount=30 * GEN):
    vm.sender = owner
    vm.value = amount
    contract.add_pool_funds()
    vm.value = 0


def _mock_reference(vm, market="WTI", price="100"):
    vm.clear_mocks()
    vm.mock_web(
        r"gateio\.ws/api/v4/futures/usdt/tickers",
        {"status": 200, "body": json.dumps([{"contract": SYMBOLS[market][1], "last": price}])},
    )


def _purchase(vm, contract, buyer, market="WTI", duration=7, event=1, premium=GEN, price="100"):
    _mock_reference(vm, market, price)
    vm.sender = buyer
    vm.value = premium
    protection_id = contract.purchase_protection(market, duration, event)
    vm.value = 0
    return protection_id


def _day_epoch(date):
    return int(datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp())


def _mock_settlement(vm, date, binance="98", gate="98", binance_status=200, gate_status=200):
    start = _day_epoch(date)
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


def _assert_abi_primitive(value):
    if isinstance(value, dict):
        assert all(isinstance(key, str) for key in value)
        for nested in value.values():
            _assert_abi_primitive(nested)
    elif isinstance(value, list):
        for nested in value:
            _assert_abi_primitive(nested)
    else:
        assert value is None or isinstance(value, (str, int, bool, bytes)), type(value)


def _abi_roundtrip(value):
    from genlayer.py import calldata

    _assert_abi_primitive(value)
    assert calldata.decode(calldata.encode(value)) == value


def test_runtime_initialization_and_zero_state(direct_vm, direct_deploy, direct_owner):
    contract = direct_deploy(CONTRACT)
    config = contract.get_config()
    pool = contract.get_pool_state()

    assert config["owner"].lower() == _hex(direct_owner)
    assert config["paused"] is False
    assert config["purchase_equivalence_bps"] == 5
    assert contract.get_supported_markets() == ["WTI", "BRENT", "NATGAS"]
    assert pool == {
        "pool_balance": 0,
        "reserved_liability": 0,
        "available_liquidity": 0,
        "protections": 0,
        "active": 0,
        "claimable": 0,
        "expired": 0,
        "claimed": 0,
        "cancelled": 0,
        "premiums": 0,
        "premiums_refunded": 0,
        "net_retained_premiums": 0,
        "payouts_paid": 0,
        "paused": False,
    }
    assert contract.get_operators() == []


def test_owner_only_funding_and_withdrawal_reserve(direct_vm, direct_deploy, direct_owner, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    with direct_vm.expect_revert("unauthorized"):
        contract.add_pool_funds()
    direct_vm.value = 0

    _fund(direct_vm, contract, direct_owner, 5 * GEN)
    assert _purchase(direct_vm, contract, direct_alice) == 0
    assert contract.get_pool_state()["reserved_liability"] == 2 * GEN

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("unauthorized"):
        contract.withdraw_unreserved_gen(1)
    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("insufficient unreserved liquidity"):
        contract.withdraw_unreserved_gen(5)
    contract.withdraw_unreserved_gen(4)
    pool = contract.get_pool_state()
    assert pool["pool_balance"] == pool["reserved_liability"] == 2 * GEN


@pytest.mark.parametrize(
    ("market", "duration", "event", "value", "message"),
    [
        ("WTI", 7, 1, 0, "invalid premium"),
        ("WTI", 7, 1, 2 * GEN, "invalid premium"),
        ("GOLD", 7, 1, GEN, "invalid market"),
        ("WTI", 7, 4, GEN, "invalid event percent"),
        ("WTI", 8, 1, GEN, "invalid terms"),
    ],
)
def test_purchase_rejections(direct_vm, direct_deploy, direct_alice, market, duration, event, value, message):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = value
    with direct_vm.expect_revert(message):
        contract.purchase_protection(market, duration, event)
    assert contract.get_pool_state()["protections"] == 0


def test_purchase_insufficient_liquidity(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    with direct_vm.expect_revert("insufficient liquidity"):
        contract.purchase_protection("WTI", 7, 3)


def test_numeric_ids_owner_indexes_and_address_abi(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner)
    assert _purchase(direct_vm, contract, direct_alice) == 0
    assert _purchase(direct_vm, contract, direct_bob) == 1
    assert _purchase(direct_vm, contract, direct_alice) == 2

    alice = contract.get_protection(0)["owner"]
    bob = contract.get_protection(1)["owner"]
    assert contract.get_my_protections(alice.lower(), 0, 50) == [0, 2]
    assert contract.get_my_protections("0x" + alice[2:].upper(), 0, 50) == [0, 2]
    assert contract.get_my_protections(bob, 0, 50) == [1]
    assert contract.get_owner_protection_count(alice) == 2
    assert [card["protection_id"] for card in contract.get_owner_protection_cards(alice, 0, 50)] == [0, 2]
    assert contract.get_user_summary(alice)["total"] == 2
    assert contract.get_user_attention(alice, 0, 50)["total_owner_protections"] == 2

    for invalid in ("not-an-address", "0x" + "g" * 40, "0x" + "0" * 40):
        with direct_vm.expect_revert("invalid address"):
            contract.get_owner_protection_count(invalid)


def test_permissions_and_operator_limit(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_accounts):
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner)
    _purchase(direct_vm, contract, direct_alice)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("unauthorized"):
        contract.pause_purchases()
    with direct_vm.expect_revert("unauthorized"):
        _add_operator(contract, direct_accounts[0])
    with direct_vm.expect_revert("unauthorized"):
        _remove_operator(contract, direct_accounts[0])
    with direct_vm.expect_revert("unauthorized"):
        contract.settle_protection(0)
    with direct_vm.expect_revert("unauthorized"):
        contract.claim_payout(0)

    direct_vm.sender = direct_owner
    for operator in direct_accounts[:5]:
        _add_operator(contract, operator)
    with direct_vm.expect_revert("operator limit"):
        _add_operator(contract, direct_accounts[5])
    assert len(contract.get_operators()) == 5
    _remove_operator(contract, direct_accounts[1])
    assert len(contract.get_operators()) == 4
    assert contract.is_operator(_hex(direct_accounts[1])) is False


def test_too_early_sequential_and_authorized_settlement(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    direct_vm.warp("2026-08-01T12:00:00Z")
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner)
    _purchase(direct_vm, contract, direct_alice)

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("settlement day incomplete"):
        contract.settle_protection(0)
    assert contract.settlement_readiness(0, "2026-08-03")["status"] == "SETTLEMENT_ORDER"

    _warp(direct_vm, "2026-08-03T00:00:01Z")
    _mock_settlement(direct_vm, "2026-08-02", "100", "100")
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("unauthorized"):
        contract.settle_protection(0)
    direct_vm.sender = direct_owner
    assert contract.settle_protection(0) == "ACTIVE"
    assert contract.get_protection(0)["next_date"] == "2026-08-03"
    assert contract.settlement_readiness(0, "2026-08-04")["status"] == "SETTLEMENT_ORDER"


def test_same_day_settlement_is_blocked_at_each_utc_boundary(direct_vm, direct_deploy, direct_owner, direct_alice):
    direct_vm.warp("2026-08-12T12:00:00Z")
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner)
    _purchase(direct_vm, contract, direct_alice)
    direct_vm.sender = direct_owner

    before = contract.get_protection(0)
    pool_before = contract.get_pool_state()
    for timestamp in ("2026-08-13T00:00:00Z", "2026-08-13T12:00:00Z", "2026-08-13T23:59:59Z"):
        _warp(direct_vm, timestamp)
        with direct_vm.expect_revert("settlement day incomplete"):
            contract.settle_protection(0)
        current = contract.get_protection(0)
        assert current["next_date"] == before["next_date"] == "2026-08-13"
        assert current["settled_days"] == before["settled_days"] == 0
        assert current["state"] == before["state"] == "ACTIVE"
        assert contract.get_pool_state() == pool_before
        assert contract.get_current_market_settlement_version("WTI", "2026-08-13")["version"] == 0

    _warp(direct_vm, "2026-08-14T00:00:00Z")
    _mock_settlement(direct_vm, "2026-08-13", "100", "100")
    assert contract.settle_protection(0) == "ACTIVE"
    assert contract.get_protection(0)["next_date"] == "2026-08-14"
    assert contract.get_protection_day_result(0, "2026-08-14")["evidence_version"] == 0


def test_sender_sensitive_readiness_views_match_authorization(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie):
    direct_vm.warp("2026-08-01T12:00:00Z")
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner)
    _purchase(direct_vm, contract, direct_alice)
    direct_vm.sender = direct_owner
    _add_operator(contract, direct_bob)
    _warp(direct_vm, "2026-08-03T00:00:01Z")

    for sender, expected in (
        (direct_alice, True),
        (direct_owner, True),
        (direct_bob, True),
        (direct_charlie, False),
        (bytes(20), False),
    ):
        direct_vm.sender = sender
        readiness = contract.settlement_readiness(0)
        assert readiness["can_settle"] is expected
        if not expected:
            assert readiness["status"] == "UNAUTHORIZED"

    _mock_settlement(direct_vm, "2026-08-02", "98", "98")
    direct_vm.sender = direct_owner
    assert contract.settle_protection(0) == "CLAIMABLE"
    for sender, expected in ((direct_alice, True), (direct_owner, False), (direct_charlie, False), (bytes(20), False)):
        direct_vm.sender = sender
        readiness = contract.claim_readiness(0)
        assert readiness["can_claim"] is expected


def test_operator_settlement_breached_claim_permissions_and_accounting(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    direct_vm.warp("2026-08-01T12:00:00Z")
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner, 5 * GEN)
    _purchase(direct_vm, contract, direct_alice)
    direct_vm.sender = direct_owner
    _add_operator(contract, direct_bob)

    _warp(direct_vm, "2026-08-03T00:00:01Z")
    _mock_settlement(direct_vm, "2026-08-02", "98", "98")
    direct_vm.sender = direct_bob
    assert contract.settle_protection(0) == "CLAIMABLE"
    pool = contract.get_pool_state()
    assert pool["reserved_liability"] == 2 * GEN
    assert pool["claimable"] == 1

    with direct_vm.expect_revert("unauthorized"):
        contract.claim_payout(0)
    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("unauthorized"):
        contract.claim_payout(0)
    direct_vm.sender = direct_alice
    contract.claim_payout(0)
    pool = contract.get_pool_state()
    assert pool["pool_balance"] == 4 * GEN
    assert pool["reserved_liability"] == 0
    assert pool["claimed"] == 1
    assert pool["payouts_paid"] == 2 * GEN
    assert pool["reserved_liability"] <= pool["pool_balance"]
    with direct_vm.expect_revert("not claimable"):
        contract.claim_payout(0)


def test_inconclusive_retry_versions_evidence(direct_vm, direct_deploy, direct_owner, direct_alice):
    direct_vm.warp("2026-08-01T12:00:00Z")
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner)
    _purchase(direct_vm, contract, direct_alice)
    _warp(direct_vm, "2026-08-03T00:00:01Z")

    _mock_settlement(direct_vm, "2026-08-02", "98", "100")
    direct_vm.sender = direct_owner
    assert contract.settle_protection(0) == "INCONCLUSIVE"
    assert contract.settlement_readiness(0)["status"] == "INCONCLUSIVE_RETRY"
    assert contract.get_protection(0)["settled_days"] == 0
    assert contract.get_current_market_settlement_version("WTI", "2026-08-02")["version"] == 1

    _mock_settlement(direct_vm, "2026-08-02", "98", "98")
    assert contract.settle_protection(0) == "CLAIMABLE"
    evidence = contract.get_market_settlement("WTI", "2026-08-02")
    assert evidence["version"] == 2
    assert contract.get_protection_day_result(0, "2026-08-02")["evidence_version"] == 2
    assert contract.get_market_settlement_version("WTI", "2026-08-02", 1)["version"] == 1
    assert contract.get_market_settlement_version("WTI", "2026-08-02", 2)["version"] == 2
    with direct_vm.expect_revert("settlement unavailable"):
        contract.get_market_settlement_version("WTI", "2026-08-02", 3)


def test_not_breached_expiry_releases_reserve(direct_vm, direct_deploy, direct_owner, direct_alice):
    direct_vm.warp("2026-08-01T12:00:00Z")
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner, 5 * GEN)
    _purchase(direct_vm, contract, direct_alice)

    direct_vm.sender = direct_owner
    for offset in range(7):
        date = f"2026-08-{offset + 2:02d}"
        _warp(direct_vm, f"2026-08-{offset + 3:02d}T00:00:01Z")
        _mock_settlement(direct_vm, date, "100", "100")
        result = contract.settle_protection(0)
    assert result == "EXPIRED"
    assert contract.get_protection(0)["settled_days"] == 7
    pool = contract.get_pool_state()
    assert pool["reserved_liability"] == 0
    assert pool["expired"] == 1
    assert pool["pool_balance"] == 6 * GEN
    assert len(contract.get_protection_history(0, 0, 30)) == 7


def test_pause_blocks_only_purchase_and_not_settle_retry_or_claim(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob, direct_charlie):
    direct_vm.warp("2026-08-01T12:00:00Z")
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner)
    _purchase(direct_vm, contract, direct_alice, "WTI")
    _purchase(direct_vm, contract, direct_bob, "BRENT")
    _purchase(direct_vm, contract, direct_charlie, "NATGAS")
    _warp(direct_vm, "2026-08-03T00:00:01Z")

    direct_vm.sender = direct_owner
    _mock_settlement(direct_vm, "2026-08-02", "98", "98")
    assert contract.settle_protection(0) == "CLAIMABLE"
    _mock_settlement(direct_vm, "2026-08-02", "98", "100")
    assert contract.settle_protection(1) == "INCONCLUSIVE"
    contract.pause_purchases()

    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    with direct_vm.expect_revert("purchases paused"):
        contract.purchase_protection("WTI", 7, 1)
    direct_vm.value = 0

    direct_vm.sender = direct_owner
    _mock_settlement(direct_vm, "2026-08-02", "100", "100")
    assert contract.settle_protection(2) == "ACTIVE"
    _mock_settlement(direct_vm, "2026-08-02", "98", "98")
    assert contract.settle_protection(1) == "CLAIMABLE"
    direct_vm.sender = direct_alice
    contract.claim_payout(0)
    assert contract.get_protection(0)["state"] == "CLAIMED"


def test_source_failure_preserves_state_and_retry_succeeds(direct_vm, direct_deploy, direct_owner, direct_alice):
    direct_vm.warp("2026-08-01T12:00:00Z")
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner)

    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    direct_vm.mock_web(
        r"gateio\.ws/api/v4/futures/usdt/tickers",
        {"status": 503, "body": "{}"},
    )
    with direct_vm.expect_revert("Gate unavailable"):
        contract.purchase_protection("WTI", 7, 1)
    assert contract.get_pool_state()["protections"] == 0

    _purchase(direct_vm, contract, direct_alice)
    _warp(direct_vm, "2026-08-03T00:00:01Z")
    _mock_settlement(direct_vm, "2026-08-02", binance_status=503)
    direct_vm.sender = direct_owner
    assert contract.settle_protection(0) == "UNAVAILABLE"
    assert contract.get_protection(0)["state"] == "ACTIVE"
    assert contract.get_protection_day_result(0, "2026-08-02")["status"] == "UNAVAILABLE"
    assert contract.get_current_market_settlement_version("WTI", "2026-08-02")["version"] == 0
    _mock_settlement(direct_vm, "2026-08-02", "98", "98")
    assert contract.settle_protection(0) == "CLAIMABLE"


def test_purchase_and_settlement_consensus_validators(direct_vm, direct_deploy, direct_owner, direct_alice):
    direct_vm.warp("2026-08-01T12:00:00Z")
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner)
    _purchase(direct_vm, contract, direct_alice)

    _mock_reference(direct_vm, "WTI", "100.04")
    assert direct_vm.run_validator(index=0) is True
    _mock_reference(direct_vm, "WTI", "101")
    assert direct_vm.run_validator(index=0) is False

    _warp(direct_vm, "2026-08-03T00:00:01Z")
    _mock_settlement(direct_vm, "2026-08-02", "98", "98")
    direct_vm.sender = direct_owner
    assert contract.settle_protection(0) == "CLAIMABLE"
    _mock_settlement(direct_vm, "2026-08-02", "98", "98")
    assert direct_vm.run_validator(index=1) is True
    _mock_settlement(direct_vm, "2026-08-02", "97", "98")
    assert direct_vm.run_validator(index=1) is False


def test_unavailable_settlement_requires_validator_agreement(direct_vm, direct_deploy, direct_owner, direct_alice):
    direct_vm.warp("2026-08-01T12:00:00Z")
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner)
    _purchase(direct_vm, contract, direct_alice)
    _warp(direct_vm, "2026-08-03T00:00:01Z")
    _mock_settlement(direct_vm, "2026-08-02", binance_status=503)
    direct_vm.sender = direct_owner
    assert contract.settle_protection(0) == "UNAVAILABLE"
    _mock_settlement(direct_vm, "2026-08-02", binance_status=503)
    assert direct_vm.run_validator(index=1) is True
    _mock_settlement(direct_vm, "2026-08-02", "100", "100")
    assert direct_vm.run_validator(index=1) is False


def test_unresolved_failure_identity_binds_source_and_class(direct_vm, direct_deploy, direct_owner, direct_alice):
    direct_vm.warp("2026-08-01T12:00:00Z")
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner)
    _purchase(direct_vm, contract, direct_alice)
    _warp(direct_vm, "2026-08-03T00:00:01Z")
    _mock_settlement(direct_vm, "2026-08-02", binance_status=503)
    direct_vm.sender = direct_owner
    assert contract.settle_protection(0) == "UNAVAILABLE"

    _mock_settlement(direct_vm, "2026-08-02", gate_status=503)
    assert direct_vm.run_validator(index=1) is False

    _mock_settlement(direct_vm, "2026-08-02", binance_status=503)
    assert direct_vm.run_validator(index=1) is True

    _mock_settlement(direct_vm, "2026-08-02", binance_status=200)
    direct_vm.mock_web(r"fapi\.binance\.com/fapi/v1/klines", {"status": 200, "body": "{bad"})
    assert direct_vm.run_validator(index=1) is False


def test_nondet_closures_pickle(direct_vm, direct_deploy, direct_owner, direct_alice):
    import cloudpickle

    direct_vm.warp("2026-08-01T12:00:00Z")
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner)
    _purchase(direct_vm, contract, direct_alice)
    _warp(direct_vm, "2026-08-03T00:00:01Z")
    _mock_settlement(direct_vm, "2026-08-02", "100", "100")
    direct_vm.sender = direct_owner
    contract.settle_protection(0)

    assert len(direct_vm._captured_validators) == 2
    for _, leader_fn, validator_fn in direct_vm._captured_validators:
        cloudpickle.loads(cloudpickle.dumps(leader_fn))
        cloudpickle.loads(cloudpickle.dumps(validator_fn))


def test_every_public_view_is_runtime_abi_encodable(direct_vm, direct_deploy, direct_owner, direct_alice, direct_bob):
    direct_vm.warp("2026-08-01T12:00:00Z")
    contract = _deploy_funded(direct_vm, direct_deploy, direct_owner)
    _purchase(direct_vm, contract, direct_alice)
    direct_vm.sender = direct_owner
    _add_operator(contract, direct_bob)
    _warp(direct_vm, "2026-08-03T00:00:01Z")
    _mock_settlement(direct_vm, "2026-08-02", "98", "98")
    contract.settle_protection(0)
    owner = contract.get_protection(0)["owner"]

    outputs = [
        contract.get_config(),
        contract.get_supported_markets(),
        contract.get_market("WTI"),
        contract.get_market_terms("WTI"),
        contract.get_product_terms("WTI", 7, 1),
        contract.preview_trigger(100 * SCALE, 1),
        contract.quote_protection("WTI", 7, 1),
        contract.get_purchase_readiness("WTI", 7, 1),
        contract.get_pool_state(),
        contract.get_protection(0),
        contract.get_protection_card(0),
        contract.get_my_protections(owner, 0, 50),
        contract.get_owner_protection_count(owner),
        contract.get_owner_protection_cards(owner, 0, 50),
        contract.get_user_summary(owner),
        contract.get_user_attention(owner, 0, 50),
        contract.get_market_settlement("WTI", "2026-08-02"),
        contract.get_market_settlement_version("WTI", "2026-08-02", 1),
        contract.settlement_readiness(0),
        contract.cancellation_readiness(0),
        contract.claim_readiness(0),
        contract.get_protection_day_result(0, "2026-08-02"),
        contract.get_protection_history(0, 0, 30),
        contract.get_current_market_settlement_version("WTI", "2026-08-02"),
        contract.is_operator(_hex(direct_bob)),
        contract.get_operators(),
    ]
    for output in outputs:
        _abi_roundtrip(output)


def test_end_to_end_adversarial_lifecycle(direct_vm, direct_deploy, direct_owner, direct_alice):
    direct_vm.warp("2026-08-01T12:00:00Z")
    contract = direct_deploy(CONTRACT)
    _fund(direct_vm, contract, direct_owner, 10 * GEN)
    assert contract.quote_protection("WTI", 7, 1)["premium"] == GEN
    assert contract.get_purchase_readiness("WTI", 7, 1)["status"] == "READY"

    protection_id = _purchase(direct_vm, contract, direct_alice)
    assert protection_id == 0
    owner = contract.get_protection(0)["owner"]
    assert contract.get_my_protections(owner, 0, 50) == [0]
    assert contract.get_pool_state()["reserved_liability"] == 2 * GEN
    assert contract.get_protection_card(0)["protection_id"] == 0

    _warp(direct_vm, "2026-08-03T00:00:01Z")
    assert contract.settlement_readiness(0)["can_settle"] is True
    _mock_settlement(direct_vm, "2026-08-02", "98", "98")
    direct_vm.sender = direct_owner
    assert contract.settle_protection(0) == "CLAIMABLE"
    history = contract.get_protection_history(0, 0, 30)
    assert history[0]["status"] == "BREACHED"
    assert contract.get_user_summary(owner)["claimable_payout"] == 2 * GEN

    direct_vm.sender = direct_alice
    assert contract.claim_readiness(0)["can_claim"] is True
    contract.claim_payout(0)
    pool = contract.get_pool_state()
    assert contract.get_protection(0)["state"] == "CLAIMED"
    assert pool["pool_balance"] == 9 * GEN
    assert pool["reserved_liability"] == 0
    assert pool["reserved_liability"] <= pool["pool_balance"]
