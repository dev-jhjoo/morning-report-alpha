import { readFileSync, writeFileSync } from "fs";

// prices.csv에서 모든 심볼 추출 (KR: .KS, US: 그 외)
const csv = readFileSync("data/prices.csv", "utf8");
const symbols = [...new Set(
  csv.split("\n").slice(1)
    .map(l => l.split(",")[2]?.trim())
    .filter(Boolean)
)];

async function fetchPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=1d`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const result = (await r.json())?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta?.regularMarketPrice) return null;

  // 전일 종가를 closes 배열에서 직접 계산 (meta.regularMarketChange가 null인 경우 대비)
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const validCloses = closes.filter(c => c != null);
  const prevClose = validCloses.length >= 2 ? validCloses[validCloses.length - 2] : null;
  const price = meta.regularMarketPrice;
  const change = prevClose != null ? +(price - prevClose).toFixed(4) : null;
  const changePct = prevClose != null ? +((price - prevClose) / prevClose * 100).toFixed(4) : null;

  return { price, change, changePct, currency: meta.currency ?? "" };
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
