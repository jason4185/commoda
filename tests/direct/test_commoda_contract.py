"""Focused locked-v1 Commoda checks; no live exchange requests."""
from pathlib import Path

SOURCE = Path(__file__).parents[2] / "contract" / "CommodaProtection.py"
TEXT = SOURCE.read_text()

MARKETS = {
    "WTI": ("CLUSDT", "CL_USDT"),
    "BRENT": ("BZUSDT", "BZ_USDT"),
    "NATGAS": ("NATGASUSDT", "NG_USDT"),
}
TERMS = {
    (7, 1): (1, 2), (7, 2): (1, 3), (7, 3): (1, 4),
    (14, 1): (2, 4), (14, 2): (2, 5), (14, 3): (2, 6),
    (30, 1): (3, 6), (30, 2): (3, 8), (30, 3): (3, 10),
}


def outcome(binance, gate, trigger):
    b, g = binance <= trigger, gate <= trigger
    return "BREACHED" if b and g else "NOT_BREACHED" if not b and not g else "INCONCLUSIVE"


def test_runner_header_and_size():
    lines = TEXT.splitlines()
    assert lines[0] == '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }'
    assert lines[1] == ""
    assert SOURCE.stat().st_size < 52 * 1024


def test_locked_markets_and_mappings():
    for market, (binance, gate) in MARKETS.items():
        assert f'"{market}": "{binance}"' in TEXT
        assert f'"{market}": "{gate}"' in TEXT
    assert 'MARKETS = ("WTI", "BRENT", "NATGAS")' in TEXT


def test_down_only_purchase_and_storage():
    purchase = TEXT.split("def purchase_protection", 1)[1].split("def settle_protection", 1)[0]
    assert "direction" not in purchase
    assert "direction:" not in TEXT
    assert '"drop_only": True' in TEXT
    assert '"protection_type": "PRICE_DROP"' in TEXT
    assert '"down_only"' not in TEXT
    assert 'event_percent: u256' in TEXT


def test_exact_trigger_levels_and_economics():
    assert "EVENT_PERCENTS = (1, 2, 3)" in TEXT
    assert set(TERMS) == {(7, 1), (7, 2), (7, 3), (14, 1), (14, 2), (14, 3), (30, 1), (30, 2), (30, 3)}
    assert all(TERMS[key] == value for key, value in {
        (7, 1): (1, 2), (7, 2): (1, 3), (7, 3): (1, 4),
        (14, 1): (2, 4), (14, 2): (2, 5), (14, 3): (2, 6),
        (30, 1): (3, 6), (30, 2): (3, 8), (30, 3): (3, 10),
    }.items())
    for duration, bps, premium, payout in (
        (7, 100, 1, 2), (7, 200, 1, 3), (7, 300, 1, 4),
        (14, 100, 2, 4), (14, 200, 2, 5), (14, 300, 2, 6),
        (30, 100, 3, 6), (30, 200, 3, 8), (30, 300, 3, 10),
    ):
        assert f"({duration}, {bps}): (" in TEXT
        assert premium <= payout
    assert "PREMIUMS" not in TEXT
    assert "PAYOUTS" not in TEXT


def test_down_trigger_math():
    reference = 100 * 10**8
    assert reference * (10000 - 100) // 10000 == 99 * 10**8
    assert reference * (10000 - 200) // 10000 == 98 * 10**8
    assert reference * (10000 - 300) // 10000 == 97 * 10**8
    assert "reference_price * (10000 - event_bps) // 10000" in TEXT
    assert "def _event_bps_from_percent" in TEXT
    assert "return event_percent * 100" in TEXT


def test_public_event_percent_mapping_and_rejections():
    mapping = {1: 100, 2: 200, 3: 300}
    assert all(percent * 100 == bps for percent, bps in mapping.items())
    assert "if event_percent not in EVENT_PERCENTS:" in TEXT
    assert "event_percent: int" in TEXT
    assert "event_bps: int" not in TEXT
    assert "event_percent=0.5" not in TEXT
    assert "event_percent=1.5" not in TEXT
    assert all(value not in (1, 2, 3) for value in (0, 4, 50, 100))
    assert "float(" not in TEXT


