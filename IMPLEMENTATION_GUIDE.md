# KingIndex — Implementation Playbook

**Give this file to a coding agent and say: "Implement v1 exactly as specified. Do not invent extra features. Do not stop to re-validate the idea."**

Ship a **single-page web app** that answers:

> Same paycheck, different rank. Where is this income cheap, expensive, average, comfortable, or locally rich?

Product name: **KingIndex**  
Tagline: *Same paycheck. Different class.*  
Form: one HTML app + one data snapshot + short README. Not a chatbot in v1.

---

## 0. Non-negotiables

1. Do **not** build a "PPP tracker bot." Build a **relative-class translator**.
2. Three outputs only. If a screen does not serve one of these, delete it:
   - Cheap vs expensive (price level)
   - Same-life equivalent salary
   - Destination income percentile + lifestyle band
3. Be honest in the UI. PPP is a first cut, not a relocation plan.
4. Works offline after first load using a baked snapshot. Live World Bank fetch is optional refresh, not a hard dependency.
5. No API keys. No Numbeo. No accounts. No backend in v1.
6. Country-level only in v1. No cities.
7. Income is **annual individual income** (user chooses gross or net; default **net / take-home**, labeled clearly).
8. "King" is a **percentile band**, not a vibe word slapped on cheap countries.

---

## 1. What v1 does

### Inputs
- Annual income (number)
- Income type: `Net (take-home)` default | `Gross`
- Home country
- Optional target country (if empty, rank **all** countries)

### Outputs

**A. Home card**
- Income in local currency
- Income in international dollars (PPP)
- Home price level vs United States (US = 100)
- Estimated home-country percentile + lifestyle band
- Estimated **global** PPP percentile (secondary, smaller)

**B. Destination card** (if a target is chosen)
- Equivalent local salary to keep the same PPP lifestyle
- Market-FX conversion of the same money (show both; label which is "real stuff" vs "wire transfer")
- Price level vs home and vs US
- Stretch factor: `home_PLI / dest_PLI` (e.g. "money goes 3.1× further")
- Estimated destination percentile + lifestyle band
- One sentence: "In Portugal this is locally Affluent (≈ top 12%). In Switzerland this is Comfortable (≈ top 38%)."

**C. Ranked table** (always)
Every country with complete data, sortable/filterable:

| Col | Meaning |
|---|---|
| Country | name + ISO3 |
| Price level | US=100. Lower = cheaper |
| Stretch vs home | how much further the paycheck goes |
| Local equivalent | dest currency needed for same PPP living standard |
| Est. local percentile | 1–99, higher = richer locally |
| Band | Stretched / Normal / Comfortable / Affluent / King |
| Data year | PPP year used |

Filters:
- Region
- Band: Comfortable+, Affluent+, King
- Cheaper than home
- Search by name

Default sort: **highest local percentile** (the "where am I rich" sort).  
Secondary useful sort: cheapest price level.

### Lifestyle bands (fixed)

Use destination estimated percentile `p` (0–100, "you out-earn p%"):

| Band | Rule | UI label |
|---|---|---|
| Stretched | p < 40 | Stretched |
| Normal | 40 ≤ p < 70 | Normal local life |
| Comfortable | 70 ≤ p < 90 | Comfortable |
| Affluent | 90 ≤ p < 99 | Affluent |
| King | p ≥ 99 | Locally king |

Never call someone "king" just because the country is cheap. Only the 99th percentile rule.

---

## 2. Repo / files to create

```
kingindex/
  README.md
  index.html              # the entire app (CSS+JS inlined is OK)
  data/
    countries.json        # baked snapshot used by the app
  scripts/
    fetch_data.py         # rebuilds countries.json from World Bank
  IMPLEMENTATION_GUIDE.md # this file (include it)
```

Optional later, **not v1**: Python CLI, Telegram bot, city layer, tax engine.

`index.html` must open by double-click or `python -m http.server` and work.

---

## 3. Data sources (official, free, no key)

World Bank Indicators API:

```
https://api.worldbank.org/v2/country/all/indicator/{CODE}?format=json&per_page=400&mrnev=1
```

`mrnev=1` = most recent non-empty value per country.

