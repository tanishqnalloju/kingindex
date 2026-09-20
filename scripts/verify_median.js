#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const DATA = JSON.parse(fs.readFileSync(path.join(root, "data/countries.json"), "utf8"));
const byIso = Object.fromEntries(DATA.countries.map(c => [c.iso3, c]));
const fails = [];
const income = 800000, hh = 1;
const home = byIso.IND, dest = byIso.BGD;
if (!home || !dest) fails.push("missing IND/BGD");
if (!dest.median_ppp_annual) fails.push("BGD missing median");
const your_ppp = (income / hh) / home.ppp;
const multiple = your_ppp / dest.median_ppp_annual;
const equiv = (income / home.ppp) * dest.ppp;
const fx = (income / home.fx) * dest.fx;
const costPct = (dest.pli_us / home.pli_us - 1) * 100;
if (!(multiple > 10 && multiple < 30)) fails.push(`multiple ${multiple}`);
if (!(equiv > 1e6 && equiv < 2e6)) fails.push(`equiv ${equiv}`);
if (!(costPct > 20 && costPct < 35)) fails.push(`cost ${costPct}`);
const plottable = DATA.countries.filter(c =>
  Number.isFinite(c.pli_us) && c.pli_us >= 0.05 && c.ppp > 0 && c.fx > 0
  && Number.isFinite(c.median_ppp_annual) && c.median_ppp_annual > 0 && !c.excluded);
for (const c of plottable) {
  const m = your_ppp / c.median_ppp_annual;
  if (!Number.isFinite(m)) fails.push(`Inf ${c.iso3}`);
}
const excluded = DATA.countries.filter(c => c.excluded);
const HTML = fs.readFileSync(path.join(root, "index.html"), "utf8");
if (/Comfortable\+|Affluent\+/.test(HTML)) fails.push("cumulative band filters still present");
if (/Stretch vs home/i.test(HTML)) fails.push("public stretch label");
if (/Highest local rank/i.test(HTML)) fails.push("king rank tiles");
if (!/Lab: × median map/.test(HTML)) fails.push("missing lab section");
if (!fs.existsSync(path.join(root, "app.js"))) fails.push("missing app.js");
if (fails.length) { console.error("FAIL"); fails.forEach(f => console.error(" -", f)); process.exit(1); }
console.log("PASS");
console.log({
  ppp_equiv_BDT: Math.round(equiv),
  fx_BDT: Math.round(fx),
  cost_pct_vs_home: Math.round(costPct * 10) / 10,
  multiple_of_BGD_median: Math.round(multiple * 100) / 100,
  welfare_type: dest.welfare_type,
  survey_year: dest.survey_year,
  plottable: plottable.length,
  excluded: excluded.length,
  with_median: DATA.countries.filter(c => c.median_ppp_annual).length,
});