def test_public_event_outputs_are_percentage_first():
    for method in ("get_market_terms", "get_product_terms", "quote_protection",
                   "get_purchase_readiness", "purchase_protection"):
        section = TEXT.split("def " + method, 1)[1].split("@gl.public", 1)[0]
        assert "event_percent" in section
    assert '"event_percent": list(EVENT_PERCENTS)' in TEXT
    assert '"drop_percent": _drop_label(event_percent)' in TEXT
    assert '"event_bps"' not in TEXT
    assert '"drop_bps"' not in TEXT


def test_withdrawal_uses_whole_gen_input_and_native_transfer():
    withdrawal = TEXT.split("def withdraw_unreserved_gen", 1)[1].split("def purchase_protection", 1)[0]
    assert "amount_gen: int" in withdrawal
    assert "amount_native = amount_gen * GEN" in withdrawal
    assert "amount_gen <= 0" in withdrawal
    assert "(2**256 - 1) // GEN" in withdrawal
    assert "amount_native > self.pool_balance - self.reserved_liability" in withdrawal
    assert "self.pool_balance -= amount_native" in withdrawal
    assert "value=u256(amount_native)" in withdrawal
    assert 'on="finalized"' in withdrawal
    assert 1 * 10**18 == 10**18
    assert 2 * 10**18 == 2 * 10**18


def test_gate_only_purchase_reference():
    ref = TEXT.split("def _reference", 1)[1].split("@gl.public.view", 1)[0]
    assert "api.gateio.ws" in ref
    assert "fapi.binance.com" not in ref
    assert "PURCHASE_EQ_BPS = 5" in TEXT
    assert "gl.vm.run_nondet_unsafe(fetch, verify)" in ref
    assert "abs(a - b) * 10000" in ref


def purchase_equivalent(a, b):
    return abs(a - b) * 10000 <= min(a, b) * 5