| Field in snapshot | Indicator | Why |
|---|---|---|
| `ppp_cons` | `PA.NUS.PRVT.PP` | PPP conversion factor, **private consumption** (LCU per international $). **This is the lifestyle PPP. Prefer over GDP PPP.** |
| `ppp_gdp` | `PA.NUS.PPP` | GDP PPP factor. Keep as fallback if consumption PPP missing. |
| `fx` | `PA.NUS.FCRF` | Official exchange rate (LCU per USD) |
| `gdp_pc_ppp` | `NY.GDP.PCAP.PP.CD` | GDP per capita, PPP current international $ |
| `gni_pc_ppp` | `NY.GNP.PCAP.PP.CD` | GNI per capita PPP. Prefer this as "typical income" proxy when present |
| `gini` | `SI.POV.GINI` | Gini index 0–100 |
| `pop` | `SP.POP.TOTL` | Population (filter tiny territories if needed) |

Skip aggregates. Drop rows whose ISO3 is in:

```
AFE AFW ARB CEB CSS EAP EAR EAS ECA ECS EMU EUU FCS HIC HPC IBD IBT IDA IDB IDX LAC LCN LDC LIC LMC LMY LTE MEA MIC MNA OED OSS PRE PSS PSS PST SAS SSA SSF SST TEA TEA TEC TLA TMN TSA TSS UMC WLD
```

Also drop any row whose `countryiso3code` is empty or whose name is a region ("Euro area", "World", "OECD members", etc.).

Keep a country only if it has:
- a usable PPP factor (`ppp_cons` or `ppp_gdp`)
- `fx` > 0
- `gni_pc_ppp` or `gdp_pc_ppp` > 0

Gini may be missing. Use fallback Gini **38** if missing (world-ish). Store `gini_ imputed: true`.

### Currency codes

World Bank will not give you ISO currency reliably. Ship a static map in `fetch_data.py` for ~150 common ISO3→currency (USD, EUR, INR, JPY, …). If unknown, use `"LCU"`.

Euro-area countries share FX via `PA.NUS.FCRF` (EUR per USD). Fine.

### Snapshot schema (`data/countries.json`)

```json
{
  "meta": {
    "generated_at": "ISO-8601",
    "source": "World Bank WDI, most recent available per indicator",
    "notes": "Price levels use private-consumption PPP / official FX. Percentiles are lognormal approximations, not PIP microdata."
  },
  "countries": [
    {
      "iso3": "IND",
      "iso2": "IN",
      "name": "India",
      "region": "South Asia",
      "currency": "INR",
      "ppp": 19.84,
      "ppp_year": 2025,
      "ppp_source": "cons",
      "fx": 87.16,
      "fx_year": 2025,
      "pli_us": 0.228,
      "mean_income_ppp": 10000,
      "mean_source": "gni_pc_ppp",
      "mean_year": 2025,
      "gini": 32.8,
      "gini_year": 2021,
      "gini_imputed": false,
      "pop": 1400000000
    }
  ]
}
```

`pli_us = ppp / fx`  
United States must end up `pli_us ≈ 1.0`, `ppp ≈ 1`, `fx ≈ 1`.

Region: attach from World Bank country list endpoint  
`https://api.worldbank.org/v2/country?format=json&per_page=400`  
field `region.value`. Drop region = "Aggregates".

---

## 4. Math (implement exactly)

All income internally converted to **annual international dollars** (PPP $).

### 4.1 Home income → PPP$

```
ppp_income = income_local / home.ppp
```

Example: ₹2,000,000 / 19.84 ≈ Int$100,806

If user said the income is already in USD **and** home is not USA, still divide by home.ppp only if the number is in **home local currency**. The input currency is always the **home country's currency**. Label the input box with that currency code.

### 4.2 Equivalent salary in destination (same purchasing power)

```
equiv_local = ppp_income * dest.ppp
```

Same as: `income_local * (dest.ppp / home.ppp)`

This is the "keep this lifestyle" number.

### 4.3 Naive FX conversion (wire-transfer view)

```
income_usd = income_local / home.fx
fx_local   = income_usd * dest.fx
```

Show both `equiv_local` and `fx_local`.  
Caption: **PPP equivalent = what you need to live the same. FX = what your paycheck becomes if you just convert cash.**

### 4.4 Price level and stretch

```
pli_us(country)     = country.ppp / country.fx          # US ≈ 1.0
pli_index           = pli_us * 100                      # US = 100
stretch_vs_home     = home.pli_us / dest.pli_us         # >1 = dest cheaper
cheaper_pct         = (1 - dest.pli_us / home.pli_us) * 100
```

UI: "Portugal price level 65 (US=100). Your money goes 1.25× further than at home."

### 4.5 Destination / home percentile (lognormal)

We do **not** have PIP percentile microdata in v1. Approximate each country as lognormal using mean income and Gini.

