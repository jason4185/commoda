# Commoda v1 backend architecture

Commoda is fixed-payout, downside-only protection for WTI, Brent, and Natural
Gas perpetual markets. It is not a prediction market and its exchange-based
benchmark is not an official CME or ICE settlement price.

## Locked product

Markets are exactly `WTI`, `BRENT`, and `NATGAS`. Public trigger levels are
exactly 1%, 2%, and 3% (`event_percent` 1, 2, and 3; internal 100, 200, and
300 bps). Durations are 7, 14, and 30 days. Premiums are 1, 2, and 3 GEN
respectively; payouts by duration and trigger are:

| Duration | 1% | 2% | 3% |
| --- | ---: | ---: | ---: |
| 7 days | 2 GEN | 3 GEN | 4 GEN |
| 14 days | 4 GEN | 5 GEN | 6 GEN |
| 30 days | 6 GEN | 8 GEN | 10 GEN |

Purchase day is excluded. The first protected settlement day is the next UTC
calendar day. All protection is DOWN-only:
`event_bps = event_percent * 100`, then
`reference_price * (10000 - event_bps) // 10000`.

## Sources and purchase reference

Binance symbols are `CLUSDT`, `BZUSDT`, and `NATGASUSDT`; Gate contracts are
`CL_USDT`, `BZ_USDT`, and `NG_USDT`. Historical data uses Binance
`https://fapi.binance.com/fapi/v1/klines` and Gate
`https://api.gateio.ws/api/v4/futures/usdt/candlesticks`.

Purchase reference data is Gate-only from its futures ticker endpoint. The
reference is positive, deterministically scaled to `10**8`, and tied to the
requested contract. Gate's documented ticker object provides `contract` and
`last` but no source timestamp, so the contract does not invent stale/future
validation or a timestamp-equivalence rule. The purchase transaction's
`created_at` is stored as the audit timestamp. Leader/validator purchase
equivalence permits at most 5 bps price movement. This rule applies only to
Gate purchase consensus, never to historical settlement.

## Historical settlement

The target candle is the exact UTC day `00:00:00` through `23:59:59`.
Binance must return the exact opening timestamp and a fully closed candle;
Gate must contain a row whose `t` exactly equals target midnight. Validators
independently fetch and validate both sources through
`gl.vm.run_nondet_unsafe`; state is written only after consensus.

There is no historical price-distance tolerance and no historical average.
Shared evidence is keyed by `market|YYYY-MM-DD` and stores both verified closes,
timestamps, version, and creation time. A protection evaluates each
close against its own trigger: both below/equal means `BREACHED`, both above
means `NOT_BREACHED`, and disagreement means `INCONCLUSIVE`.

Evidence retries create a new version instead of overwriting the old record.
Each protection stores its own per-date result. `UNPROCESSED` and
`INCONCLUSIVE` remain unresolved; the contract always settles the earliest
unresolved date, so cached later evidence cannot skip an earlier day.

## Reserves, lifecycle, and authorization

The owner funds the pool. At purchase, the exact premium is collected and the
full fixed payout is reserved. Available liquidity is
`pool_balance - reserved_liability`; owner withdrawal is limited to that
amount. An invariant check enforces `reserved_liability <= pool_balance` at
funding, purchase, withdrawal, expiry, and claim.

Conclusive breach makes a protection `CLAIMABLE` and records the breach date.
Conclusive non-breach advances the next date; completion makes it `EXPIRED`
and releases the reserve. `INCONCLUSIVE` does neither. Only the protection
owner claims; claim reduces pool and reserve exactly once. Pausing blocks new
purchases but not settlement or claims.

Settlement is authorized for the protection owner, contract owner, or an
approved operator. Operators are owner-managed and capped at 5. Owner
indexes use a per-owner count and `owner|index` map; no dynamic-array storage
is used. User and protocol counters cover lifecycle states, premiums, and
payouts.