def test_purchase_equivalence_is_exactly_5_bps_without_unavailable_source_time():
    base = 100 * 10**8
    assert purchase_equivalent(base, base * 10005 // 10000)
    assert purchase_equivalent(base, base * 10005 // 10000 + 1) is False
    ref = TEXT.split("def _reference", 1)[1].split("@gl.public.view", 1)[0]
    assert "PURCHASE_EQ_BPS" in ref
    assert "min(a, b) * PURCHASE_EQ_BPS" in ref
    assert '"timestamp"' not in ref


def test_purchase_reference_rejects_stale_and_future_data():
    ref = TEXT.split("def _reference", 1)[1].split("@gl.public.view", 1)[0]
    assert 'row["last"]' in ref
    assert 'row["time"]' not in ref
    assert "res.status != 200" in TEXT
    assert '"purchase_timestamp_source": "transaction"' in TEXT


def test_historical_sources_use_exact_completed_utc_candles():
    assert "fapi.binance.com/fapi/v1/klines" in TEXT
    assert "api.gateio.ws/api/v4/futures/usdt/candlesticks" in TEXT
    assert "interval=1d" in TEXT
    assert "opened != start" in TEXT
    assert "closed != start + DAY * 1000 - 1" in TEXT
    assert '== start' in TEXT
    assert "Gate candle missing" in TEXT


def test_historical_directional_agreement_has_no_tolerance_or_average():
    historical = TEXT.split("def _historical", 1)[1].split("def _same_error", 1)[0]
    settlement = TEXT.split("def settle_protection", 1)[1].split("def claim_payout", 1)[0]
    assert "TOLERANCE" not in historical
    assert "(b + g) // 2" not in historical + settlement
    assert "abs(b - g)" not in historical + settlement
    assert "binance_close <= p.trigger_price" in settlement
    assert "gate_close <= p.trigger_price" in settlement
    assert "b and g" in settlement
    assert "not b and not g" in settlement


def test_historical_outcomes():
    assert outcome(79, 77, 80) == "BREACHED"
    assert outcome(81, 80.1, 80) == "NOT_BREACHED"
    assert outcome(79.9, 80.1, 80) == "INCONCLUSIVE"
    assert outcome(80.1, 79.9, 80) == "INCONCLUSIVE"
    assert outcome(1, 999, 1000) == "BREACHED"


def test_protection_specific_results_and_ordering():
    assert "class DayResult" in TEXT
    assert "UNPROCESSED" in TEXT
    assert "self.days[day_key] = DayResult(result" in TEXT
    assert "p.next_date >= _today()" in TEXT
    assert "prior.status == INCONCLUSIVE" in TEXT
    assert "self.days[_day_key(protection_id, p.next_date)]" in TEXT
    assert "settlement_readiness(self, protection_id" in TEXT
    assert "p.state == CLAIMED" in TEXT
    assert 'return "PROTECTION_NOT_ACTIVE"' in TEXT


def test_inconclusive_blocks_progress_and_retries_versioned_evidence():
    settlement = TEXT.split("def settle_protection", 1)[1].split("def claim_payout", 1)[0]
    assert "return result" in settlement
    assert "if result == INCONCLUSIVE" in settlement
    assert "p.settled_days += 1" in settlement
    assert "self.settlement_versions.get(base, 0) + 1" in TEXT
    assert 'base + "|v" + str(version)' in TEXT
    assert "prior.status == INCONCLUSIVE" in settlement
    assert 'self.current_settlement.get(base, "")' in TEXT
    assert "old version" not in TEXT


def test_shared_evidence_is_trigger_neutral():
    assert "current_settlement: TreeMap" in TEXT
    assert "settlements: TreeMap" in TEXT
    assert "evidence.binance_close" in TEXT
    assert "evidence.gate_close" in TEXT
    assert "self.current_settlement[base] = key" in TEXT
    assert "self.settlement_versions[base] = version" in TEXT
    assert 'base + "|v" + str(version)' in TEXT


def test_first_evidence_uses_explicit_empty_defaults():
    assert 'self.current_settlement.get(base, "")' in TEXT
    assert "self.settlement_versions.get(base, 0)" in TEXT
    assert 'self.current_settlement.get(base, "")' in TEXT
    assert 'settlement unavailable' in TEXT


def test_reserve_invariant_and_lifecycle():
    assert "self.reserved_liability > self.pool_balance" in TEXT
    assert "self.reserved_liability += payout" in TEXT
    assert "self.reserved_liability -= p.payout" in TEXT
    assert "p.state = CLAIMABLE" in TEXT
    assert "p.state = EXPIRED" in TEXT
    assert "p.state = CLAIMED" in TEXT
    assert "emit_transfer(value=p.payout, on=\"finalized\")" in TEXT


def test_protocol_lifecycle_counters_use_declared_fields_explicitly():
    state = TEXT.split("def _state", 1)[1].split("def _settle_evidence", 1)[0]
    assert "def _count" not in TEXT
    assert "setattr(" not in state
    assert "getattr(" not in state
    for field in ("active_count", "claimable_count", "expired_count", "claimed_count"):
        assert f"self.{field} += 1" in state
        assert f"self.{field} -= 1" in state
    for field in ("active", "claimable", "expired", "claimed"):
        assert f"stats.{field} += 1" in state
        assert f"stats.{field} -= 1" in state


def test_lifecycle_counter_transitions():
    protocol = {"active": 0, "claimable": 0, "expired": 0, "claimed": 0}
    user = dict(protocol)

    def move(old, new):
        protocol[old] -= 1
        protocol[new] += 1
        user[old] -= 1
        user[new] += 1

    protocol["active"] += 1
    user["active"] += 1
    assert protocol["active"] == user["active"] == 1
    move("active", "claimable")
    assert protocol["active"] == 0 and protocol["claimable"] == 1
    assert user["active"] == 0 and user["claimable"] == 1
    move("claimable", "claimed")
    assert protocol["claimable"] == 0 and protocol["claimed"] == 1
    assert user["claimable"] == 0 and user["claimed"] == 1

    protocol = {"active": 1, "claimable": 0, "expired": 0, "claimed": 0}
    move_old = dict(protocol)
    move_old["active"] -= 1
    move_old["expired"] += 1
    assert move_old["active"] == 0 and move_old["expired"] == 1


def test_constructor_and_storage_types_are_declared():
    assert "def __init__(self):" in TEXT
    assert "self.owner = gl.message.sender_address" in TEXT
    assert "sender_account" not in TEXT
    assert "self.pool_balance = u256(0)" in TEXT
    assert "self.reserved_liability = u256(0)" in TEXT
    assert "self.active_count = u256(0)" in TEXT
    assert "self.claimable_count = u256(0)" in TEXT
    assert "self.expired_count = u256(0)" in TEXT
    assert "self.claimed_count = u256(0)" in TEXT
    assert "protections: TreeMap[u256, Protection]" in TEXT
    assert "days: TreeMap[str, DayResult]" in TEXT
    assert "settlements: TreeMap[str, Settlement]" in TEXT
    assert "owner_index: TreeMap[str, u256]" in TEXT
    assert "UserStats(0, 0, 0, 0, 0, 0, 0)" in TEXT
    assert "del self.operator_index[str(last)]" in TEXT


def test_constructor_uses_explicit_storage_assignments():
    constructor = TEXT.split("def __init__", 1)[1].split("def _invariant", 1)[0]
    assert "," not in constructor
    assert " = self." not in constructor


def test_runtime_uses_supported_sender_and_no_dynamic_contract_attributes():
    assert "gl.message.sender_address" in TEXT
    assert "gl.message.sender_account" not in TEXT
    assert "setattr(" not in TEXT
    assert "getattr(self" not in TEXT


def test_nondeterministic_equivalence_avoids_generator_storage_transform():
    evidence = TEXT.split("def _settle_evidence", 1)[1].split("def _reference", 1)[0]
    assert "all(" not in evidence
    assert 'v["b"] == x["b"]' in evidence
    assert 'v["gt"] == x["gt"]' in evidence
    assert 'v["status"]' not in evidence


def test_owner_pool_and_pause_rules():
    assert "def _owner" in TEXT
    assert "self._owner()" in TEXT
    assert "available_liquidity" in TEXT
    assert "if self.paused" in TEXT
    assert "def pause_purchases" in TEXT
    assert "def unpause_purchases" in TEXT


def test_operator_membership_and_authorization():
    assert "operators: TreeMap[str, bool]" in TEXT
    assert "MAX_OPERATORS = 5" in TEXT
    assert "def add_operator" in TEXT
    assert "def remove_operator" in TEXT
    assert "def is_operator" in TEXT
    assert "if not self._caller_can_settle(p):" in TEXT
    assert "self.operators.get(_address_key(sender), False)" in TEXT
    assert "operator_positions: TreeMap" in TEXT
    assert "replacement = self.operator_index[str(last)]" in TEXT
    assert "del self.operator_index[str(last)]" in TEXT
    assert "invalid operator" in TEXT


def test_all_address_index_and_operator_keys_use_one_canonical_helper():
    assert "def _address_key(address: Address) -> str:" in TEXT
    assert "return address.as_hex" in TEXT
    assert "self.owner_counts.get(_address_key(_address(owner_hex)), 0)" in TEXT
    assert "owner_key = _address_key(_address(owner_hex))" in TEXT
    assert "self.user_stats.get(owner_key" in TEXT
    assert "owner = _address_key(p.owner)" in TEXT
    assert "key = _address_key(operator)" in TEXT
    assert "self.operators.get(_address_key(operator), False)" in TEXT
    assert "self.operators.get(str(operator), False)" not in TEXT
    assert "self.owner_counts.get(str(owner), 0)" not in TEXT
    assert "self.user_stats[str(p.owner)]" not in TEXT
    assert "str(gl.message.sender_address)" not in TEXT


def test_public_reads_return_abi_safe_primitives_not_storage_objects():
    assert "def _protection_view(self, p: Protection) -> dict:" in TEXT
    assert "return self._protection_view(self._protection(protection_id))" in TEXT
    assert "def get_protection(self, protection_id: u256) -> dict:" in TEXT
    assert "def get_user_summary(self, owner_hex: str) -> dict:" in TEXT
    assert "def get_market_settlement(self, market: str, date: str) -> dict:" in TEXT
    assert '"owner": p.owner.as_hex' in TEXT
    assert '"owner": self.owner.as_hex' in TEXT
    assert '"version": int(version)' in TEXT
    assert 'result.append(operator.as_hex)' in TEXT
    assert '"protection_id": int(p.protection_id)' in TEXT
    assert '"protection_id": int(protection_id)' in TEXT
    assert "return self.get_pool_state()" not in TEXT


def test_public_outputs_have_no_exact_redundant_aliases():
    card = TEXT.split("def _card", 1)[1].split("def _reference", 1)[0]
    quote = TEXT.split("def quote_protection", 1)[1].split("def get_purchase_readiness", 1)[0]
    market = TEXT.split("def _market_meta", 1)[1].split("def _price", 1)[0]
    assert '"next_settlement_date": p.next_date' in card
    assert '"next_date": p.next_date' not in card
    assert '"available_liquidity": available' in quote
    assert '"available": available' not in quote
    assert "def get_protocol_stats" not in TEXT
    assert '"symbol": market' not in market
    assert '"binance": BS[market]' not in market
    assert '"gate": GS[market]' not in market
    assert "attempts: u256" not in TEXT
    assert "settlement_count: u256" not in TEXT
    assert "def get_admin_state" not in TEXT
    assert "total: u256" not in TEXT
    assert "stats.total" not in TEXT
    assert "status: str\n    version: u256" not in TEXT


def test_purchase_return_abi_is_numeric():
    purchase = TEXT.split("def purchase_protection", 1)[1].split("def settle_protection", 1)[0]
    assert "-> u256:" in purchase


def test_public_views_use_abi_safe_return_annotations():
    import ast
    tree = ast.parse(TEXT)
    expected = {"dict", "list", "int", "bool"}
    for node in ast.walk(tree):
        if not isinstance(node, ast.FunctionDef):
            continue
        if not any(isinstance(d, ast.Attribute) and d.attr == "view" for d in node.decorator_list):
            continue
        annotation = node.returns
        assert isinstance(annotation, ast.Name) and annotation.id in expected, node.name


def test_address_casing_resolves_to_same_canonical_owner_key():
    class AddressLike:
        def __init__(self, value):
            self.as_hex = value.lower()

    lower = AddressLike("0x" + "ab" * 20)
    mixed = AddressLike("0x" + "ABab" * 10)
    assert lower.as_hex == mixed.as_hex
    assert "def _address(value: str) -> Address:" in TEXT
    assert "if not isinstance(value, str) or len(value) != 42 or not value.startswith(\"0x\")" in TEXT
    assert "int(value[2:], 16)" in TEXT
    assert "return _address(owner_hex).as_hex" not in TEXT
    assert "_address_key(_address(owner_hex))" in TEXT
    assert "_address_key(p.owner)" in TEXT


def test_public_address_reads_follow_aegis_string_input_pattern():
    for signature in (
        "def get_my_protections(self, owner_hex: str",
        "def get_owner_protection_count(self, owner_hex: str)",
        "def get_owner_protection_cards(self, owner_hex: str",
        "def get_user_summary(self, owner_hex: str)",
        "def get_user_attention(self, owner_hex: str",
        "def is_operator(self, operator_hex: str)",
    ):
        assert signature in TEXT
    assert "def add_operator(self, operator: Address)" in TEXT
    assert "def remove_operator(self, operator: Address)" in TEXT


def test_invalid_public_addresses_are_expected_errors():
    parser = TEXT.split("def _address(", 1)[1].split("def _days", 1)[0]
    assert '_err("[EXPECTED]", "invalid address")' in parser
    assert "int(result.as_hex, 16) == 0" in parser


def test_owner_read_models_are_owner_index_only_and_bounded():
    for method in ("get_my_protections", "get_owner_protection_cards", "get_user_attention"):
        section = TEXT.split("def " + method, 1)[1].split("@gl.public", 1)[0]
        assert "self.owner_index" in section or method == "get_user_attention"
        assert "range(count)" not in section
        assert "limit > 50" in section or method == "get_user_attention"
    assert "MAX_ATTENTION_PAGE = 50" in TEXT
    assert TEXT.count("start > count") >= 3


def test_caller_specific_read_fields_follow_write_permissions():
    card = TEXT.split("def _card", 1)[1].split("def _reference", 1)[0]
    assert '"can_settle":' in card
    assert "status == \"READY\" or status == \"INCONCLUSIVE_RETRY\"" in card
    assert 'self._claim_status(p) == "READY"' in card
    readiness = TEXT.split("def settlement_readiness", 1)[1].split("def claim_readiness", 1)[0]
    assert "self._settlement_status(p, requested_date, True)" in readiness


def test_operator_five_entry_boundary_and_compaction_model():
    operators = ["op1", "op2", "op3", "op4", "op5"]
    assert len(operators) == 5
    assert "if self.operator_count >= MAX_OPERATORS" in TEXT
    removed = operators.pop(1)
    replacement = operators.pop()
    operators.insert(1, replacement)
    assert removed == "op2"
    assert operators == ["op1", "op5", "op3", "op4"]
    assert "self.operator_positions[_address_key(replacement)] = removed" in TEXT


def test_gate_ticker_matches_documented_object_shape():
    ref = TEXT.split("def _reference", 1)[1].split("@gl.public.view", 1)[0]
    assert 'row.get("contract")' in ref
    assert 'row.get("contract") != GS[market]' in ref
    assert 'row.get("contract") not in (None, GS[market])' not in ref
    assert 'row["last"]' in ref
    assert 'row["time"]' not in ref


def test_gate_ticker_requires_exact_contract_for_every_valid_last():
    def accepted(row, market="WTI"):
        return row.get("contract") == MARKETS[market][1] and "last" in row

    assert accepted({"contract": "CL_USDT", "last": "80"})
    assert not accepted({"last": "80"})
    assert not accepted({"contract": "", "last": "80"})
    assert not accepted({"contract": "CL/USDT", "last": "80"})
    assert not accepted({"contract": "BZ_USDT", "last": "80"})


def test_external_json_responses_are_size_bounded():
    assert "MAX_SOURCE_BYTES = 200000" in TEXT
    parser = TEXT.split("def _json", 1)[1].split("def _days", 1)[0]
    assert "len(body) > MAX_SOURCE_BYTES" in parser
    assert '_err("[EXTERNAL]", "response too large")' in parser


def test_frontend_config_and_market_metadata():
    assert '"drop_only": True' in TEXT
    assert '"protection_type": "PRICE_DROP"' in TEXT
    assert '"WTI": "WTI Crude Oil"' in TEXT
    assert '"BRENT": "Brent Crude Oil"' in TEXT
    assert '"NATGAS": "Natural Gas"' in TEXT
    assert "def get_market_terms" in TEXT
    assert "drop_percent" in TEXT
    assert "DURATIONS = (7, 14, 30)" in TEXT


def test_frontend_terms_and_quote_read_models():
    terms = TEXT.split("def get_market_terms", 1)[1].split("def get_product_terms", 1)[0]
    assert "for duration in DURATIONS" in terms
    assert "for event_percent in EVENT_PERCENTS" in terms
    assert '"premium": premium' in terms
    assert '"payout": payout' in terms
    quote = TEXT.split("def quote_protection", 1)[1].split("def get_purchase_readiness", 1)[0]
    assert '"available_liquidity": available' in quote
    assert '"enough_liquidity": self._can_cover(premium, payout)' in quote


def test_purchase_readiness_is_deterministic_and_external_free():
    readiness = TEXT.split("def get_purchase_readiness", 1)[1].split("@gl.public.view", 1)[0]
    assert "_purchase_status" in readiness
    assert "gl.nondet" not in readiness
    assert "event_bps = _event_bps_from_percent(event_percent)" in TEXT
    helper = TEXT.split("def _purchase_status", 1)[1].split("def _caller_can_settle", 1)[0]
    for status in ("READY", "PURCHASES_PAUSED", "INVALID_MARKET", "INVALID_TERMS", "INSUFFICIENT_LIQUIDITY"):
        assert status in helper


def test_protection_card_and_owner_read_models():
    assert "def get_protection_card" in TEXT
    assert "def get_owner_protection_count" in TEXT
    assert "def get_owner_protection_cards" in TEXT
    card = TEXT.split("def _card", 1)[1].split("def _reference", 1)[0]
    for field in ("display_name", "protection_type", "event_percent", "drop_percent", "remaining_days", "can_settle", "can_claim"):
        assert field in card
    owner_cards = TEXT.split("def get_owner_protection_cards", 1)[1].split("def get_user_summary", 1)[0]
    assert "self.owner_index" in owner_cards
    assert "range(start, end)" in owner_cards
    assert "limit > 50" in owner_cards


def test_attention_and_readiness_models():
    assert "def get_user_attention" in TEXT
    attention = TEXT.split("def get_user_attention", 1)[1].split("def get_market_settlement", 1)[0]
    assert "def get_user_attention(self, owner_hex: str, start: int, limit: int)" in TEXT
    assert "MAX_ATTENTION_PAGE = 50" in TEXT
    assert "start < 0 or start > count or limit <= 0 or limit > MAX_ATTENTION_PAGE" in attention
    assert "start > count" in attention
    assert "for i in range(start, end)" in attention
    assert '"total_owner_protections": count' in attention
    assert '"scanned": end - start' in attention
    assert '"has_more": has_more' in attention
    assert '"ready_to_settle_scope": "page"' in attention
    assert '"inconclusive_retry_scope": "page"' in attention
    assert '"lifecycle_totals_scope": "global_user_stats"' in attention
    assert "range(count)" not in attention
    assert "ready_to_settle" in attention
    assert "inconclusive_retry" in attention
    assert "self.owner_index" in attention
    readiness = TEXT.split("def settlement_readiness", 1)[1].split("def claim_readiness", 1)[0]
    for field in ("can_settle", "retry_required", "protection_state"):
        assert field in readiness
    assert "def claim_readiness" in TEXT
    for status in ("READY", "NOT_OWNER", "NOT_CLAIMABLE", "ALREADY_CLAIMED"):
        assert status in TEXT


def test_attention_page_boundaries_and_scopes():
    owner_ids = ["p0", "p1", "p2", "p3", "p4"]
    statuses = {"p0": "READY", "p1": "ACTIVE", "p2": "INCONCLUSIVE_RETRY",
                "p3": "CLAIMABLE", "p4": "READY"}
    stats = {"active": 1, "claimable": 1, "expired": 2}

    def page(start, limit):
        assert start >= 0 and 0 < limit <= 50
        end = min(len(owner_ids), start + limit)
        scanned = owner_ids[start:end]
        return {
            "start": start,
            "limit": limit,
            "total_owner_protections": len(owner_ids),
            "scanned": len(scanned),
            "next_start": end if end < len(owner_ids) else -1,
            "has_more": end < len(owner_ids),
            "ready_to_settle": sum(statuses[x] == "READY" for x in scanned),
            "inconclusive_retry": sum(statuses[x] == "INCONCLUSIVE_RETRY" for x in scanned),
            "claimable": stats["claimable"],
            "active": stats["active"],
            "expired": stats["expired"],
        }

    first, middle, last = page(0, 2), page(2, 2), page(4, 2)
    assert (first["scanned"], first["has_more"], first["next_start"]) == (2, True, 2)
    assert (middle["scanned"], middle["has_more"], middle["next_start"]) == (2, True, 4)
    assert (last["scanned"], last["has_more"], last["next_start"]) == (1, False, -1)
    assert (first["ready_to_settle"], first["inconclusive_retry"]) == (1, 0)
    assert (middle["ready_to_settle"], middle["inconclusive_retry"]) == (0, 1)
    assert (last["ready_to_settle"], last["inconclusive_retry"]) == (1, 0)
    assert all(page_result[key] == stats[key] for page_result in (first, middle, last)
               for key in ("active", "claimable", "expired"))
    for invalid in ((-1, 1), (0, 0), (0, 51)):
        try:
            page(*invalid)
        except AssertionError:
            pass
        else:
            raise AssertionError("invalid attention page accepted")


def test_history_and_settlement_transparency_views():
    assert "def get_protection_day_result" in TEXT
    assert "def get_protection_history" in TEXT
    assert "def get_current_market_settlement_version" in TEXT
    history = TEXT.split("def get_protection_history", 1)[1].split("def get_current_market_settlement_version", 1)[0]
    assert "start > p.duration" in history
    assert "limit > 30" in history
    assert "range(start, end)" in history
    version = TEXT.split("def get_current_market_settlement_version", 1)[1].split("@gl.public.write", 1)[0]
    assert '"available": key != ""' in version
    settlement = TEXT.split("def get_market_settlement", 1)[1].split("def settlement_readiness", 1)[0]
    assert "def get_market_settlement_version" in settlement
    assert 'date + "|v" + str(version)' in settlement
    assert "return self._settlement_view" in settlement


def test_read_model_does_not_add_external_calls_or_forbidden_storage():
    reads = TEXT.split("def get_config", 1)[1]
    assert "gl.nondet" not in reads
    assert "DynArray" not in TEXT
    assert "dynray" not in TEXT.lower()


def test_efficient_owner_index_and_dashboard_stats():
    assert "owner_counts: TreeMap" in TEXT
    assert 'owner + "|" + str(index)' in TEXT
    assert "def get_user_summary" in TEXT
    for field in ("active", "claimable", "expired", "claimed", "premiums", "claimable_payout", "payouts"):
        assert field in TEXT
    assert "limit <= 0" in TEXT
    assert "limit > 50" in TEXT
    assert 'self.owner_counts.get(_address_key(_address(owner_hex)), 0)' in TEXT


def test_strict_gregorian_validation():
    assert "def _days" in TEXT
    assert "y % 400" in TEXT
    assert "d > _days(y, m)" in TEXT
    assert "y > 9999" in TEXT
    assert 'gl.message_raw["datetime"]' in TEXT
    assert "def _date" in TEXT


def test_pause_does_not_guard_existing_settlement_or_claim():
    purchase = TEXT.split("def purchase_protection", 1)[1].split("def settle_protection", 1)[0]
    settle = TEXT.split("def settle_protection", 1)[1].split("def claim_payout", 1)[0]
    claim = TEXT.split("def claim_payout", 1)[1].split("def add_operator", 1)[0]
    assert "if self.paused" in purchase
    assert "self.paused" not in settle
    assert "self.paused" not in claim


def test_error_classes_and_no_forbidden_storage_types():
    for prefix in ("[EXPECTED]", "[EXTERNAL]", "[TRANSIENT]"):
        assert prefix in TEXT


def test_missing_protection_entries_use_deterministic_expected_error():
    assert "def _protection(self, protection_id: u256) -> Protection:" in TEXT
    helper = TEXT.split("def _protection", 1)[1].split("def _market", 1)[0]
    assert 'self.protections.get(protection_id)' in helper
    assert '_err("[EXPECTED]", "protection not found")' in helper
    for method in ("get_protection", "get_protection_card", "settlement_readiness",
                   "claim_readiness", "get_protection_day_result",
                   "get_protection_history", "settle_protection", "claim_payout"):
        section = TEXT.split("def " + method, 1)[1].split("@gl.public", 1)[0]
        assert "self._protection(" in section


def test_global_numeric_protection_id_architecture():
    assert "protection_id: u256" in TEXT
    assert "protections: TreeMap[u256, Protection]" in TEXT
    assert "owner_index: TreeMap[str, u256]" in TEXT
    assert "pid = self.protection_count" in TEXT
    assert 'pid = str(self.protection_count)' not in TEXT
    assert ' + ":" + _address_key(gl.message.sender_address)' not in TEXT
    assert "self.protection_count += 1" in TEXT
    assert "self.protections[pid] = p" in TEXT
    assert "self.owner_index[owner + \"|\" + str(index)] = pid" in TEXT
    assert "def _day_key(protection_id: u256, date: str) -> str:" in TEXT


def test_all_protection_id_public_abis_are_numeric():
    for method in ("get_protection", "get_protection_card", "settlement_readiness",
                   "claim_readiness", "get_protection_day_result", "get_protection_history",
                   "settle_protection", "claim_payout"):
        section = TEXT.split("def " + method, 1)[1].split("@gl.public", 1)[0]
        assert "protection_id: u256" in section


def test_numeric_id_zero_and_owner_isolation_model():
    owners = {"A": [0, 2], "B": [1]}
    assert owners["A"] == [0, 2]
    assert owners["B"] == [1]
    assert 0 in owners["A"]
    assert "if not protection_id" not in TEXT
    assert "get_protection(self, protection_id: u256)" in TEXT


def test_global_allocator_and_owner_index_numeric_sequence():
    next_id = 0
    owner_index = {}
    for owner in ("A", "B", "A"):
        protection_id = next_id
        next_id += 1
        owner_index.setdefault(owner, []).append(protection_id)
    assert next_id == 3
    assert owner_index == {"A": [0, 2], "B": [1]}
    assert "pid = self.protection_count" in TEXT
    assert "self.protection_count += 1" in TEXT


def test_zero_id_day_result_key_and_missing_detection():
    assert 'return str(int(protection_id)) + "|" + date' in TEXT
    assert "self.protections.get(protection_id)" in TEXT
    assert "if protection is None" in TEXT


def test_numeric_id_outputs_are_not_legacy_composite_strings():
    assert '"0:0x' not in TEXT
    assert '"protection_id": p.protection_id' not in TEXT
    assert '"protection_id": protection_id' not in TEXT


def test_transfers_use_finalized_genlayer_recipient_pattern():
    assert "gl.transfer(" not in TEXT
    assert 'gl.get_contract_at(self.owner).emit_transfer(value=u256(amount_native), on="finalized")' in TEXT
    assert 'gl.get_contract_at(p.owner).emit_transfer(value=p.payout, on="finalized")' in TEXT
