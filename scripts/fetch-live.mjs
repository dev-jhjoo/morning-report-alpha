import { readFileSync, writeFileSync } from "fs";

// prices.csv에서 모든 심볼 추출 (KR: .KS, US: 그 외)
const csv = readFileSync("data/prices.csv", "utf8");
const symbols = [...new Set(
  csv.split("\n").slice(1)
    .map(l => l.split(",")[2]?.trim())
    .filter(Boolean)
)];

async function fetchPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const meta = (await r.json())?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) return null;
  return {
    price: meta.regularMarketPrice,
    change: meta.regularMarketChange ?? null,
    changePct: meta.regularMarketChangePercent ?? null,
    currency: meta.currency ?? "",
  };
}

const result = { ts: new Date().toISOString(), prices: {} };
for (const sym of symbols) {
  try {
    const d = await fetchPrice(sym);
    if (d) result.prices[sym] = d;
    console.log(`✅ ${sym}:`, d?.price ?? "null");
  } catch (e) {
    console.error(`❌ ${sym}:`, e.message);
  }
}

writeFileSync("data/live_prices.json", JSON.stringify(result, null, 2));
console.log(`완료: ${Object.keys(result.prices).length}/${symbols.length}개 저장`);
