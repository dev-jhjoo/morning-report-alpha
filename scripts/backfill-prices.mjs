// 누락된 종가 백필: score.date별로 같은-일자 종가가 없는 US 종목을
// Yahoo 히스토리(range=3mo)에서 찾아 prices.csv에 append.
// Yahoo에 해당 날짜 종가가 없으면(휴장·주말) 조용히 skip → 정당한 공백은 그대로 둔다.
// 실행: node scripts/backfill-prices.mjs [--dry]
import * as fs from "fs";

const DRY = process.argv.includes("--dry");
const PRICE_PATH = "data/prices.csv";
const SCORE_PATH = "data/scores.csv";

function parseCSV(t) {
  const rows = []; let f = [], c = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { f.push(c); c = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; if (f.length || c) { f.push(c); rows.push(f); f = []; c = ""; } }
    else c += ch;
  }
  if (f.length || c) { f.push(c); rows.push(f); }
  const h = rows.shift();
  return rows.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}
const csvField = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

// Yahoo 3개월 일봉 → { "YYYY-MM-DD": {close, currency} }
async function yahooDailyCloses(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const r = (await res.json())?.chart?.result?.[0];
  const cl = r?.indicators?.quote?.[0]?.close, ts = r?.timestamp;
  const out = {};
  if (cl && ts) for (let i = 0; i < ts.length; i++) {
    if (cl[i] == null) continue;
    out[new Date(ts[i] * 1000).toISOString().slice(0, 10)] = { close: Math.round(cl[i] * 100) / 100, currency: r.meta?.currency ?? "" };
  }
  return out;
}

const scores = parseCSV(fs.readFileSync(SCORE_PATH, "utf8"));
const prices = parseCSV(fs.readFileSync(PRICE_PATH, "utf8"));
const symbolOf = {}, isUS = {};
for (const p of prices) { symbolOf[p.ticker] = p.symbol; isUS[p.ticker] = !p.symbol.endsWith(".KS"); }
const have = new Set(prices.map((p) => p.priceDate + "|" + p.ticker));

// 채워야 할 (ticker, date): US 종목이고 score.date에 같은-일자 종가가 없는 것
const need = {};
for (const s of scores) {
  if (!isUS[s.ticker]) continue;
  if (have.has(s.date + "|" + s.ticker)) continue;
  (need[s.ticker] = need[s.ticker] || []).push(s.date);
}

let appended = 0, skipped = 0;
const lines = [];
for (const ticker of Object.keys(need)) {
  const daily = await yahooDailyCloses(symbolOf[ticker]);
  for (const date of need[ticker]) {
    const hit = daily[date];
    if (!hit) { skipped++; console.log(`  skip ${ticker} ${date} (Yahoo에 종가 없음 — 휴장/주말)`); continue; }
    // 수집일(date 칼럼)은 백필이라 종가일과 동일하게 기록. join은 priceDate 기준이라 무관.
    lines.push([date, ticker, symbolOf[ticker], hit.close, date, hit.currency].map(csvField).join(","));
    appended++;
    console.log(`  fill ${ticker} ${date} = ${hit.close} ${hit.currency}`);
  }
}

if (lines.length && !DRY) {
  fs.appendFileSync(PRICE_PATH, lines.join("\n") + "\n");
}
console.log(`\n${DRY ? "[DRY] " : ""}백필 완료: ${appended}건 추가, ${skipped}건 skip(정당한 공백)`);
