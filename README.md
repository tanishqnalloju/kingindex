# KingIndex

**Live:** [kingindex.tanishqnalloju.com](https://kingindex.tanishqnalloju.com)  
Legacy: `ppp-index-calculator.tanishqnalloju.com` → 301 redirect (query string preserved).

**Lab · Multiple of local median**

KingIndex converts an annual income (home currency) into PPP international dollars and compares it to World Bank **PIP national medians**. The core number is **× local median**, not percentile crowns.

It is a static page + baked snapshot (`data/countries.json`). No accounts, no API keys, no backend.

## How to run

```bash
python3 scripts/fetch_pip.py      # PIP medians → data/pip_medians.json
python3 scripts/fetch_data.py     # WDI + merge PIP → data/countries.json
npm run sync-assets               # copy into public/ for Workers
python3 -m http.server 8080       # open http://localhost:8080
node scripts/verify_median.js     # IND ₹800k → BGD fixture
```

## Formulas

```
income_per_capita = income / household_size
your_ppp_income   = income_per_capita / home.ppp
multiple_of_median = your_ppp_income / dest.median_ppp_annual

equivalent_local  = (income / home.ppp) * dest.ppp   # household income
fx_local          = (income / home.fx) * dest.fx
cost_%_vs_home    = (dest.pli_us / home.pli_us - 1) * 100
pli_us            = ppp / fx                         # US ≈ 1.0
```

Share URL params: `income`, `home`, `type`, `dest`, optional `household_size` (default 1).

## Data

- **Prices:** World Bank WDI private-consumption PPP (`PA.NUS.PRVT.PP`) / official FX (`PA.NUS.FCRF`).
- **Medians:** World Bank PIP API `https://api.worldbank.org/pip/v1/pip` — national, prefer latest non-interpolated survey; daily median annualized ×365 → `median_ppp_annual`.
- Also store `welfare_type`, `survey_year`, `ppp_base_year`.
- **Exclusions** (iso3 + reason) in `meta.exclusions` + old-survey cutoff + unreliable PLI floor (~5% of US). Plot = reliable PLI ∩ median − exclusions.
- No Gini imputation for the Y axis. No Infinity/NaN on the scatter.

### Self-check: ₹800,000 net · home=IND · dest=BGD · household_size=1

| Metric | Value |
|---|---|
| PPP equivalent (BDT) | ~1,408,973 |
| FX (BDT) | ~1,119,073 |
| Cost % vs home | ~+25.9% (Bangladesh more expensive than India on PLI) |
| × BGD median | ~17.89× |
| Welfare / survey | consumption · 2022 |

(Exact figures follow the baked snapshot; re-run `verify_median.js` after refresh.)

## UI notes

- **Primary:** home/dest cards + summary emphasize **× median**, PPP equiv, FX, cost % vs home.
- **Secondary:** “Lab: × median map” log-log scatter + log income slider (below cards).
- Band filter lists exact tags only (no Comfortable+ / Affluent+). Public copy uses **cost vs home**, not “stretch”.
- Crowns / “Locally king” / top 0.1% are not the hero product.

## What it is not

- Not a tax / take-home calculator (you choose gross vs net).
- Not city-level. Not housing, visas, or school fees.
- Not advice to relocate.

## License

MIT
