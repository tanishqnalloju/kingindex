# KingIndex

**Live:** [kingindex.tanishqnalloju.com](https://kingindex.tanishqnalloju.com)  
Legacy: `ppp-index-calculator.tanishqnalloju.com` → 301 redirect (query string preserved).

**Lab · Multiple of local median**

KingIndex converts an annual income (home currency) into PPP international dollars and compares it to World Bank **PIP national medians**. The core number is **× local median**, not percentile crowns.

Production serves a **multi-build** static tree from `public/`:

| Path | Build |
|------|--------|
| `/` | Chooser |
| `/1/` | Alternative (editorial lab) |
| `/2/` | Improved (production IA + audit fixes) |
| `/3/` | Phosphor (CRT oscilloscope lab) |

Assets under `public/` are the source of truth (same layout as kingindex-v2 staging). Worker name remains `ppp-index-calculator` so the apex custom domain stays attached. Staging stays on Worker `kingindex-v2` → `v2.kingindex.tanishqnalloju.com`.

## How to run

```bash
npm run parity                 # IND ₹800k → BGD fixture across all builds
npx wrangler deploy            # deploy Worker ppp-index-calculator
npx wrangler dev               # local preview
python3 scripts/fetch_pip.py   # optional: refresh PIP medians
python3 scripts/fetch_data.py  # optional: refresh countries.json into data/
```

After refreshing root `data/countries.json`, copy into each build:

```bash
cp data/countries.json public/data/countries.json
cp data/countries.json public/1/data/countries.json
cp data/countries.json public/2/data/countries.json
cp data/countries.json public/3/data/countries.json
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
- **Medians:** World Bank PIP API — national, prefer latest non-interpolated survey; daily median annualized ×365 → `median_ppp_annual`.
- Also store `welfare_type`, `survey_year`, `ppp_base_year`.
- **Exclusions** in `meta.exclusions` + old-survey cutoff + unreliable PLI floor (~5% of US).

### Self-check: ₹800,000 net · home=IND · dest=BGD · household_size=1

| Metric | Value |
|---|---|
| PPP equivalent (BDT) | ~1,408,973 |
| FX (BDT) | ~1,119,073 |
| Cost % vs home | ~+25.9% |
| × BGD median | ~17.89× |
| Welfare / survey | consumption · 2022 |

## What it is not

- Not a tax / take-home calculator (you choose gross vs net).
- Not city-level. Not housing, visas, or school fees.
- Not advice to relocate.

## License

MIT
