#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const DATA = JSON.parse(fs.readFileSync(path.join(root, "data/countries.json"), "utf8"));
const HTML = fs.readFileSync(path.join(root, "index.html"), "utf8");
const byIso = Object.fromEntries(DATA.countries.map(c => [c.iso3, c]));

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
  if (!(pppIncome > 0) || !(meanIncome > 0)) return null;
  const sigma = sigmaFromGini(giniIndex);
  const mu = Math.log(meanIncome) - (sigma * sigma) / 2;
  const z = (Math.log(pppIncome) - mu) / sigma;
  let p = normCdf(z) * 100;
  return Math.max(0.1, Math.min(99.9, p));
}
function bandFromP(p) {
  if (p == null) return { key: "—", label: "—" };
  if (p < 40) return { key: "Stretched", label: "Stretched" };
  if (p < 70) return { key: "Normal", label: "Normal local life" };
  if (p < 90) return { key: "Comfortable", label: "Comfortable" };
  if (p < 99) return { key: "Affluent", label: "Affluent" };
  return { key: "King", label: "Locally king" };
}
function topLabel(p) {
  if (p == null) return "—";
  const top = Math.max(0.1, 100 - p);
  const shown = top >= 10 ? Math.round(top) : Math.round(top * 10) / 10;
  return `est. top ${shown}%`;
}
function isReliable(c) {
  return Number.isFinite(c.pli_us) && c.pli_us >= 0.05
    && Number.isFinite(c.ppp) && c.ppp > 0
    && Number.isFinite(c.fx) && c.fx > 0;
}
function costVsHome(homePli, destPli) {
  if (!(homePli > 0) || !(destPli > 0) || !Number.isFinite(homePli) || !Number.isFinite(destPli)) {
    return { buyingPower: null, stretch: null, primary: null, pct: null };
  }
  const priceRatio = destPli / homePli;
  const stretch = homePli / destPli;
  const buyingPower = stretch; // public secondary = home/dest
  const pct = (priceRatio - 1) * 100;
  let primary;
  if (Math.abs(pct) < 0.5) primary = "Same lifestyle costs about the same as at home.";
  else if (pct > 0) primary = `Same lifestyle costs ${Math.round(pct)}% more than at home.`;
  else primary = `Same lifestyle costs ${Math.round(-pct)}% less than at home.`;
  return { buyingPower, stretch, primary, pct };
}

const fails = [];
const income = 800000;
const home = byIso.IND;
const dest = byIso.BGD;
if (!home || !dest) fails.push("missing IND or BGD");

const pppIncome = income / home.ppp;
const homeP = localPercentile(pppIncome, home.mean_income_ppp, home.gini);
const destP = localPercentile(pppIncome, dest.mean_income_ppp, dest.gini);
const homeBand = bandFromP(homeP);
const destBand = bandFromP(destP);
const cv = costVsHome(home.pli_us, dest.pli_us);

const expectedBP = home.pli_us / dest.pli_us;
if (!(Math.abs(cv.buyingPower - expectedBP) < 1e-12)) {
  fails.push(`buyingPower ${cv.buyingPower} != home/dest ${expectedBP}`);
}
const expectedCostPct = (dest.pli_us / home.pli_us - 1) * 100;
if (!(Math.abs(cv.pct - expectedCostPct) < 1e-9)) {
  fails.push(`cost pct ${cv.pct} != ${expectedCostPct}`);
}
if (!cv.primary.includes("more than at home")) {
  fails.push(`expected more-expensive primary, got: ${cv.primary}`);
}

for (const c of DATA.countries) {
  if (!isReliable(c) || !isReliable(home)) continue;
  const stretch = home.pli_us / c.pli_us;
  if (!Number.isFinite(stretch)) fails.push(`Infinity/NaN stretch for reliable ${c.iso3}`);
}

const ven = byIso.VEN;
if (!ven || !(ven.pli_us === 0)) fails.push("expected VEN pli 0");
if (isReliable(ven)) fails.push("VEN should be unreliable");

const reliable = DATA.countries.filter(isReliable);
const bandRank = { Stretched: 0, Normal: 1, Comfortable: 2, Affluent: 3, King: 4 };
const comfortPlus = reliable
  .map(c => {
    const p = localPercentile(pppIncome, c.mean_income_ppp, c.gini);
    return { iso3: c.iso3, pli_us: c.pli_us, band: bandFromP(p).key, p };
  })
  .filter(r => bandRank[r.band] >= 2)
  .sort((a, b) => a.pli_us - b.pli_us)
  .slice(0, 5);
const rank5 = reliable
  .map(c => ({ iso3: c.iso3, p: localPercentile(pppIncome, c.mean_income_ppp, c.gini) }))
  .sort((a, b) => (b.p || 0) - (a.p || 0))
  .slice(0, 5);
if (comfortPlus.some(r => r.iso3 === "VEN")) fails.push("VEN in cheapest 5");
if (rank5.some(r => r.iso3 === "VEN")) fails.push("VEN in rank 5");

const sentDest = `In ${dest.name} this is ${destBand.label} (${topLabel(destP)}).`;
if (/locally\s+Locally/i.test(sentDest)) fails.push(`duplicate band: ${sentDest}`);
if (homeBand.label !== "Locally king") fails.push(`home band ${homeBand.label}`);
if (destBand.label !== "Locally king") fails.push(`dest band ${destBand.label}`);
if (topLabel(homeP) !== "est. top 0.1%") fails.push(`home top ${topLabel(homeP)}`);
if (topLabel(destP) !== "est. top 0.3%") fails.push(`dest top ${topLabel(destP)}`);

// HTML greps
const bad = [
  [/less far/i, "less far"],
  [/locally \$\{/, "locally ${"],
  [/pctileLabel/, "pctileLabel"],
];
for (const [re, name] of bad) {
  if (re.test(HTML)) fails.push(`HTML contains ${name}`);
}
if (!/Buying power vs home:/.test(HTML)) fails.push("missing Buying power vs home label");
if (!/cv\.buyingPower/.test(HTML)) fails.push("secondary should use buyingPower (dest/home)");
if (!/>Compare</.test(HTML)) fails.push("Compare button missing");
if (!/twitter:card" content="summary"/.test(HTML)) fails.push("twitter:card missing");

if (fails.length) {
  console.error("FAIL");
  fails.forEach(f => console.error(" -", f));
  process.exit(1);
}
console.log("PASS");
console.log({
  buyingPower: cv.buyingPower,
  stretch: cv.stretch,
  primary: cv.primary,
  sentDest,
  cheap5: comfortPlus.map(r => r.iso3),
  rank5: rank5.map(r => r.iso3),
});
