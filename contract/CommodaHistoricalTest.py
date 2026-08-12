# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
from dataclasses import dataclass
from typing import Any, NoReturn

# TEST-ONLY HISTORICAL CONSENSUS CONTRACT. NOT FOR PRODUCTION DEPLOYMENT.
# Only purchase dates differ; settlement remains the production path.

SCALE = 100000000
GEN = 1000000000000000000
DAY = 86400
PURCHASE_EQ_BPS = 5
MAX_OPERATORS = 5
MAX_ATTENTION_PAGE = 50
MAX_SOURCE_BYTES = 200000
ACTIVE, CLAIMABLE, EXPIRED, CLAIMED = "ACTIVE", "CLAIMABLE", "EXPIRED", "CLAIMED"
UNPROCESSED, BREACHED, NOT_BREACHED, INCONCLUSIVE = "UNPROCESSED", "BREACHED", "NOT_BREACHED", "INCONCLUSIVE"
MARKETS = ("WTI", "BRENT", "NATGAS")
BS = {"WTI": "CLUSDT", "BRENT": "BZUSDT", "NATGAS": "NATGASUSDT"}
GS = {"WTI": "CL_USDT", "BRENT": "BZ_USDT", "NATGAS": "NG_USDT"}
NAMES = {"WTI": "WTI Crude Oil", "BRENT": "Brent Crude Oil", "NATGAS": "Natural Gas"}
EVENT_PERCENTS = (1, 2, 3)
DURATIONS = (7, 14, 30)
DROP_LABELS = {1: "1%", 2: "2%", 3: "3%"}
TERMS = {
    (7, 100): (GEN, 2 * GEN), (7, 200): (GEN, 3 * GEN), (7, 300): (GEN, 4 * GEN),
    (14, 100): (2 * GEN, 4 * GEN), (14, 200): (2 * GEN, 5 * GEN), (14, 300): (2 * GEN, 6 * GEN),
    (30, 100): (3 * GEN, 6 * GEN), (30, 200): (3 * GEN, 8 * GEN), (30, 300): (3 * GEN, 10 * GEN),
}

@allow_storage
@dataclass
class Protection:
    protection_id: u256
    owner: Address
    market: str
    event_percent: u256
    duration: u256
    reference_price: u256
    trigger_price: u256
    premium: u256
    payout: u256
    purchase_date: str
    next_date: str
    settled_days: u256
    state: str
    breach_date: str
    created_at: str
    last_result: str

@allow_storage
@dataclass
class DayResult:
    status: str
    evidence_version: u256
    updated_at: str

@allow_storage
@dataclass
class Settlement:
    binance_close: u256
    gate_close: u256
    binance_timestamp: u256
    gate_timestamp: u256
    version: u256
    created_at: str

@allow_storage
@dataclass
class UserStats:
    active: u256
    claimable: u256
    expired: u256
    claimed: u256
    premiums: u256
    claimable_payout: u256
    payouts: u256

def _err(kind: str, msg: str) -> NoReturn:
    raise gl.vm.UserError(kind + " " + msg)

def _address_key(address: Address) -> str:
    return address.as_hex

def _address(value: str) -> Address:
    if not isinstance(value, str) or len(value) != 42 or not value.startswith("0x"):
        _err("[EXPECTED]", "invalid address")
    try:
        int(value[2:], 16)
        result = Address(value)
    except Exception:
        _err("[EXPECTED]", "invalid address")
    if int(result.as_hex, 16) == 0:
        _err("[EXPECTED]", "invalid address")
    return result

def _day_key(protection_id: u256, date: str) -> str:
    return str(int(protection_id)) + "|" + date

def _json(res) -> Any:
    body = getattr(res, "body", None)
    if body is None:
        _err("[EXTERNAL]", "empty response")
    if len(body) > MAX_SOURCE_BYTES:
        _err("[EXTERNAL]", "response too large")
    return json.loads(body.decode("utf-8"))

def _days(y: int, m: int) -> int:
    leap = y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)
    return (31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)[m - 1]

def _day_number(y: int, m: int, d: int) -> int:
    y -= m <= 2
    era, yoe = y // 400, y - (y // 400) * 400
    mp = m + (-3 if m > 2 else 9)
    return era * 146097 + yoe * 365 + yoe // 4 - yoe // 100 + (153 * mp + 2) // 5 + d - 1 - 719468

def _date_parts(date: str):
    if len(date) != 10 or date[4] != "-" or date[7] != "-":
        _err("[EXPECTED]", "invalid date")
    try:
        y, m, d = int(date[:4]), int(date[5:7]), int(date[8:10])
    except Exception:
        _err("[EXPECTED]", "invalid date")
    if y < 1970 or y > 9999 or m < 1 or m > 12 or d < 1 or d > _days(y, m):
        _err("[EXPECTED]", "invalid date")
    return y, m, d, _day_number(y, m, d)