Let
- `m` = `mean_income_ppp` (prefer GNI/capita PPP, else GDP/capita PPP)
- `g` = Gini as a **decimal** (`gini / 100`), clamped to `[0.20, 0.65]`

Gini of a lognormal:

```
g = 2 * Φ(σ / √2) - 1
⇒ σ = √2 * Φ⁻¹((g + 1) / 2)
```

`Φ` = standard normal CDF, `Φ⁻¹` = inverse CDF (probit).

In JS, implement `normCdf` and `normInv` (Acklam or equivalent). Do not pull a 200kb library; 30 lines is enough.

Mean of lognormal `X ~ LogN(μ, σ²)` is `E[X] = exp(μ + σ²/2)`, so:

```
μ = ln(m) - σ² / 2
```

Percentile of `ppp_income`:

```
z = (ln(ppp_income) - μ) / σ
p = Φ(z) * 100
```

Clamp displayed percentile to `[0.1, 99.9]`.  
If `ppp_income <= 0`, show "—" and skip that country.

**This is an estimate.** Footer every percentile with "est."  
If `gini_imputed`, add a faint "Gini imputed" mark on hover.

### 4.6 Global percentile (rough, secondary)

Do not pretend this is WID/PIP official. Use a **fixed calibration curve** in international $ (annual, PPP), piecewise-log on these anchors (2024–26 public ballparks):

| Annual PPP$ | Approx global percentile (out-earn %) |
|---|---|
| 1,000 | 20 |
| 2,500 | 40 |
| 4,000 | 50 |
| 10,000 | 70 |
| 20,000 | 82 |
| 40,000 | 90 |
| 60,000 | 95 |
| 125,000 | 99 |
| 250,000 | 99.7 |

Linear-interpolate in **log-income** between anchors. Below $1,000 or above $250,000, clamp.  
Label: **Global (rough)**. Never lead with this. Destination percentile is the product.

### 4.7 Worked example (use as a test fixture)

Use whatever numbers are **in the snapshot** for these countries, but the relations must hold:

Given home = United States, income = 80,000 USD net  
(`usa.ppp = 1`, so `ppp_income = 80000`)

For India (`pli_us ≈ 0.23`, `ppp ≈ 19.8`):
- stretch ≈ 1 / 0.23 ≈ 4.4×
- equiv_local ≈ 80,000 * 19.8 ≈ ₹1.58e6
- local percentile should be very high (Affluent or King) because 80k PPP$ is far above Indian mean

For Switzerland (`pli_us ≈ 1.28`):
- stretch ≈ 0.78× (more expensive)
- local percentile much lower than India’s
- band likely Comfortable or Affluent, not King

Add `scripts/selftest.js` logic **inside** `index.html` as `window.__kingSelftest()` that:
1. Loads snapshot
2. Asserts USA `pli_us` in `[0.95, 1.05]`
3. Asserts India `pli_us` < 0.40
4. Asserts Switzerland `pli_us` > 1.10
5. Asserts US $80k percentile in India > percentile in Switzerland
6. Logs PASS/FAIL in the console

If selftest fails, fix data or math before calling the app done.

---

## 5. UI spec

### Look
Dark, dense, financial. Not a pastel startup landing page.  
Font: system UI + one tabular-nums treatment for money.  
Max width ~1120px. Mobile: stack inputs, table becomes cards or horizontal scroll.

### Above the fold
```
KingIndex
Same paycheck. Different class.

[ 80000          ] [ Net ▾ ] [ United States ▾ ] [ All countries ▾ ]  [ Rank → ]
Income is annual, in the home country's currency (USD).
```

Primary button computes immediately on change too (live update is fine).

### Result header (one paragraph, generated)

```
$80,000 net in the United States is about Int$80,000.
That is est. top 28% at home (Comfortable) and roughly global top 6%.
The same purchasing power is locally King in India (est. top 0.4%)
and Comfortable in Switzerland (est. top 34%).
```

Numbers must come from the model, not copy.

### Two number tiles
1. **Cheapest 5** where band ≥ Comfortable  
2. **Highest rank 5** (best local percentile)

### Table
Sticky header. Color bands:
- Stretched: muted
- Normal: default
- Comfortable: teal
- Affluent: gold
- King: bright gold / crown glyph `♛`

Price level bar: a 0–160 track, US tick at 100.

### Caveat strip (always visible, not a buried FAQ)

