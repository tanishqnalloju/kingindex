(function () {
  "use strict";

  function normCdf(x) {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const t = 1 / (1 + p * Math.abs(x));
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
    return 0.5 * (1 + sign * y);
  }
  function normInv(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614736e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223726362411991e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const plow = 0.02425, phigh = 1 - plow;
    let q, r;
    if (p < plow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    }
    if (p > phigh) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    }
    q = p - 0.5; r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5]) * q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }
  function sigmaFromGini(giniIndex) {
    let g = giniIndex / 100;
    g = Math.max(0.20, Math.min(0.65, g));
    return Math.SQRT2 * normInv((g + 1) / 2);
  }
  function localPercentile(pppIncome, meanIncome, giniIndex) {
    if (!(pppIncome > 0) || !(meanIncome > 0) || !(giniIndex > 0)) return null;
    const sigma = sigmaFromGini(giniIndex);
    const mu = Math.log(meanIncome) - (sigma * sigma) / 2;
    const z = (Math.log(pppIncome) - mu) / sigma;
    return Math.max(0.1, Math.min(99.9, normCdf(z) * 100));
  }
  function bandFromP(p) {
    if (p == null) return { key: "—", label: "—" };
    if (p < 40) return { key: "Stretched", label: "Stretched" };
    if (p < 70) return { key: "Normal", label: "Normal local life" };
    if (p < 90) return { key: "Comfortable", label: "Comfortable" };
    if (p < 99) return { key: "Affluent", label: "Affluent" };
    return { key: "King", label: "Locally king" };
  }
  function bandRank(key) {
    return { Stretched: 0, Normal: 1, Comfortable: 2, Affluent: 3, King: 4 }[key] ?? -1;
  }
  function isReliablePli(c) {
    return Number.isFinite(c.pli_us) && c.pli_us >= 0.05
      && Number.isFinite(c.ppp) && c.ppp > 0
      && Number.isFinite(c.fx) && c.fx > 0;
  }
  function hasMedian(c) {
    return Number.isFinite(c.median_ppp_annual) && c.median_ppp_annual > 0;
  }
  function isPlottable(c) {
    return isReliablePli(c) && hasMedian(c) && !c.excluded;
  }
  function isReliable(c) {
    return isReliablePli(c) && !c.excluded;
  }
  function localeForCurrency(currency, iso3) {
    if (currency === "INR" || iso3 === "IND") return "en-IN";
    if (currency === "USD") return "en-US";
    if (currency === "GBP") return "en-GB";
    if (currency === "EUR") return "de-DE";
    if (currency === "JPY") return "ja-JP";
    if (currency === "CNY") return "zh-CN";
    return "en-US";
  }
  function parseIncome(raw) {
    const digits = String(raw || "").replace(/[^\d.]/g, "");
    if (!digits) return NaN;
    return parseFloat(digits);
  }
  function formatIncomeInput(n, currency, iso3) {
    if (!(n > 0) || !isFinite(n)) return "";
    return Math.round(n).toLocaleString(localeForCurrency(currency, iso3));
  }
  function fmtMoney(n, currency, iso3) {
    if (n == null || !isFinite(n)) return "—";
    const loc = localeForCurrency(currency, iso3);
    const abs = Math.abs(n);
    const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
    const s = n.toLocaleString(loc, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
    return currency && currency !== "LCU" ? `${s} ${currency}` : s;
  }
  function fmtInt(n, loc) {
    if (n == null || !isFinite(n)) return "—";
    return Math.round(n).toLocaleString(loc || "en-US");
  }
  function fmtIncomeLead(n, currency, iso3) {
    if (n == null || !isFinite(n)) return "—";
    const loc = localeForCurrency(currency, iso3);
    const s = Math.round(n).toLocaleString(loc);
    if (currency === "USD") return `$${s}`;
    if (currency === "INR") return `₹${s}`;
    if (currency === "GBP") return `£${s}`;
    if (currency === "EUR") return `€${s}`;
    if (currency && currency !== "LCU") return `${s} ${currency}`;
    return s;
  }
  function fmtMultiple(m) {
    if (m == null || !Number.isFinite(m)) return "—";
    if (m >= 100) return Math.round(m) + "×";
    if (m >= 10) return (Math.round(m * 10) / 10).toFixed(1) + "×";
    return (Math.round(m * 100) / 100).toFixed(2) + "×";
  }
  function costVsHome(homePli, destPli) {
    if (!(homePli > 0) || !(destPli > 0) || !Number.isFinite(homePli) || !Number.isFinite(destPli)) {
      return { pct: null, primary: null };
    }
    const pct = (destPli / homePli - 1) * 100;
    let primary;
    if (Math.abs(pct) < 0.5) primary = "Same lifestyle costs about the same as at home.";
    else if (pct > 0) primary = `Same lifestyle costs ${Math.round(pct)}% more than at home.`;
    else primary = `Same lifestyle costs ${Math.round(-pct)}% less than at home.`;
    return { pct, primary };
  }
  function priceLevelVsUS(pli) {
    if (!(pli > 0) || !Number.isFinite(pli)) return null;
    return `About ${Math.round(pli * 100)}% of US prices.`;
  }
  function priceLevelDest(destPli, homePli) {
    if (!(destPli > 0) || !Number.isFinite(destPli)) return null;
    const ofUs = Math.round(destPli * 100);
    if (!(homePli > 0) || !Number.isFinite(homePli)) return `About ${ofUs}% of US prices.`;
    const vsHome = (destPli / homePli - 1) * 100;
    if (Math.abs(vsHome) < 0.5) return `About ${ofUs}% of US prices; about the same as home.`;
    if (vsHome > 0) return `About ${ofUs}% of US prices; ${Math.round(vsHome)}% higher than home.`;
    return `About ${ofUs}% of US prices; ${Math.round(-vsHome)}% lower than home.`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  let DATA = null, byIso = {}, rowsCache = [], countriesSorted = [];
  let sortKey = "multiple", sortDir = -1, lastCopyText = "";
  let urlTimer = null, sliderSyncing = false;
  const INCOME_MIN = 1000, INCOME_MAX = 50000000, MULT_CAP = 100;
  const el = (id) => document.getElementById(id);

  function showError(msg) {
    el("status").textContent = msg;
    el("status").classList.remove("hidden");
    el("results").classList.add("hidden");
  }
  function clearError() { el("status").classList.add("hidden"); }
  function householdSize() {
    let n = parseInt(el("household").value, 10);
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (n > 20) n = 20;
    return n;
  }

  function setupPicker(inputId, hiddenId, listId, { allowEmpty, emptyLabel }) {
    const input = el(inputId), hidden = el(hiddenId), list = el(listId);
    function options(filter) {
      const q = (filter || "").trim().toLowerCase();
      const out = [];
      if (allowEmpty && (!q || "all countries".includes(q))) out.push({ iso3: "", name: emptyLabel || "All countries" });
      for (const c of countriesSorted) {
        const label = `${c.name} (${c.iso3})`;
        if (!q || label.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q)) out.push({ iso3: c.iso3, name: label });
      }
      return out.slice(0, 40);
    }
    function renderList(filter) {
      const opts = options(filter);
      list.innerHTML = opts.map((o, i) =>
        `<button type="button" role="option" data-iso="${o.iso3}" class="${i === 0 ? "active" : ""}">${escapeHtml(o.name)}</button>`
      ).join("");
      list.classList.add("open");
    }
    function setValue(iso3, silent) {
      hidden.value = iso3 || "";
      if (!iso3) {
        input.value = allowEmpty ? "" : input.value;
        if (allowEmpty) input.placeholder = emptyLabel || "All countries";
      } else if (byIso[iso3]) input.value = `${byIso[iso3].name} (${iso3})`;
      if (!silent) hidden.dispatchEvent(new Event("change", { bubbles: true }));
    }
    input.addEventListener("focus", () => renderList(input.value.includes("(") ? "" : input.value));
    input.addEventListener("input", () => renderList(input.value));
    input.addEventListener("keydown", (e) => {
      const btns = [...list.querySelectorAll("button")];
      const idx = btns.findIndex(b => b.classList.contains("active"));
      if (e.key === "ArrowDown") { e.preventDefault(); const n = Math.min(btns.length - 1, idx + 1); btns.forEach(b => b.classList.remove("active")); if (btns[n]) btns[n].classList.add("active"); }
      else if (e.key === "ArrowUp") { e.preventDefault(); const n = Math.max(0, idx - 1); btns.forEach(b => b.classList.remove("active")); if (btns[n]) btns[n].classList.add("active"); }
      else if (e.key === "Enter") { e.preventDefault(); const a = list.querySelector("button.active") || btns[0]; if (a) { setValue(a.dataset.iso); list.classList.remove("open"); } }
      else if (e.key === "Escape") list.classList.remove("open");
    });
    list.addEventListener("mousedown", (e) => {
      const btn = e.target.closest("button[data-iso]");
      if (!btn) return;
      e.preventDefault(); setValue(btn.dataset.iso); list.classList.remove("open");
    });
    document.addEventListener("click", (e) => { if (!input.contains(e.target) && !list.contains(e.target)) list.classList.remove("open"); });
    return { setValue, getValue: () => hidden.value };
  }

  let homePicker, destPicker;
  function populateSelects() {
    countriesSorted = DATA.countries.slice().sort((a, b) => a.name.localeCompare(b.name));
    homePicker = setupPicker("homeInput", "home", "homeList", { allowEmpty: false });
    destPicker = setupPicker("destInput", "dest", "destList", { allowEmpty: true, emptyLabel: "All countries" });
    if (byIso.IND) homePicker.setValue("IND", true);
    else if (byIso.USA) homePicker.setValue("USA", true);
    else if (countriesSorted[0]) homePicker.setValue(countriesSorted[0].iso3, true);
    if (byIso.USA) destPicker.setValue("USA", true);
    const regions = [...new Set(countriesSorted.map(c => c.region).filter(Boolean))].sort();
    const fr = el("fRegion");
    fr.innerHTML = '<option value="">All regions</option>';
    for (const r of regions) { const o = document.createElement("option"); o.value = r; o.textContent = r; fr.appendChild(o); }
  }
  function updateCurrencyHint() {
    const home = byIso[el("home").value];
    el("currencyHint").textContent = `Income is annual, in the home country's currency (${home ? home.currency : "LCU"}).`;
  }

  function readParams() {
    const q = new URLSearchParams(location.search);
    if (q.get("income")) {
      const n = parseIncome(q.get("income"));
      if (n > 0) {
        const homeIso = (q.get("home") && byIso[q.get("home")]) ? q.get("home") : el("home").value;
        const home = byIso[homeIso];
        el("income").value = formatIncomeInput(n, home && home.currency, homeIso);
      }
    } else {
      try {
        const saved = localStorage.getItem("kingindex-income");
        if (saved) {
          const n = parseIncome(saved);
          if (n > 0) {
            const home = byIso[el("home").value];
            el("income").value = formatIncomeInput(n, home && home.currency, home && home.iso3);
          }
        }
      } catch (_) {}
    }
    if (q.get("type") === "gross" || q.get("type") === "net") el("itype").value = q.get("type");
    if (q.get("home") && byIso[q.get("home")]) homePicker.setValue(q.get("home"), true);
    if (q.has("dest")) { const d = q.get("dest"); if (d === "" || byIso[d]) destPicker.setValue(d, true); }
    if (q.get("household_size")) {
      const hs = parseInt(q.get("household_size"), 10);
      if (hs >= 1 && hs <= 20) el("household").value = String(hs);
    }
  }
  function writeParamsDebounced() { clearTimeout(urlTimer); urlTimer = setTimeout(writeParams, 400); }
  function writeParams() {
    const q = new URLSearchParams();
    const incomeLocal = parseIncome(el("income").value);
    q.set("income", String(incomeLocal > 0 ? Math.round(incomeLocal) : ""));
    q.set("home", el("home").value);
    q.set("type", el("itype").value);
    if (el("dest").value) q.set("dest", el("dest").value);
    const hs = householdSize();
    if (hs !== 1) q.set("household_size", String(hs));
    history.replaceState(null, "", location.pathname + "?" + q.toString());
  }
  function clampIncome(n) {
    let clamped = false, v = n;
    if (v < INCOME_MIN) { v = INCOME_MIN; clamped = true; }
    if (v > INCOME_MAX) { v = INCOME_MAX; clamped = true; }
    return { value: v, clamped };
  }
  function incomeToSlider(n) {
    const lo = Math.log(INCOME_MIN), hi = Math.log(INCOME_MAX);
    return Math.round(1000 * (Math.log(Math.max(INCOME_MIN, Math.min(INCOME_MAX, n))) - lo) / (hi - lo));
  }
  function sliderToIncome(v) {
    const lo = Math.log(INCOME_MIN), hi = Math.log(INCOME_MAX);
    return Math.exp(lo + (v / 1000) * (hi - lo));
  }
  function setupSliderTicks(home) {
    const ticks = el("sliderTicks");
    if (!ticks) return;
    const loc = localeForCurrency(home && home.currency, home && home.iso3);
    ticks.innerHTML = [INCOME_MIN, 10000, 100000, 1000000, INCOME_MAX]
      .map(v => `<span>${Math.round(v).toLocaleString(loc)}</span>`).join("");
  }
  function syncSliderFromIncome(n, home) {
    if (!el("incomeSlider")) return;
    sliderSyncing = true;
    el("incomeSlider").value = String(incomeToSlider(n));
    el("sliderValue").textContent = formatIncomeInput(n, home && home.currency, home && home.iso3)
      + (home && home.currency ? " " + home.currency : "");
    sliderSyncing = false;
  }

  function computeRow(home, dest, incomeLocal, hh) {
    const reliable = isReliablePli(home) && isReliablePli(dest);
    const excluded = !!(dest.excluded || home.excluded);
    const income_per_capita = incomeLocal / hh;
    const your_ppp_income = income_per_capita / home.ppp;
    const household_ppp = incomeLocal / home.ppp;
    let multiple = null;
    if (reliable && hasMedian(dest) && Number.isFinite(your_ppp_income)) {
      multiple = your_ppp_income / dest.median_ppp_annual;
      if (!Number.isFinite(multiple)) multiple = null;
    }
    let equiv = null, fxLocal = null, costPct = null;
    if (reliable) {
      equiv = household_ppp * dest.ppp;
      fxLocal = (incomeLocal / home.fx) * dest.fx;
      costPct = (dest.pli_us / home.pli_us - 1) * 100;
      if (!Number.isFinite(equiv)) equiv = null;
      if (!Number.isFinite(fxLocal)) fxLocal = null;
      if (!Number.isFinite(costPct)) costPct = null;
    }
    const p = (reliable && dest.mean_income_ppp && dest.gini)
      ? localPercentile(household_ppp, dest.mean_income_ppp, dest.gini) : null;
    const band = bandFromP(p);
    const reason = dest.exclude_reason
      || (!hasMedian(dest) ? "No PIP median" : null)
      || (!isReliablePli(dest) ? "Unreliable PLI / PPP / FX" : null);
    return {
      iso3: dest.iso3, name: dest.name, region: dest.region, currency: dest.currency,
      pli: reliable ? dest.pli_us * 100 : null, pli_us: dest.pli_us,
      multiple, equiv, fxLocal, costPct, pct: p, band: band.key, bandLabel: band.label,
      survey_year: dest.survey_year, welfare_type: dest.welfare_type,
      year: dest.ppp_year, median_ppp_annual: dest.median_ppp_annual,
      cheaper: reliable ? dest.pli_us < home.pli_us : false,
      reliable: reliable && !excluded, excluded, reason,
      plottable: isPlottable(dest) && isReliablePli(home),
    };
  }

  function buildCopySummary({ incomeLocal, home, itype, hh, homeMult, destRow }) {
    const lead = `${fmtIncomeLead(incomeLocal, home.currency, home.iso3)} ${itype}`;
    const parts = [`${lead} · ${home.name} → ${destRow ? destRow.name : "world"}`];
    if (hh !== 1) parts.push(`household ${hh}`);
    if (homeMult != null) parts.push(`Home ${fmtMultiple(homeMult)} median`);
    if (destRow && destRow.multiple != null) {
      parts.push(`Dest ${fmtMultiple(destRow.multiple)} median`);
      if (destRow.costPct != null && Number.isFinite(destRow.costPct) && Math.abs(destRow.costPct) >= 0.5) {
        parts.push(destRow.costPct > 0 ? `${Math.round(destRow.costPct)}% more expensive` : `${Math.round(-destRow.costPct)}% less expensive`);
      }
      parts.push(`PPP equiv ${fmtMoney(destRow.equiv, destRow.currency, destRow.iso3)}`);
      if (destRow.fxLocal != null) parts.push(`FX ${fmtMoney(destRow.fxLocal, destRow.currency, destRow.iso3)}`);
      if (destRow.welfare_type || destRow.survey_year != null) {
        parts.push(`PIP ${destRow.welfare_type || "?"} ${destRow.survey_year != null ? Math.round(destRow.survey_year) : ""}`.trim());
      }
    }
    return parts.join(" · ");
  }

  function recompute(opts) {
    opts = opts || {};
    if (!DATA) return;
    clearError();
    let incomeLocal = parseIncome(el("income").value);
    const home = byIso[el("home").value];
    if (!home) { showError("Select a home country."); return; }
    if (!(incomeLocal > 0)) { showError("Enter a positive annual income."); return; }
    if (!isReliablePli(home)) { showError("Home country has unreliable price data. Pick another."); return; }
    const clamped = clampIncome(incomeLocal);
    incomeLocal = clamped.value;
    el("clampNotice").textContent = clamped.clamped
      ? `Income clamped to ${formatIncomeInput(incomeLocal, home.currency, home.iso3)} ${home.currency} (slider range).` : "";
    if (opts.formatIncome !== false) el("income").value = formatIncomeInput(incomeLocal, home.currency, home.iso3);
    try { localStorage.setItem("kingindex-income", String(Math.round(incomeLocal))); } catch (_) {}
    updateCurrencyHint(); writeParamsDebounced(); setupSliderTicks(home); syncSliderFromIncome(incomeLocal, home);
    const hh = householdSize();
    const itype = el("itype").value === "gross" ? "gross" : "net";
    const your_ppp = (incomeLocal / hh) / home.ppp;
    const homeMult = hasMedian(home) ? your_ppp / home.median_ppp_annual : null;

    el("homeCard").innerHTML = `
      <h2>Home · ${escapeHtml(home.name)}</h2>
      <div class="metric"><div class="k">Income (local)</div><div class="v">${fmtMoney(incomeLocal, home.currency, home.iso3)}</div>
        <div class="s">${itype}${hh !== 1 ? ` · household ${hh}` : ""}</div></div>
      <div class="metric"><div class="k">Per-capita PPP</div><div class="v">about $${fmtInt(your_ppp)} Int$</div>
        <div class="s">income ÷ ${hh} ÷ PPP</div></div>
      <div class="metric"><div class="k">× home median</div><div class="v">${fmtMultiple(homeMult)}</div>
        <div class="s">${home.welfare_type || "—"} · PIP ${home.survey_year != null ? Math.round(home.survey_year) : "—"} · median $${fmtInt(home.median_ppp_annual)}/yr</div></div>
      <div class="metric"><div class="k">Price level vs US</div><div class="v">${fmtInt(home.pli_us * 100)} <span style="color:var(--muted);font-size:0.8rem;font-weight:400">(US=100)</span></div>
        <div class="s">${priceLevelVsUS(home.pli_us) || ""}</div></div>`;

    rowsCache = DATA.countries.map(c => computeRow(home, c, incomeLocal, hh));
    const destIso = el("dest").value;
    let destRow = null;
    if (destIso && byIso[destIso]) {
      const dest = byIso[destIso];
      const r = computeRow(home, dest, incomeLocal, hh);
      destRow = r;
      if (!r.reliable && !hasMedian(dest)) {
        el("destCard").innerHTML = `<h2>Destination · ${escapeHtml(dest.name)}</h2>
          <div class="metric"><div class="s muted">${escapeHtml(r.reason || "Unreliable or missing data.")}</div></div>`;
      } else {
        const cv = costVsHome(home.pli_us, dest.pli_us);
        el("destCard").innerHTML = `
          <h2>Destination · ${escapeHtml(dest.name)}</h2>
          <div class="metric"><div class="k">× local median</div><div class="v" style="font-size:1.35rem">${fmtMultiple(r.multiple)}</div>
            <div class="s">${r.welfare_type || "—"} · PIP ${r.survey_year != null ? Math.round(r.survey_year) : "—"} · median $${fmtInt(r.median_ppp_annual)}/yr</div></div>
          <div class="metric"><div class="k">PPP equivalent (household)</div><div class="v">${fmtMoney(r.equiv, dest.currency, dest.iso3)}</div>
            <div class="s">Same PPP lifestyle</div></div>
          <div class="metric"><div class="k">FX / wire-transfer view</div><div class="v" style="font-size:1rem">${fmtMoney(r.fxLocal, dest.currency, dest.iso3)}</div>
            <div class="s">If you just convert cash</div></div>
          <div class="metric"><div class="k">Cost vs home</div><div class="v" style="font-size:1rem;font-weight:600">${escapeHtml(cv.primary || "—")}</div>
            <div class="s">${priceLevelDest(dest.pli_us, home.pli_us) || ""}</div></div>`;
      }
    } else {
      el("destCard").innerHTML = `<h2>Destination</h2>
        <div class="metric"><div class="s">Pick a destination to see × median, PPP equivalent, FX, and cost vs home — or browse the table / lab map below.</div></div>`;
    }

    const lead = `${fmtIncomeLead(incomeLocal, home.currency, home.iso3)} ${itype}`;
    let headline = `${lead} in ${home.name}`;
    if (hh !== 1) headline += ` (household ${hh})`;
    headline += homeMult != null ? ` is ${fmtMultiple(homeMult)} the home median` : "";
    if (destRow && destRow.multiple != null) {
      const cv = costVsHome(home.pli_us, destRow.pli_us);
      const costBit = cv.pct == null ? "" :
        (Math.abs(cv.pct) < 0.5 ? "; costs about the same as home" :
         cv.pct > 0 ? `; costs ${Math.round(cv.pct)}% more than home` :
         `; costs ${Math.round(-cv.pct)}% less than home`);
      headline += `. In ${destRow.name}: ${fmtMultiple(destRow.multiple)} local median${costBit}.`;
    } else headline += ".";
    el("summaryText").textContent = headline;
    lastCopyText = buildCopySummary({ incomeLocal, home, itype, hh, homeMult, destRow });

    const plotRows = rowsCache.filter(r => r.plottable && r.multiple != null && Number.isFinite(r.multiple));
    const above = plotRows.filter(r => r.multiple >= 1).length;
    el("aboveTypical").textContent = `Above typical (≥1× median) in ${above} of ${plotRows.length} plottable countries.`;
    if (destRow && destRow.multiple != null) {
      const cv = costVsHome(home.pli_us, destRow.pli_us);
      const costBit = cv.pct == null ? "" :
        (Math.abs(cv.pct) < 0.5 ? "about the same cost as home" :
         cv.pct > 0 ? `${Math.round(cv.pct)}% more expensive than home` :
         `${Math.round(-cv.pct)}% less expensive than home`);
      el("liveLine").innerHTML = `<strong>${escapeHtml(destRow.name)}</strong>: ${fmtMultiple(destRow.multiple)} median`
        + (costBit ? ` · ${costBit}` : "") + ` · Above typical in ${above} of ${plotRows.length}`;
    } else {
      el("liveLine").textContent = `Above typical in ${above} of ${plotRows.length} countries with reliable PLI + PIP median.`;
    }
    renderScatter(home, destIso);
    renderTable();
    el("results").classList.remove("hidden");
  }

  function filteredRows() {
    const region = el("fRegion").value, bandF = el("fBand").value;
    const search = (el("fSearch").value || "").trim().toLowerCase();
    const cheaper = el("fCheaper").checked, showAll = el("fShowAll").checked;
    return rowsCache.filter(r => {
      if (!r.reliable && !showAll) return false;
      if (region && r.region !== region) return false;
      if (cheaper && !r.cheaper) return false;
      if (bandF && r.band !== bandF) return false;
      if (search && !(`${r.name} ${r.iso3}`.toLowerCase().includes(search))) return false;
      return true;
    });
  }

  function renderTable() {
    let rows = filteredRows();
    const destIso = el("dest").value;
    rows.sort((a, b) => {
      if (a.reliable !== b.reliable) return a.reliable ? -1 : 1;
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === "band") { av = bandRank(a.band); bv = bandRank(b.band); }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return sortDir * av.localeCompare(bv);
      return sortDir * (av - bv);
    });
    document.querySelectorAll("thead th").forEach(th => th.classList.toggle("sorted", th.dataset.sort === sortKey));
    const tb = el("tbody");
    tb.innerHTML = rows.map(r => {
      const selected = destIso && r.iso3 === destIso ? " row-selected" : "";
      const unreliable = !r.reliable;
      const barW = r.pli != null ? Math.min(100, (r.pli / 160) * 100) : 0;
      const costCell = unreliable || r.costPct == null || !Number.isFinite(r.costPct)
        ? `<span class="muted" title="${escapeHtml(r.reason || "")}">${r.reason ? escapeHtml(r.reason) : "—"}</span>`
        : (Math.abs(r.costPct) < 0.5 ? "≈0%" : (r.costPct > 0 ? `+${Math.round(r.costPct)}%` : `${Math.round(r.costPct)}%`));
      const multCell = (r.multiple == null || !Number.isFinite(r.multiple)) ? '<span class="muted">—</span>' : fmtMultiple(r.multiple);
      const pliCell = unreliable || r.pli == null ? '<span class="muted">—</span>'
        : `<span class="pli-bar"><span class="fill" style="width:${barW}%"></span><span class="tick"></span></span>${fmtInt(r.pli)}`;
      const tip = [r.welfare_type, r.survey_year != null ? "PIP " + Math.round(r.survey_year) : null, r.reason].filter(Boolean).join(" · ");
      return `<tr class="row-${r.band}${selected}${unreliable ? " row-unreliable" : ""}" title="${escapeHtml(tip)}">
        <td>${escapeHtml(r.name)}<span class="iso">${r.iso3}</span></td>
        <td>${pliCell}</td><td>${costCell}</td><td>${multCell}</td>
        <td>${unreliable ? "—" : fmtMoney(r.equiv, r.currency, r.iso3)}</td>
        <td>${unreliable || r.fxLocal == null ? "—" : fmtMoney(r.fxLocal, r.currency, r.iso3)}</td>
        <td>${r.survey_year != null ? Math.round(r.survey_year) : "—"}</td>
        <td>${unreliable ? '<span class="muted">—</span>' : `<span class="band-pill band-${r.band}">${r.band === "King" ? "Locally king" : r.band === "Normal" ? "Normal local life" : r.band}</span>`}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="8" style="color:var(--muted);padding:16px">No countries match filters.</td></tr>`;
  }

  const REGION_COLORS = {
    "South Asia": "#e67e22", "East Asia & Pacific": "#3498db", "Europe & Central Asia": "#9b59b6",
    "Latin America & Caribbean": "#1abc9c", "Latin America & Caribbean ": "#1abc9c",
    "Middle East & North Africa": "#e74c3c", "Middle East, North Africa, Afghanistan & Pakistan": "#e74c3c",
    "North America": "#2c3e50", "Sub-Saharan Africa": "#27ae60", "Sub-Saharan Africa ": "#27ae60",
  };
  function regionColor(r) {
    if (!r) return "#7f8c8d";
    if (REGION_COLORS[r]) return REGION_COLORS[r];
    const key = Object.keys(REGION_COLORS).find(k => r.trim() === k.trim() || r.includes(k.trim()));
    return key ? REGION_COLORS[key] : "#7f8c8d";
  }

  function renderScatter(home, destIso) {
    const host = el("scatter"), tip = el("labTooltip");
    if (!host || typeof d3 === "undefined") return;
    host.innerHTML = "";
    const pts = rowsCache.filter(r =>
      r.plottable && r.multiple != null && Number.isFinite(r.multiple) && r.multiple > 0
      && r.pli != null && Number.isFinite(r.pli) && r.pli > 0
    ).map(r => ({ ...r, multPlot: Math.min(MULT_CAP, Math.max(0.05, r.multiple)) }));
    const width = host.clientWidth || 800, height = host.clientHeight || 400;
    const margin = { top: 28, right: 18, bottom: 44, left: 52 };
    const svg = d3.select(host).append("svg").attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);
    const x = d3.scaleLog().domain([5, 200]).range([margin.left, width - margin.right]).clamp(true);
    const y = d3.scaleLog().domain([0.05, MULT_CAP]).range([height - margin.bottom, margin.top]).clamp(true);
    const pops = pts.map(d => (byIso[d.iso3] && byIso[d.iso3].pop) || 1e6);
    const rScale = d3.scaleSqrt().domain([0, d3.max(pops) || 1]).range([3, 18]);
    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6, "~s")).selectAll("text").attr("fill", "var(--muted)");
    svg.append("g").attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6, "~s")).selectAll("text").attr("fill", "var(--muted)");
    svg.append("text").attr("x", width / 2).attr("y", height - 8).attr("text-anchor", "middle")
      .attr("fill", "var(--muted)").attr("font-size", 11).text("Price level (US=100, log)");
    svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 14)
      .attr("text-anchor", "middle").attr("fill", "var(--muted)").attr("font-size", 11)
      .text("× local median (log, capped 100×)");
    [1, 2, 5].forEach(v => {
      svg.append("line").attr("x1", margin.left).attr("x2", width - margin.right)
        .attr("y1", y(v)).attr("y2", y(v)).attr("stroke", "var(--border)").attr("stroke-dasharray", "4,3");
      svg.append("text").attr("x", width - margin.right - 2).attr("y", y(v) - 3)
        .attr("text-anchor", "end").attr("fill", "var(--muted)").attr("font-size", 10).text(v + "×");
    });
    svg.append("text").attr("x", margin.left + 6).attr("y", margin.top + 12).attr("fill", "var(--muted)").attr("font-size", 10).text("Cheap · high × median");
    svg.append("text").attr("x", width - margin.right - 6).attr("y", margin.top + 12).attr("text-anchor", "end").attr("fill", "var(--muted)").attr("font-size", 10).text("Expensive · high × median");
    svg.append("text").attr("x", margin.left + 6).attr("y", height - margin.bottom - 8).attr("fill", "var(--muted)").attr("font-size", 10).text("Cheap · near/below median");
    svg.append("text").attr("x", width - margin.right - 6).attr("y", height - margin.bottom - 8).attr("text-anchor", "end").attr("fill", "var(--muted)").attr("font-size", 10).text("Expensive · near/below median");
    svg.append("g").selectAll("circle").data(pts).join("circle")
      .attr("cx", d => x(d.pli)).attr("cy", d => y(d.multPlot))
      .attr("r", d => rScale((byIso[d.iso3] && byIso[d.iso3].pop) || 1e6))
      .attr("fill", d => regionColor(d.region)).attr("fill-opacity", 0.55)
      .style("cursor", "pointer")
      .on("mouseenter", (event, d) => {
        tip.classList.remove("hidden");
        tip.innerHTML = `<strong>${escapeHtml(d.name)}</strong><br/>${fmtMultiple(d.multiple)} median · PLI ${fmtInt(d.pli)}<br/>${escapeHtml(d.welfare_type || "?")} · PIP ${d.survey_year != null ? Math.round(d.survey_year) : "—"}`;
        const rect = host.getBoundingClientRect();
        tip.style.left = (event.clientX - rect.left + 12) + "px";
        tip.style.top = (event.clientY - rect.top + 12) + "px";
      })
      .on("mouseleave", () => tip.classList.add("hidden"))
      .on("click", (event, d) => destPicker.setValue(d.iso3));
    function ring(iso, color) {
      const d = pts.find(p => p.iso3 === iso); if (!d) return;
      svg.append("circle").attr("cx", x(d.pli)).attr("cy", y(d.multPlot))
        .attr("r", rScale((byIso[d.iso3] && byIso[d.iso3].pop) || 1e6) + 4)
        .attr("fill", "none").attr("stroke", color).attr("stroke-width", 2.5);
    }
    if (home) ring(home.iso3, "var(--accent)");
    if (destIso) ring(destIso, "var(--gold)");
  }

  window.__kingSelftest = function () {
    const fails = [];
    if (!DATA) { console.log("FAIL: no data"); return false; }
    const usa = byIso.USA, ind = byIso.IND, bgd = byIso.BGD;
    if (!usa || usa.pli_us < 0.95 || usa.pli_us > 1.05) fails.push(`USA pli`);
    if (!ind || !(ind.pli_us < 0.40)) fails.push(`IND pli`);
    if (!bgd || !hasMedian(bgd)) fails.push("BGD median");
    if (ind && bgd) {
      const mult = (800000 / ind.ppp) / bgd.median_ppp_annual;
      if (!(mult > 10 && mult < 30)) fails.push(`mult ${mult}`);
    }
    for (const c of DATA.countries) {
      if (!isPlottable(c) || !ind) continue;
      const m = (800000 / ind.ppp) / c.median_ppp_annual;
      if (!Number.isFinite(m)) fails.push(`Inf ${c.iso3}`);
    }
    if (fails.length) { console.log("FAIL", fails); return false; }
    console.log("PASS"); return true;
  };
  window.__kingHelpers = { isReliable, isPlottable, costVsHome, hasMedian, parseIncome, computeRow };

  async function loadData() {
    try {
      const res = await fetch("./data/countries.json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      DATA = await res.json();
    } catch (e) { showError("Drop data/countries.json next to index.html"); return; }
    byIso = {};
    for (const c of DATA.countries) byIso[c.iso3] = c;
    populateSelects(); readParams(); updateCurrencyHint();
    const withMed = DATA.countries.filter(hasMedian).length;
    const plottable = DATA.countries.filter(isPlottable).length;
    const excluded = DATA.countries.filter(c => c.excluded).length;
    el("metaNote").textContent =
      `Snapshot: ${DATA.meta.generated_at} · ${DATA.countries.length} countries · ${withMed} with PIP median · ${plottable} on plot · ${excluded} excluded · ${DATA.meta.source}`;
    recompute();
  }

  function onFieldChange() { recompute(); }
  el("income").addEventListener("change", () => recompute({ formatIncome: true }));
  el("income").addEventListener("input", () => recompute({ formatIncome: false }));
  el("itype").addEventListener("change", onFieldChange);
  el("home").addEventListener("change", () => { updateCurrencyHint(); onFieldChange(); });
  el("dest").addEventListener("change", onFieldChange);
  el("rankBtn").addEventListener("click", recompute);
  el("household").addEventListener("change", onFieldChange);
  el("household").addEventListener("input", onFieldChange);
  el("hhMinus").addEventListener("click", () => { el("household").value = String(Math.max(1, householdSize() - 1)); onFieldChange(); });
  el("hhPlus").addEventListener("click", () => { el("household").value = String(Math.min(20, householdSize() + 1)); onFieldChange(); });
  el("incomeSlider").addEventListener("input", () => {
    if (sliderSyncing) return;
    const home = byIso[el("home").value];
    const n = Math.round(sliderToIncome(parseInt(el("incomeSlider").value, 10)));
    el("income").value = formatIncomeInput(n, home && home.currency, home && home.iso3);
    recompute({ formatIncome: false });
  });
  ["fRegion", "fBand", "fCheaper", "fShowAll"].forEach(id => el(id).addEventListener("change", renderTable));
  el("fSearch").addEventListener("input", renderTable);
  document.querySelectorAll("thead th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const k = th.dataset.sort;
      if (sortKey === k) sortDir *= -1;
      else { sortKey = k; sortDir = (k === "name" || k === "band") ? 1 : -1; }
      renderTable();
    });
  });
  el("copyBtn").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(lastCopyText || el("summaryText").textContent); el("copyBtn").textContent = "Copied"; setTimeout(() => { el("copyBtn").textContent = "Copy summary"; }, 1200); }
    catch (_) { el("copyBtn").textContent = "Copy failed"; }
  });
  el("copyUrlBtn").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); el("copyUrlBtn").textContent = "Link copied"; setTimeout(() => { el("copyUrlBtn").textContent = "Copy link"; }, 1200); }
    catch (_) { el("copyUrlBtn").textContent = "Copy failed"; }
  });

  function applyTheme(theme) {
    if (theme !== "light" && theme !== "dark") theme = "light";
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("kingindex-theme", theme); } catch (_) {}
    const btn = el("themeToggle");
    if (btn) {
      const next = theme === "dark" ? "light" : "dark";
      btn.setAttribute("aria-label", "Switch to " + next + " theme");
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      const icon = btn.querySelector(".theme-icon"), label = btn.querySelector(".theme-label");
      if (icon) icon.textContent = theme === "dark" ? "☀" : "☾";
      if (label) label.textContent = theme === "dark" ? "Light" : "Dark";
    }
  }
  (function initTheme() {
    let t = "light";
    try { const saved = localStorage.getItem("kingindex-theme"); if (saved === "light" || saved === "dark") t = saved; } catch (_) {}
    applyTheme(t);
  })();
  el("themeToggle").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    applyTheme(cur === "dark" ? "light" : "dark");
  });
  window.addEventListener("resize", () => {
    if (!DATA) return;
    const home = byIso[el("home").value];
    if (home) renderScatter(home, el("dest").value);
  });
  loadData();
})();