def _date(n: int) -> str:
    z = n + 719468
    era, doe = z // 146097, z - (z // 146097) * 146097
    yoe = (doe - doe // 1460 + doe // 36524 - doe // 146096) // 365
    y, doy = yoe + era * 400, doe - (365 * yoe + yoe // 4 - yoe // 100)
    mp = (5 * doy + 2) // 153
    d, m = doy - (153 * mp + 2) // 5 + 1, mp + (3 if mp < 10 else -9)
    return "%04d-%02d-%02d" % (y + (m <= 2), m, d)

def _now() -> str:
    return str(gl.message_raw["datetime"])

def _today() -> str:
    return _now()[:10]

def _epoch(date: str) -> int:
    return _date_parts(date)[3] * DAY

def _event_bps_from_percent(event_percent: int) -> int:
    if event_percent not in EVENT_PERCENTS:
        _err("[EXPECTED]", "invalid event percent")
    return event_percent * 100

def _drop_label(event_percent: int) -> str:
    return DROP_LABELS[event_percent]

def _market_meta(market: str) -> dict:
    return {"market": market, "display_name": NAMES[market],
            "category": "COMMODITY", "protection_type": "PRICE_DROP",
            "drop_only": True, "event_percent": list(EVENT_PERCENTS),
            "durations": list(DURATIONS),
            "binance_settlement_symbol": BS[market], "gate_settlement_symbol": GS[market],
            "gate_reference_symbol": GS[market]}

def _price(raw) -> int:
    s = str(raw).strip()
    q = s.split(".")
    if not s or s.startswith("-") or "e" in s.lower() or len(q) > 2 or not q[0].isdigit() or (len(q) == 2 and not q[1].isdigit()):
        _err("[EXTERNAL]", "invalid price")
    if len(q) == 2 and len(q[1]) > 8 and any(x != "0" for x in q[1][8:]):
        _err("[EXTERNAL]", "price precision")
    value = int(q[0]) * SCALE + int((q[1] if len(q) == 2 else "")[:8].ljust(8, "0"))
    if value <= 0 or value > 100000000000000000000:
        _err("[EXTERNAL]", "impossible price")
    return value

def _source(res, name: str):
    if res.status >= 500:
        _err("[TRANSIENT]", name + " unavailable")
    if res.status != 200:
        _err("[EXTERNAL]", name + " http error")
    return _json(res)

def _binance(market: str, date: str):
    start = _epoch(date) * 1000
    url = "https://fapi.binance.com/fapi/v1/klines?symbol=" + BS[market] + "&interval=1d&startTime=" + str(start) + "&endTime=" + str(start + DAY * 1000) + "&limit=1"
    try:
        row = _source(gl.nondet.web.get(url), "Binance")[0]
        opened, close, closed = int(row[0]), _price(row[4]), int(row[6])
        if opened != start or closed != start + DAY * 1000 - 1:
            _err("[EXTERNAL]", "Binance wrong candle")
        return close, opened
    except gl.vm.UserError:
        raise
    except Exception:
        _err("[EXTERNAL]", "malformed Binance")

def _gate(market: str, date: str):
    start = _epoch(date)
    url = "https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract=" + GS[market] + "&interval=1d&from=" + str(start) + "&to=" + str(start + DAY)
    try:
        rows, found = _source(gl.nondet.web.get(url), "Gate"), None
        for row in rows:
            if int(row[0] if isinstance(row, list) else row["t"]) == start:
                found = row
                break
        if found is None:
            _err("[EXTERNAL]", "Gate candle missing")
        return _price(found[2] if isinstance(found, list) else found["c"]), start
    except gl.vm.UserError:
        raise
    except Exception:
        _err("[EXTERNAL]", "malformed Gate")

def _historical(market: str, date: str) -> dict:
    b, bt = _binance(market, date)
    g, gt = _gate(market, date)
    return {"b": b, "g": g, "bt": bt, "gt": gt}

def _same_error(result, fn) -> bool:
    leader = getattr(result, "message", "")
    try:
        fn()
        return False
    except gl.vm.UserError as exc:
        other = getattr(exc, "message", str(exc))
        if other.startswith("[EXPECTED]") or other.startswith("[EXTERNAL]"):
            return other == leader
        return other.startswith("[TRANSIENT]") and leader.startswith("[TRANSIENT]")
    except Exception:
        return False

class CommodaHistoricalTest(gl.Contract):
    owner: Address
    paused: bool
    pool_balance: u256
    reserved_liability: u256
    protection_count: u256
    active_count: u256
    claimable_count: u256
    expired_count: u256
    claimed_count: u256
    premiums_collected: u256
    payouts_paid: u256
    protections: TreeMap[u256, Protection]
    days: TreeMap[str, DayResult]
    settlements: TreeMap[str, Settlement]
    current_settlement: TreeMap[str, str]
    settlement_versions: TreeMap[str, u256]
    owner_index: TreeMap[str, u256]
    owner_counts: TreeMap[str, u256]
    user_stats: TreeMap[str, UserStats]
    operators: TreeMap[str, bool]
    operator_index: TreeMap[str, Address]
    operator_positions: TreeMap[str, u256]
    operator_count: u256

    def __init__(self):
        self.owner = gl.message.sender_address
        self.paused = False
        self.pool_balance = u256(0)
        self.reserved_liability = u256(0)
        self.protection_count = u256(0)
        self.active_count = u256(0)
        self.claimable_count = u256(0)
        self.expired_count = u256(0)
        self.claimed_count = u256(0)
        self.premiums_collected = u256(0)
        self.payouts_paid = u256(0)
        self.operator_count = u256(0)

    def _invariant(self):
        if self.reserved_liability > self.pool_balance:
            _err("[EXPECTED]", "reserve exceeds pool")

    def _owner(self):
        if gl.message.sender_address != self.owner:
            _err("[EXPECTED]", "unauthorized")

    def _authorized(self, p: Protection):
        if not self._caller_can_settle(p):
            _err("[EXPECTED]", "unauthorized")

    def _protection(self, protection_id: u256) -> Protection:
        protection = self.protections.get(protection_id)
        if protection is None:
            _err("[EXPECTED]", "protection not found")
        return protection

    def _market(self, market: str):
        if market not in MARKETS:
            _err("[EXPECTED]", "invalid market")

    def _terms(self, market: str, duration: int, event_percent: int):
        self._market(market)
        event_bps = _event_bps_from_percent(event_percent)
        if (duration, event_bps) not in TERMS:
            _err("[EXPECTED]", "invalid terms")
        return TERMS[(duration, event_bps)]

    def _state(self, p: Protection, old: str, new: str):
        if old == new:
            return
        if old == ACTIVE:
            self.active_count -= 1
        elif old == CLAIMABLE:
            self.claimable_count -= 1
        elif old == EXPIRED:
            self.expired_count -= 1
        elif old == CLAIMED:
            self.claimed_count -= 1
        if new == ACTIVE:
            self.active_count += 1
        elif new == CLAIMABLE:
            self.claimable_count += 1
        elif new == EXPIRED:
            self.expired_count += 1
        elif new == CLAIMED:
            self.claimed_count += 1
        key, stats = _address_key(p.owner), self.user_stats[_address_key(p.owner)]
        if old == ACTIVE:
            stats.active -= 1
        elif old == CLAIMABLE:
            stats.claimable -= 1
        elif old == EXPIRED:
            stats.expired -= 1
        elif old == CLAIMED:
            stats.claimed -= 1
        if new == ACTIVE:
            stats.active += 1
        elif new == CLAIMABLE:
            stats.claimable += 1
        elif new == EXPIRED:
            stats.expired += 1
        elif new == CLAIMED:
            stats.claimed += 1
        self.user_stats[key] = stats

    def _settle_evidence(self, market: str, date: str, refresh: bool) -> Settlement:
        base = market + "|" + date
        current = self.current_settlement.get(base, "")
        if current != "" and not refresh:
            return self.settlements[current]
        def fetch() -> dict:
            return _historical(market, date)
        def verify(result):
            if not isinstance(result, gl.vm.Return):
                return _same_error(result, fetch)
            try:
                v, x = fetch(), result.calldata
                return (v["b"] == x["b"] and v["g"] == x["g"] and
                        v["bt"] == x["bt"] and v["gt"] == x["gt"])
            except Exception:
                return False
        result: dict = gl.vm.run_nondet_unsafe(fetch, verify)
        version = self.settlement_versions.get(base, 0) + 1
        key = base + "|v" + str(version)
        self.settlements[key] = Settlement(result["b"], result["g"], result["bt"], result["gt"], version, _now())
        self.current_settlement[base] = key
        self.settlement_versions[base] = version
        return self.settlements[key]

    def _available(self) -> int:
        return self.pool_balance - self.reserved_liability

    def _can_cover(self, premium: int, payout: int) -> bool:
        return self._available() + premium >= payout

    def _purchase_status(self, market: str, duration: int, event_percent: int) -> dict:
        available = self._available()
        if self.paused:
            status = "PURCHASES_PAUSED"
            premium, payout = 0, 0
        elif market not in MARKETS:
            status = "INVALID_MARKET"
            premium, payout = 0, 0
        elif event_percent not in EVENT_PERCENTS:
            status = "INVALID_TERMS"
            premium, payout = 0, 0
        else:
            event_bps = _event_bps_from_percent(event_percent)
            if (duration, event_bps) not in TERMS:
                status = "INVALID_TERMS"
                premium, payout = 0, 0
            else:
                premium, payout = TERMS[(duration, event_bps)]
                status = "READY" if self._can_cover(premium, payout) else "INSUFFICIENT_LIQUIDITY"
        return {"status": status, "can_purchase": status == "READY", "market": market,
                "duration": duration, "event_percent": event_percent, "drop_percent": DROP_LABELS.get(event_percent, ""),
                "premium": premium,
                "payout": payout, "available_liquidity": available}

    def _caller_can_settle(self, p: Protection) -> bool:
        sender = gl.message.sender_address
        return sender == p.owner or sender == self.owner or self.operators.get(_address_key(sender), False)

    def _settlement_status(self, p: Protection, requested_date: str, check_auth: bool) -> str:
        if check_auth and not self._caller_can_settle(p):
            return "UNAUTHORIZED"
        if p.state == CLAIMABLE:
            return "CLAIMABLE"
        if p.state == EXPIRED:
            return "EXPIRED"
        if p.state == CLAIMED:
            return "PROTECTION_NOT_ACTIVE"
        if requested_date != "" and requested_date != p.next_date:
            return "SETTLEMENT_ORDER"
        if p.next_date >= _today():
            return "SETTLEMENT_DAY_NOT_COMPLETE"
        if self.days.get(_day_key(p.protection_id, p.next_date), DayResult(UNPROCESSED, 0, "")).status == INCONCLUSIVE:
            return "INCONCLUSIVE_RETRY"
        return "READY"

    def _claim_status(self, p: Protection) -> str:
        if gl.message.sender_address != p.owner:
            return "NOT_OWNER"
        if p.state == CLAIMABLE:
            return "READY"
        if p.state == CLAIMED:
            return "ALREADY_CLAIMED"
        return "NOT_CLAIMABLE"

    def _day_view(self, protection_id: u256, date: str) -> dict:
        result = self.days.get(_day_key(protection_id, date), DayResult(UNPROCESSED, 0, ""))
        return {"protection_id": int(protection_id), "date": date, "status": result.status,
                "evidence_version": int(result.evidence_version), "updated_at": result.updated_at}

    def _settlement_view(self, key: str, market: str, date: str) -> dict:
        settlement = self.settlements.get(key)
        if settlement is None:
            _err("[EXPECTED]", "settlement unavailable")
        return {"key": key, "market": market, "date": date,
                "binance_close": int(settlement.binance_close), "gate_close": int(settlement.gate_close),
                "binance_timestamp": int(settlement.binance_timestamp),
                "gate_timestamp": int(settlement.gate_timestamp), "version": int(settlement.version),
                "created_at": settlement.created_at}

    def _protection_view(self, p: Protection) -> dict:
        return {"protection_id": int(p.protection_id), "owner": p.owner.as_hex,
                "market": p.market, "event_percent": int(p.event_percent),
                "duration": int(p.duration), "reference_price": int(p.reference_price),
                "trigger_price": int(p.trigger_price), "premium": int(p.premium),
                "payout": int(p.payout), "purchase_date": p.purchase_date,
                "next_date": p.next_date, "settled_days": int(p.settled_days),
                "state": p.state, "breach_date": p.breach_date,
                "created_at": p.created_at, "last_result": p.last_result}

    def _card(self, p: Protection) -> dict:
        status = self._settlement_status(p, "", True)
        remaining = p.duration - p.settled_days if p.state == ACTIVE and p.duration > p.settled_days else 0
        return {"protection_id": int(p.protection_id), "owner": p.owner.as_hex, "market": p.market,
                "display_name": NAMES[p.market], "protection_type": "PRICE_DROP",
                "drop_only": True, "state": p.state, "duration": int(p.duration),
                "event_percent": int(p.event_percent), "drop_percent": _drop_label(int(p.event_percent)),
                "reference_price": int(p.reference_price), "trigger_price": int(p.trigger_price),
                "premium": int(p.premium), "payout": int(p.payout), "purchase_date": p.purchase_date,
                "next_settlement_date": p.next_date,
                "settled_days": int(p.settled_days), "remaining_days": int(remaining),
                "breach_date": p.breach_date, "last_result": p.last_result,
                "claimable": p.state == CLAIMABLE,
                "can_settle": status == "READY" or status == "INCONCLUSIVE_RETRY",
                "can_claim": self._claim_status(p) == "READY"}

    def _reference(self, market: str) -> dict:
        def fetch() -> dict:
            try:
                res = gl.nondet.web.get("https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=" + GS[market])
                rows = _source(res, "Gate")
                row = rows[0]
                if row.get("contract") != GS[market]:
                    _err("[EXTERNAL]", "wrong Gate market")
                return {"price": _price(row["last"])}
            except gl.vm.UserError:
                raise
            except Exception:
                _err("[EXTERNAL]", "malformed Gate reference")
        def verify(result):
            if not isinstance(result, gl.vm.Return):
                return _same_error(result, fetch)
            try:
                v, x = fetch(), result.calldata
                a, b = v["price"], x["price"]
                return abs(a - b) * 10000 <= min(a, b) * PURCHASE_EQ_BPS
            except Exception:
                return False
        return gl.vm.run_nondet_unsafe(fetch, verify)

    @gl.public.view
    def get_config(self) -> dict:
        return {"name": "CommodaHistoricalTest", "category": "COMMODITY", "drop_only": True,
                "protection_type": "PRICE_DROP", "price_scale": SCALE, "gen": GEN,
                "purchase_equivalence_bps": PURCHASE_EQ_BPS,
                "purchase_timestamp_source": "transaction", "historical_test_mode": True,
                "paused": self.paused,
                "owner": self.owner.as_hex}

    @gl.public.view
    def get_supported_markets(self) -> list:
        return list(MARKETS)

    @gl.public.view
    def get_market(self, market: str) -> dict:
        self._market(market)
        return _market_meta(market)

    @gl.public.view
    def get_market_terms(self, market: str) -> list:
        self._market(market)
        result = []
        for duration in DURATIONS:
            for event_percent in EVENT_PERCENTS:
                event_bps = event_percent * 100
                premium, payout = TERMS[(duration, event_bps)]
                result.append({"market": market, "duration": duration, "event_percent": event_percent,
                               "drop_percent": _drop_label(event_percent), "premium": premium,
                               "payout": payout})
        return result

    @gl.public.view
    def get_product_terms(self, market: str, duration: int, event_percent: int) -> dict:
        premium, payout = self._terms(market, duration, event_percent)
        return {"market": market, "duration": duration, "event_percent": event_percent,
                "drop_percent": _drop_label(event_percent),
                "premium": premium, "payout": payout}

    @gl.public.view
    def preview_trigger(self, reference_price: int, event_percent: int) -> int:
        if reference_price <= 0:
            _err("[EXPECTED]", "invalid trigger")
        event_bps = _event_bps_from_percent(event_percent)
        return reference_price * (10000 - event_bps) // 10000

    @gl.public.view
    def quote_protection(self, market: str, duration: int, event_percent: int) -> dict:
        premium, payout = self._terms(market, duration, event_percent)
        available = self._available()
        return {"market": market, "duration": duration, "event_percent": event_percent,
                "drop_percent": _drop_label(event_percent), "premium": premium, "payout": payout,
                "available_liquidity": available,
                "enough_liquidity": self._can_cover(premium, payout)}

    @gl.public.view
    def get_purchase_readiness(self, market: str, duration: int, event_percent: int) -> dict:
        return self._purchase_status(market, duration, event_percent)

    @gl.public.view
    def get_pool_state(self) -> dict:
        return self._pool_state()

    def _pool_state(self) -> dict:
        return {"pool_balance": int(self.pool_balance), "reserved_liability": int(self.reserved_liability),
                "available_liquidity": int(self.pool_balance - self.reserved_liability),
                "protections": int(self.protection_count), "active": int(self.active_count),
                "claimable": int(self.claimable_count), "expired": int(self.expired_count),
                "claimed": int(self.claimed_count), "premiums": int(self.premiums_collected),
                "payouts_paid": int(self.payouts_paid), "paused": self.paused}

    @gl.public.view
    def get_protection(self, protection_id: u256) -> dict:
        return self._protection_view(self._protection(protection_id))

    @gl.public.view
    def get_protection_card(self, protection_id: u256) -> dict:
        return self._card(self._protection(protection_id))

    @gl.public.view
    def get_my_protections(self, owner_hex: str, start: int = 0, limit: int = 50) -> list:
        owner_key = _address_key(_address(owner_hex))
        count = self.owner_counts.get(owner_key, 0)
        if start < 0 or start > count or limit <= 0 or limit > 50:
            _err("[EXPECTED]", "invalid pagination")
        end = min(count, start + limit)
        result = []
        for i in range(start, end):
            protection_id = self.owner_index.get(owner_key + "|" + str(i))
            if protection_id is not None:
                result.append(int(protection_id))
        return result

    @gl.public.view
    def get_owner_protection_count(self, owner_hex: str) -> int:
        return int(self.owner_counts.get(_address_key(_address(owner_hex)), 0))

    @gl.public.view
    def get_owner_protection_cards(self, owner_hex: str, start: int, limit: int) -> list:
        owner_key = _address_key(_address(owner_hex))
        count = self.owner_counts.get(owner_key, 0)
        if start < 0 or start > count or limit <= 0 or limit > 50:
            _err("[EXPECTED]", "invalid pagination")
        end = min(count, start + limit)
        result = []
        for i in range(start, end):
            protection_id = self.owner_index.get(owner_key + "|" + str(i))
            if protection_id is not None:
                result.append(self._card(self._protection(protection_id)))
        return result

    @gl.public.view
    def get_user_summary(self, owner_hex: str) -> dict:
        owner_key = _address_key(_address(owner_hex))
        stats = self.user_stats.get(owner_key, UserStats(0, 0, 0, 0, 0, 0, 0))
        return {"total": int(self.owner_counts.get(owner_key, 0)), "active": int(stats.active),
                "claimable": int(stats.claimable), "expired": int(stats.expired),
                "claimed": int(stats.claimed), "premiums": int(stats.premiums),
                "claimable_payout": int(stats.claimable_payout), "payouts": int(stats.payouts)}

    @gl.public.view
    def get_user_attention(self, owner_hex: str, start: int, limit: int) -> dict:
        owner_key = _address_key(_address(owner_hex))
        count = int(self.owner_counts.get(owner_key, 0))
        if start < 0 or start > count or limit <= 0 or limit > MAX_ATTENTION_PAGE:
            _err("[EXPECTED]", "invalid attention pagination")
        end = min(count, start + limit)
        ready, retry = 0, 0
        for i in range(start, end):
            protection_id = self.owner_index.get(owner_key + "|" + str(i))
            if protection_id is None:
                continue
            p = self._protection(protection_id)
            status = self._settlement_status(p, "", False)
            if status == "READY":
                ready += 1
            elif status == "INCONCLUSIVE_RETRY":
                retry += 1
        stats = self.user_stats.get(owner_key, UserStats(0, 0, 0, 0, 0, 0, 0))
        has_more = end < count
        return {"start": start, "limit": limit, "total_owner_protections": count,
                "scanned": end - start, "next_start": end if has_more else -1,
                "has_more": has_more, "ready_to_settle": ready,
                "inconclusive_retry": retry,
                "ready_to_settle_scope": "page",
                "inconclusive_retry_scope": "page",
                "lifecycle_totals_scope": "global_user_stats",
                "claimable": int(stats.claimable), "active": int(stats.active), "expired": int(stats.expired)}

    @gl.public.view
    def get_market_settlement(self, market: str, date: str) -> dict:
        self._market(market)
        _date_parts(date)
        base = market + "|" + date
        key = self.current_settlement.get(base, "")
        if key == "":
            _err("[EXPECTED]", "settlement unavailable")
        return self._settlement_view(key, market, date)

    @gl.public.view
    def get_market_settlement_version(self, market: str, date: str, version: int) -> dict:
        self._market(market)
        _date_parts(date)
        if version <= 0:
            _err("[EXPECTED]", "invalid settlement version")
        return self._settlement_view(market + "|" + date + "|v" + str(version), market, date)

    @gl.public.view
    def settlement_readiness(self, protection_id: u256, requested_date: str = "") -> dict:
        p = self._protection(protection_id)
        if requested_date != "":
            _date_parts(requested_date)
        reason = self._settlement_status(p, requested_date, True)
        return {"protection_id": int(protection_id), "date": p.next_date, "status": reason,
                "can_settle": reason == "READY" or reason == "INCONCLUSIVE_RETRY",
                "retry_required": reason == "INCONCLUSIVE_RETRY", "protection_state": p.state}

    @gl.public.view
    def claim_readiness(self, protection_id: u256) -> dict:
        p = self._protection(protection_id)
        status = self._claim_status(p)
        return {"protection_id": int(protection_id), "state": p.state, "status": status,
                "can_claim": status == "READY"}

    @gl.public.view
    def get_protection_day_result(self, protection_id: u256, date: str) -> dict:
        p = self._protection(protection_id)
        _date_parts(date)
        first = _date_parts(p.purchase_date)[3] + 1
        target = _date_parts(date)[3]
        if target < first or target >= first + p.duration:
            _err("[EXPECTED]", "date outside protection")
        return self._day_view(protection_id, date)

    @gl.public.view
    def get_protection_history(self, protection_id: u256, start: int, limit: int) -> list:
        p = self._protection(protection_id)
        if start < 0 or start > p.duration or limit <= 0 or limit > 30:
            _err("[EXPECTED]", "invalid pagination")
        end = min(p.duration, start + limit)
        first = _date_parts(p.purchase_date)[3] + 1
        result = []
        for i in range(start, end):
            result.append(self._day_view(protection_id, _date(first + i)))
        return result

    @gl.public.view
    def get_current_market_settlement_version(self, market: str, date: str) -> dict:
        self._market(market)
        _date_parts(date)
        base = market + "|" + date
        key = self.current_settlement.get(base, "")
        version = self.settlement_versions.get(base, 0)
        return {"market": market, "date": date, "version": int(version),
                "evidence_key": key, "available": key != ""}

    @gl.public.write.payable
    def add_pool_funds(self) -> None:
        self._owner()
        if gl.message.value <= 0:
            _err("[EXPECTED]", "invalid pool amount")
        self.pool_balance += gl.message.value
        self._invariant()

    @gl.public.write
    def withdraw_unreserved_gen(self, amount_gen: int) -> None:
        self._owner()
        if amount_gen <= 0 or amount_gen > (2**256 - 1) // GEN:
            _err("[EXPECTED]", "invalid withdrawal amount")
        amount_native = amount_gen * GEN
        if amount_native > self.pool_balance - self.reserved_liability:
            _err("[EXPECTED]", "insufficient unreserved liquidity")
        self.pool_balance -= amount_native
        self._invariant()
        gl.get_contract_at(self.owner).emit_transfer(value=u256(amount_native), on="finalized")

    @gl.public.write.payable
    def purchase_protection(self, market: str, duration: int, event_percent: int) -> u256:
        if self.paused:
            _err("[EXPECTED]", "purchases paused")
        event_bps = _event_bps_from_percent(event_percent)
        premium, payout = self._terms(market, duration, event_percent)
        if gl.message.value != premium:
            _err("[EXPECTED]", "invalid premium")
        if not self._can_cover(premium, payout):
            _err("[EXPECTED]", "insufficient liquidity")
        ref = self._reference(market)
        today, now = _today(), _now()
        pid = self.protection_count
        p = Protection(pid, gl.message.sender_address, market, event_percent, duration, ref["price"], ref["price"] * (10000 - event_bps) // 10000, premium, payout, today, _date(_date_parts(today)[3] + 1), 0, ACTIVE, "", now, UNPROCESSED)
        self.protections[pid] = p
        owner = _address_key(p.owner)
        index = self.owner_counts.get(owner, 0)
        self.owner_index[owner + "|" + str(index)] = pid
        self.owner_counts[owner] = index + 1
        if index == 0:
            self.user_stats[owner] = UserStats(0, 0, 0, 0, 0, 0, 0)
        self.days[_day_key(pid, p.next_date)] = DayResult(UNPROCESSED, 0, now)
        self.protection_count += 1
        self.pool_balance += premium
        self.reserved_liability += payout
        self.premiums_collected += premium
        self._state(p, "", ACTIVE)
        stats = self.user_stats[owner]
        stats.premiums += premium
        self.user_stats[owner] = stats
        self._invariant()
        return pid

    @gl.public.write.payable
    def purchase_historical_protection(self, market: str, duration: int, event_percent: int,
                                       historical_purchase_date: str) -> u256:
        if self.paused:
            _err("[EXPECTED]", "purchases paused")
        event_bps = _event_bps_from_percent(event_percent)
        premium, payout = self._terms(market, duration, event_percent)
        if gl.message.value != premium:
            _err("[EXPECTED]", "invalid premium")
        if not self._can_cover(premium, payout):
            _err("[EXPECTED]", "insufficient liquidity")
        purchase_number = _date_parts(historical_purchase_date)[3]
        today_number = _date_parts(_today())[3]
        if historical_purchase_date >= _today():
            _err("[EXPECTED]", "historical purchase date must be in the past")
        if purchase_number + duration >= today_number:
            _err("[EXPECTED]", "historical window incomplete")
        # TEST-ONLY: preserve the production Gate reference architecture. The
        # historical date override exists only to make next_date settleable.
        ref = self._reference(market)
        now = _now()
        pid = self.protection_count
        next_date = _date(purchase_number + 1)
        p = Protection(pid, gl.message.sender_address, market, event_percent, duration,
                       ref["price"], ref["price"] * (10000 - event_bps) // 10000,
                       premium, payout, historical_purchase_date, next_date, 0,
                       ACTIVE, "", now, UNPROCESSED)
        self.protections[pid] = p
        owner = _address_key(p.owner)
        index = self.owner_counts.get(owner, 0)
        self.owner_index[owner + "|" + str(index)] = pid
        self.owner_counts[owner] = index + 1
        if index == 0:
            self.user_stats[owner] = UserStats(0, 0, 0, 0, 0, 0, 0)
        self.days[_day_key(pid, p.next_date)] = DayResult(UNPROCESSED, 0, now)
        self.protection_count += 1
        self.pool_balance += premium
        self.reserved_liability += payout
        self.premiums_collected += premium
        self._state(p, "", ACTIVE)
        stats = self.user_stats[owner]
        stats.premiums += premium
        self.user_stats[owner] = stats
        self._invariant()
        return pid

    @gl.public.write
    def settle_protection(self, protection_id: u256) -> str:
        p = self._protection(protection_id)
        self._authorized(p)
        if p.state != ACTIVE:
            _err("[EXPECTED]", "protection not active")
        if p.next_date >= _today():
            _err("[EXPECTED]", "settlement day incomplete")
        day_key = _day_key(protection_id, p.next_date)
        prior = self.days.get(day_key, DayResult(UNPROCESSED, 0, ""))
        evidence = self._settle_evidence(p.market, p.next_date, prior.status == INCONCLUSIVE)
        b = evidence.binance_close <= p.trigger_price
        g = evidence.gate_close <= p.trigger_price
        result = BREACHED if b and g else NOT_BREACHED if not b and not g else INCONCLUSIVE
        self.days[day_key] = DayResult(result, evidence.version, _now())
        p.last_result = result
        if result == INCONCLUSIVE:
            self.protections[protection_id] = p
            return result
        if result == BREACHED:
            p.breach_date = p.next_date
            old = p.state
            p.state = CLAIMABLE
            self._state(p, old, p.state)
            stats = self.user_stats[_address_key(p.owner)]
            stats.claimable_payout += p.payout
            self.user_stats[_address_key(p.owner)] = stats
        else:
            p.settled_days += 1
            if p.settled_days >= p.duration:
                old = p.state
                p.state = EXPIRED
                self.reserved_liability -= p.payout
                self._state(p, old, p.state)
                self._invariant()
            else:
                p.next_date = _date(_date_parts(p.next_date)[3] + 1)
                self.days[_day_key(protection_id, p.next_date)] = DayResult(UNPROCESSED, evidence.version, _now())
        self.protections[protection_id] = p
        return p.state

    @gl.public.write
    def claim_payout(self, protection_id: u256) -> None:
        p = self._protection(protection_id)
        if p.owner != gl.message.sender_address:
            _err("[EXPECTED]", "unauthorized")
        if p.state != CLAIMABLE:
            _err("[EXPECTED]", "not claimable")
        if p.payout > self.reserved_liability or p.payout > self.pool_balance:
            _err("[EXPECTED]", "insufficient reserved balance")
        old = p.state
        p.state = CLAIMED
        self.pool_balance -= p.payout
        self.reserved_liability -= p.payout
        self.payouts_paid += p.payout
        self._state(p, old, p.state)
        stats = self.user_stats[_address_key(p.owner)]
        stats.claimable_payout -= p.payout
        stats.payouts += p.payout
        self.user_stats[_address_key(p.owner)] = stats
        self.protections[protection_id] = p
        self._invariant()
        gl.get_contract_at(p.owner).emit_transfer(value=p.payout, on="finalized")

    @gl.public.write
    def add_operator(self, operator: Address) -> None:
        self._owner()
        key = _address_key(operator)
        if not key or key.replace("0", "").replace("x", "").replace("X", "") == "":
            _err("[EXPECTED]", "invalid operator")
        if self.operators.get(key, False):
            _err("[EXPECTED]", "operator already approved")
        if self.operator_count >= MAX_OPERATORS:
            _err("[EXPECTED]", "operator limit")
        self.operators[key] = True
        self.operator_index[str(self.operator_count)] = operator
        self.operator_positions[key] = self.operator_count
        self.operator_count += 1

    @gl.public.write
    def remove_operator(self, operator: Address) -> None:
        self._owner()
        key = _address_key(operator)
        if not self.operators.get(key, False):
            _err("[EXPECTED]", "operator not approved")
        removed = self.operator_positions[key]
        last = self.operator_count - 1
        if removed != last:
            replacement = self.operator_index[str(last)]
            self.operator_index[str(removed)] = replacement
            self.operator_positions[_address_key(replacement)] = removed
        del self.operator_index[str(last)]
        del self.operator_positions[key]
        self.operators[key] = False
        self.operator_count -= 1

    @gl.public.view
    def is_operator(self, operator_hex: str) -> bool:
        return self.operators.get(_address_key(_address(operator_hex)), False)

    @gl.public.view
    def get_operators(self) -> list:
        result = []
        for i in range(self.operator_count):
            operator = self.operator_index[str(i)]
            if self.operators.get(_address_key(operator), False):
                result.append(operator.as_hex)
        return result

    @gl.public.write
    def pause_purchases(self) -> None:
        self._owner()
        self.paused = True

    @gl.public.write
    def unpause_purchases(self) -> None:
        self._owner()
        self.paused = False
