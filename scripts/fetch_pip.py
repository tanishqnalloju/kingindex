#!/usr/bin/env python3
"""Fetch World Bank PIP national medians and write data/pip_medians.json.

API (verified 2026-09):
  Base: https://api.worldbank.org/pip/v1/
  Main: GET /pip?country={ISO3 list}&year=all&reporting_level=national&format=json
  Aux:  GET /aux?table=countries&format=json
  Info: GET /pip-info?format=json  (PPP base year in version string, e.g. 2021)

Median in PIP is daily welfare in 2017 or 2021 PPP Int$ (depending on release).
We annualize: median_ppp_annual = median * 365.
"""

from __future__ import annotations

import json
import ssl
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "pip_medians.json"
PIP_BASE = "https://api.worldbank.org/pip/v1"
BATCH = 10

# Explicit exclusions (iso3 + reason). Applied at merge / plot time.
EXCLUSIONS = [
    {"iso3": "TKM", "reason": "Collapsed official FX (junk PLI)"},
    {"iso3": "ZWE", "reason": "Collapsed official FX (junk PLI)"},
    {"iso3": "LBR", "reason": "Collapsed official FX (junk PLI)"},
    {"iso3": "ARG", "reason": "Hyperinflation / FX collapse (PLI far below floor)"},
    {"iso3": "VEN", "reason": "Missing or broken FX"},
    {"iso3": "AFG", "reason": "Conflict / survey reliability"},
    {"iso3": "SYR", "reason": "Conflict"},
    {"iso3": "YEM", "reason": "Conflict"},
    {"iso3": "SSD", "reason": "Conflict"},
    {"iso3": "SOM", "reason": "Conflict / missing reliable series"},
    {"iso3": "ERI", "reason": "Very old / unreliable survey series"},
    {"iso3": "PRK", "reason": "No usable survey median"},
]


def fetch_json(url: str, retries: int = 3) -> object:
    ctx = ssl.create_default_context()
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "KingIndex/1.0 (PIP refresh)"})
            with urllib.request.urlopen(req, timeout=180, context=ctx) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as e:
            last_err = e
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Failed: {url}\n{last_err}")


def ppp_base_year_from_info(info: dict) -> int:
    versions = info.get("available_data_versions") or []
    if not versions:
        return 2021
    # e.g. 20260324_2021_01_02_PROD → 2021
    parts = str(versions[0]).split("_")
    for p in parts[1:]:
        if p.isdigit() and len(p) == 4 and p.startswith("20"):
            return int(p)
    return 2021


def latest_national(rows: list) -> dict[str, dict]:
    best: dict[str, tuple] = {}
    for r in rows:
        if r.get("reporting_level") != "national":
            continue
        if r.get("median") is None:
            continue
        code = (r.get("country_code") or "").strip()
        if len(code) != 3:
            continue
        y = float(r.get("survey_year") or r.get("reporting_year") or 0)
        score = (0 if r.get("is_interpolated") else 1, y)
        prev = best.get(code)
        if prev is None or score > prev[0]:
            best[code] = (score, r)
    return {c: v[1] for c, v in best.items()}


def build() -> dict:
    print("PIP: fetching pip-info…")
    info = fetch_json(f"{PIP_BASE}/pip-info?format=json")
    ppp_base = ppp_base_year_from_info(info if isinstance(info, dict) else {})
    print(f"  ppp_base_year≈{ppp_base}")

    print("PIP: fetching country list…")
    countries = fetch_json(f"{PIP_BASE}/aux?table=countries&format=json")
    if not isinstance(countries, list):
        raise RuntimeError("Unexpected aux countries response")
    codes = [c["country_code"] for c in countries if len(c.get("country_code", "")) == 3]
    print(f"  countries: {len(codes)}")

    # Reuse cache if present and fresh enough
    cache = Path("/tmp/pip_latest.json")
    medians: dict[str, dict] = {}
    if cache.exists() and cache.stat().st_size > 1000:
        try:
            raw = json.loads(cache.read_text())
            if isinstance(raw, dict) and len(raw) > 50:
                print(f"  using cache {cache} ({len(raw)} countries)")
                medians = raw
        except Exception:
            medians = {}

    if not medians:
        best_rows: list = []
        nbatch = (len(codes) + BATCH - 1) // BATCH
        for i in range(0, len(codes), BATCH):
            batch = codes[i : i + BATCH]
            url = (
                f"{PIP_BASE}/pip?country={','.join(batch)}"
                f"&year=all&reporting_level=national&format=json"
            )
            rows = fetch_json(url)
            if isinstance(rows, list):
                best_rows.extend(rows)
            print(f"  batch {i // BATCH + 1}/{nbatch}: +{len(rows) if isinstance(rows, list) else 0}")
            time.sleep(0.35)
        medians = latest_national(best_rows)
        cache.write_text(json.dumps(medians), encoding="utf-8")

    out_countries = []
    for code, r in sorted(medians.items()):
        med = float(r["median"])
        if not (med > 0):
            continue
        survey_year = r.get("survey_year") or r.get("reporting_year")
        try:
            survey_year = float(survey_year) if survey_year is not None else None
        except (TypeError, ValueError):
            survey_year = None
        out_countries.append({
            "iso3": code,
            "median_ppp_daily": round(med, 6),
            "median_ppp_annual": round(med * 365, 2),
            "welfare_type": r.get("welfare_type") or None,
            "survey_year": survey_year,
            "reporting_year": r.get("reporting_year"),
            "ppp_pip": r.get("ppp"),
            "is_interpolated": bool(r.get("is_interpolated")),
        })

    if len(out_countries) < 50:
        raise RuntimeError(f"Too few PIP medians ({len(out_countries)})")

    return {
        "meta": {
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "World Bank Poverty and Inequality Platform (PIP) API v1",
            "endpoint": f"{PIP_BASE}/pip",
            "ppp_base_year": ppp_base,
            "notes": "median is daily welfare in PPP Int$; annualized ×365. National, prefer non-interpolated latest survey.",
            "exclusions": EXCLUSIONS,
        },
        "countries": out_countries,
    }


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = build()
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} ({len(payload['countries'])} countries)")
    by = {c["iso3"]: c for c in payload["countries"]}
    for code in ("IND", "BGD", "USA"):
        c = by.get(code)
        if c:
            print(f"  {code}: median_annual={c['median_ppp_annual']}  welfare={c['welfare_type']}  survey={c['survey_year']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
