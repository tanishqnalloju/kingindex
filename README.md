# KingIndex

**Live:** [kingindex.tanishqnalloju.com](https://kingindex.tanishqnalloju.com)  
Legacy: `ppp-index-calculator.tanishqnalloju.com` → 301 redirect (query string preserved). · [workers.dev](https://ppp-index-calculator.tanishq-nalloju.workers.dev)

**Same paycheck. Different class.**

KingIndex is a relative-class translator: take an annual income and a home country, convert it with World Bank private-consumption PPP, estimate local (and rough global) percentiles via a Gini-calibrated lognormal, and rank countries by how rich that paycheck makes you locally. “King” is reserved for the local top 1% (est. p ≥ 99).

It is a single static page plus a baked data snapshot. No accounts, no API keys, no backend.

## How to run

```bash
python3 scripts/fetch_data.py   # rebuilds data/countries.json from World Bank
# then open index.html in a browser, or:
python3 -m http.server 8080     # from this directory, visit http://localhost:8080
```

## Formulas

```
ppp_income     = income_local / home.ppp
equiv_local    = ppp_income * dest.ppp          # same PPP lifestyle
income_usd     = income_local / home.fx
fx_local       = income_usd * dest.fx           # wire-transfer view
pli_us         = ppp / fx                       # US ≈ 1.0
stretch        = home.pli_us / dest.pli_us      # >1 = dest cheaper

# Local percentile: country ~ LogNormal from mean (GNI/GDP pc PPP) + Gini
σ = √2 · Φ⁻¹((g + 1) / 2)     # g = Gini/100 clamped to [0.20, 0.65]
μ = ln(m) - σ² / 2
p = Φ((ln(ppp_income) - μ) / σ) · 100
```

Global percentile uses a fixed log-income calibration curve (rough ballpark, not WID/PIP official).

## Data

- Source: World Bank World Development Indicators (most recent non-empty per indicator via `mrnev=1`).
- Prefer private-consumption PPP (`PA.NUS.PRVT.PP`); fall back to GDP PPP (`PA.NUS.PPP`).
- Price level = consumption PPP / official FX (`PA.NUS.FCRF`).
- Typical income proxy: GNI per capita PPP, else GDP per capita PPP.
- Gini from `SI.POV.GINI`; if missing, imputed at 38.
- Snapshot path: `data/countries.json` (see `meta.generated_at` for vintage).

Percentiles are **estimates**, not official PIP / household-survey microdata percentiles.

## What it is not

- Not a tax / take-home calculator (you choose gross vs net yourself).
- Not city-level (Lisbon ≠ Portugal).
- Not housing quality, safety, visas, or healthcare advice.
- Not a PPP “tracker” chart bot.
- Not relocation or career advice — use it to **rank** places for purchasing-power class.

## License

MIT
