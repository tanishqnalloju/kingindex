#!/usr/bin/env node
"use strict";
/**
 * Parity (production): IND ₹800k net → BGD, household_size=1
 * Expected from baked snapshot:
 *   PPP equiv ~1,408,973 BDT
 *   FX ~1,119,073 BDT
 *   cost ~+25.9%
 *   × median ~17.89
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

const EXPECTED = {
  ppp_equiv_BDT: 1408973,
  fx_BDT: 1119073,
  cost_pct_vs_home: 25.9,
  multiple_of_BGD_median: 17.89,
};

function loadCountries(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error("missing " + rel);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function compute(DATA) {
  const byIso = Object.fromEntries(DATA.countries.map(c => [c.iso3, c]));
  const home = byIso.IND, dest = byIso.BGD;
  if (!home || !dest) throw new Error("missing IND/BGD");
  const income = 800000, hh = 1;
  const your_ppp = (income / hh) / home.ppp;
  const multiple = your_ppp / dest.median_ppp_annual;
  const equiv = (income / home.ppp) * dest.ppp;
  const fx = (income / home.fx) * dest.fx;
  const costPct = (dest.pli_us / home.pli_us - 1) * 100;
  return {
    ppp_equiv_BDT: Math.round(equiv),
    fx_BDT: Math.round(fx),
    cost_pct_vs_home: Math.round(costPct * 10) / 10,
    multiple_of_BGD_median: Math.round(multiple * 100) / 100,
    welfare_type: dest.welfare_type,
    survey_year: dest.survey_year,
  };
}

function assertHtml(rel, expectedCanonPath) {
  const html = fs.readFileSync(path.join(root, rel), "utf8");
  const fails = [];
  if (/Comfortable\+|Affluent\+/.test(html)) fails.push(rel + ": cumulative band filters");
  if (/Stretch vs home/i.test(html)) fails.push(rel + ": stretch label");
  if (!/Lab: × median map/.test(html)) fails.push(rel + ": missing lab section");
  if (/noindex/i.test(html)) fails.push(rel + ": must not be noindex on production");
  if (!/index,\s*follow/i.test(html)) fails.push(rel + ": missing index,follow");
  const canonRe = new RegExp("canonical[^>]+" + expectedCanonPath.replace(/\//g, "\\/"));
  if (!canonRe.test(html)) fails.push(rel + ": canonical should be " + expectedCanonPath);
  if (!fs.existsSync(path.join(root, path.dirname(rel), "app.js"))) fails.push(rel + ": missing app.js");
  if (/Staging/i.test(html)) fails.push(rel + ": staging copy left in HTML");
  return fails;
}

const dataPaths = [
  "public/data/countries.json",
  "public/1/data/countries.json",
  "public/2/data/countries.json",
  "public/3/data/countries.json",
];
const fails = [];
let numbers = null;

for (const dp of dataPaths) {
  const got = compute(loadCountries(dp));
  numbers = got;
  for (const [k, v] of Object.entries(EXPECTED)) {
    if (got[k] !== v) fails.push(`${dp}: ${k} got ${got[k]} expected ${v}`);
  }
}

fails.push(...assertHtml("public/1/index.html", "https://kingindex.tanishqnalloju.com/1/"));
fails.push(...assertHtml("public/2/index.html", "https://kingindex.tanishqnalloju.com/2/"));
fails.push(...assertHtml("public/3/index.html", "https://kingindex.tanishqnalloju.com/3/"));

const chooser = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
if (!chooser.includes('href="/1/"') || !chooser.includes('href="/2/"') || !chooser.includes('href="/3/"')) fails.push("chooser missing /1 /2 /3 links");
if (/noindex|Staging/i.test(chooser)) fails.push("chooser still staging/noindex");
if (!/index,\s*follow/i.test(chooser)) fails.push("chooser missing index,follow");

const robots = fs.readFileSync(path.join(root, "public/robots.txt"), "utf8");
if (/Disallow:\s*\//.test(robots)) fails.push("robots.txt Disallow:/");
if (!/Allow:\s*\//.test(robots)) fails.push("robots.txt missing Allow:/");

const wrangler = fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
if (!/"name":\s*"ppp-index-calculator"/.test(wrangler)) fails.push("wrangler name must remain ppp-index-calculator");
if (/"name":\s*"kingindex-v2"/.test(wrangler)) fails.push("prod wrangler must not be kingindex-v2");

const html3 = fs.readFileSync(path.join(root, "public/3/index.html"), "utf8");
if (!/kingindex-v2-3-theme/.test(html3)) fails.push("/3: missing theme key");
if (/id="themeSelect"/.test(html3)) fails.push("/3: must not ship themeSelect system UI");
if (!/id="themeToggle"/.test(html3)) fails.push("/3: missing themeToggle");
if (!/Phosphor|oscilloscope|scope/i.test(html3)) fails.push("/3: missing phosphor scope chrome");
if (!fs.existsSync(path.join(root, "public/3/scope.js"))) fails.push("/3: missing scope.js");

const worker = fs.readFileSync(path.join(root, "src/worker.js"), "utf8");
if (!/ppp-index-calculator\.tanishqnalloju\.com/.test(worker)) fails.push("worker missing OLD_HOST redirect");
if (!/kingindex\.tanishqnalloju\.com/.test(worker)) fails.push("worker missing NEW_HOST");
if (!/301/.test(worker)) fails.push("worker missing 301");

if (fails.length) {
  console.error("FAIL");
  fails.forEach(f => console.error(" -", f));
  process.exit(1);
}
console.log("PASS");
console.log({ expected: EXPECTED, got: numbers, paths: ["/1/", "/2/", "/3/"] });