> Country-level consumption PPP (World Bank / ICP, extrapolated).  
> Not your rent, taxes, visa, or school fees.  
> Percentiles are a lognormal estimate from GNI/GDP per capita + Gini — not household survey microdata.  
> Use this to rank places, not to accept a job.

### Empty / error
If snapshot missing, try live World Bank fetch for the six indicators, then build the same objects in-memory. If that fails, show "Drop data/countries.json next to index.html".

---

## 6. `fetch_data.py` requirements

Python 3.10+, stdlib only (`urllib`, `json`, `ssl`).

```
python3 scripts/fetch_data.py
# writes data/countries.json
```

Steps:
1. Fetch each indicator with `mrnev=1`
2. Fetch country metadata (region, capital, iso2)
3. Join on ISO3
4. Filter aggregates
5. Compute `pli_us`
6. Attach currency from a hardcoded dict (include at least G7, EU, IN, CN, BR, MX, ZA, NG, ID, VN, TH, PH, TR, AE, SA, EG, AR, CL, CO, PE, MY, SG, KR, JP, AU, NZ, CH, NO, SE, DK, PL, CZ, RO, HU, PT, GR, IE)
7. Write pretty JSON
8. Print summary: country count, year range, USA PLI, India PLI, CHE PLI

If a request fails, retry twice. Do not silently write an empty file.

---

## 7. `index.html` requirements

Single file is preferred (embed a trimmed JSON **or** `fetch('./data/countries.json')`).

If you embed JSON, still keep `data/countries.json` as source of truth.

Vanilla JS. No React, no build step, no npm.

Must implement:
- country dropdowns (searchable `<input>` + filter, or long `<select>` is acceptable)
- live recompute
- sort on any column
- copy-summary button that copies the generated paragraph
- `?income=80000&home=USA&dest=PRT&type=net` query params so results are shareable

---

## 8. README.md (short)

Include:
- What it is in 5 lines
- How to run (`python3 scripts/fetch_data.py` then open `index.html`)
- Formulas in one code block
- Data vintage / sources
- What it is not (taxes, cities, housing quality, safety)
- License: MIT

---

## 9. Implementation order (do this in order)

1. Write `scripts/fetch_data.py` and generate `data/countries.json`.  
   Confirm ~150–210 countries and sane PLIs (USA~1, IND~0.23, CHE~1.28, JPN~0.69, PRT~0.65).
2. Implement math helpers + selftest against the snapshot.
3. Build `index.html` inputs + home card + destination card.
4. Build ranked table + filters + query params.
5. Write README.
6. Manual check with three scenarios:
   - US $80k net → India vs Switzerland vs Portugal vs Nigeria
   - Germany €45,000 net → US vs Thailand vs UK
   - India ₹1,200,000 net → US vs UAE vs Vietnam
7. Stop. Do not add taxes, cities, maps, accounts, or a chatbot.

---

## 10. Explicitly out of scope for v1

- City prices (Lisbon vs Portugal)
- Income tax / social contributions
- Housing quality, safety, visas, healthcare
- Numbeo / crowdsourced baskets
- Historical PPP charts ("tracker")
- User accounts
- Mobile native apps
- "Bot" personality / chat UI
- Advertising "move here and live like a king" as advice

Those can be v2. v1 is the engine + the rank table.

---

## 11. Acceptance checklist

- [ ] `data/countries.json` exists and USA PLI ≈ 1
- [ ] Opening `index.html` shows the calculator without a build
- [ ] Changing home country relabels the currency on the input
- [ ] PPP equivalent ≠ FX equivalent for India (gap should be large)
- [ ] Same US income ranks much higher in India than in Switzerland
- [ ] Band "King" only appears at est. p ≥ 99
- [ ] Caveat strip is visible without scrolling on desktop
- [ ] Share URL restores inputs
- [ ] Console `__kingSelftest()` prints PASS
- [ ] README explains the estimate is not official PIP percentiles

---

## 12. Agent anti-patterns

Do not:
- Start a product-strategy essay
- Add a marketing landing page above the tool
- Pull NPM chart libraries
- Use GDP PPP when consumption PPP exists
- Treat exchange rates as purchasing power
- Rank by "cheapest" as the default (default = richest locally)
- Fake precise percentiles (12.374%). Show **est. top 12%** or **est. 88th percentile**, integer

---

## 13. One-sentence brief for the implementing model

Build **KingIndex**: a no-build static web app that takes annual income + home country, converts it with World Bank private-consumption PPP, estimates local and global percentiles via a Gini-calibrated lognormal, and ranks countries by how rich that paycheck makes you — with "King" reserved for the local top 1%.
