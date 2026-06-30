export interface PriceData {
  price: number; // 마지막 일봉 종가
  priceDate: string; // 그 종가의 실제 날짜 (YYYY-MM-DD, 거래소 현지 기준)
  currency: string;
}

// Yahoo chart 응답에서 마지막 유효 종가를 추출 (네트워크와 분리해 테스트 가능)
export function parseChart(json: any): PriceData | null {
  const r = json?.chart?.result?.[0];
  const closes: (number | null)[] | undefined =
    r?.indicators?.quote?.[0]?.close;
  const stamps: number[] | undefined = r?.timestamp;
  if (!r || !closes || !stamps) return null;

  // 뒤에서부터 null 아닌 첫 종가 (장중 미체결 봉 회피)
  for (let i = closes.length - 1; i >= 0; i--) {
    const c = closes[i];
    if (c != null) {
      return {
        price: Math.round(c * 100) / 100, // float 노이즈 제거 (소수 2자리)
        priceDate: new Date((stamps[i] ?? 0) * 1000).toISOString().slice(0, 10),
        currency: r.meta?.currency ?? "",
      };
    }
  }
  return null;
}

/**
 * Yahoo Finance에서 심볼의 최근 종가를 조회.
 * @param symbol 예: '005930.KS'(삼성전자), 'TSLA'
 */
export async function fetchClosePrice(symbol: string): Promise<PriceData | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=5d&interval=1d`;
  try {
    console.log(`💹 [${symbol}] 종가를 조회합니다...`);
    // User-Agent 없으면 Yahoo가 종종 403 → 브라우저처럼 위장
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseChart(await res.json());
  } catch (error) {
    console.error(`❌ [${symbol}] 주가 조회 실패:`, error);
    return null;
  }
}

// 직접 실행 시 self-check (파싱 로직만, 네트워크 불필요)
const isMain = process.argv[1] && process.argv[1].endsWith("price.ts");
if (isMain) {
  const sample = {
    chart: {
      result: [
        {
          meta: { currency: "KRW" },
          timestamp: [1719360000, 1719446400],
          indicators: { quote: [{ close: [80000, null] }] }, // 마지막 봉 미체결
        },
      ],
    },
  };
  const p = parseChart(sample)!;
  console.assert(p.price === 80000, "null 봉 건너뛰기 실패");
  console.assert(p.currency === "KRW", "통화 파싱 실패");
  console.assert(parseChart({}) === null, "빈 응답 처리 실패");
  console.log("self-check OK:", JSON.stringify(p));
}
