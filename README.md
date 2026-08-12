## Commoda v1

Commoda is a backend-only GenLayer Intelligent Contract for fixed-payout,
DOWN-only commodity price protection on WTI Crude Oil, Brent Crude Oil, and
Natural Gas. It uses fixed 1%/2%/3% triggers, 7/14/30-day durations,
and the locked premium/payout matrix documented in [docs/architecture.md](docs/architecture.md).

The deployable source is [contract/CommodaProtection.py](contract/CommodaProtection.py).
Its full evidence, storage, accounting, consensus, and limitation notes are in
[docs/architecture.md](docs/architecture.md).

Purchase references use Gate only; leader/validator equivalence is limited to
5 bps. Gate's ticker response has no source timestamp, so the transaction
timestamp is stored for auditability without pretending to prove source
freshness. Historical evidence uses Binance and Gate exact UTC daily candles,
with source-outcome agreement and no historical price tolerance or averaging.
These exchange perpetual closes are not official CME/ICE settlement prices.
