import { fetchDailyNews } from "./scraper.js";
import { analyzeNews } from "./analyzer.js";
import { appendScore, appendPrice } from "./storage.js";
import { fetchClosePrice } from "./price.js";
import * as dotenv from "dotenv";

dotenv.config();

// 💡 분석할 관심 종목 → Yahoo Finance 심볼 매핑 (주가 수집용)
// 한국 종목은 6자리코드+.KS, 미국은 티커 그대로. 새 종목 추가 시 여기에 등록.
// 시장 구분은 심볼 접미사(.KS=한국)와 prices.csv의 currency(KRW/USD)로 파생됨 → 별도 메타 불필요.
const TARGET_TICKERS: Record<string, string> = {
  // 한국 시총 상위 10 (KRX)
  삼성전자: "005930.KS",
  SK하이닉스: "000660.KS",
  LG에너지솔루션: "373220.KS",
  삼성바이오로직스: "207940.KS",
  현대자동차: "005380.KS",
  기아: "000270.KS",
  셀트리온: "068270.KS",
  POSCO홀딩스: "005490.KS",
  KB금융: "105560.KS",
  삼성SDI: "006400.KS",
  // 미국 시총 상위 10 (NASDAQ/NYSE)
  Apple: "AAPL",
  NVIDIA: "NVDA",
  Microsoft: "MSFT",
  Amazon: "AMZN",
  Alphabet: "GOOGL",
  Meta: "META",
  Tesla: "TSLA",
  Broadcom: "AVGO",
  버크셔해서웨이: "BRK-B",
  JPMorgan: "JPM",
};

// 장 시작 1시간 전 국가별 발송: MARKET=KR|US 로 대상 종목을 거른다. 미지정이면 전체(수동 실행 대비).
// 시장 구분은 심볼 접미사(.KS=한국)로 파생 — TARGET_TICKERS에 별도 메타 없이 일관.
const MARKET = process.env.MARKET; // "KR" | "US" | undefined
function inMarket(symbol: string): boolean {
  if (!MARKET) return true;
  const isKR = symbol.endsWith(".KS");
  return MARKET === "KR" ? isKR : !isKR;
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// 4096자 한도 아래로 줄 경계에서 분할. 각 줄의 HTML 태그(<b>..</b> 등)는 줄 안에서 닫히므로 경계 분할이 안전.
function splitForTelegram(message: string, limit = 3900): string[] {
  const chunks: string[] = [];
  let cur = "";
  for (const line of message.split("\n")) {
    if (cur && cur.length + line.length + 1 > limit) {
      chunks.push(cur);
      cur = "";
    }
    cur += (cur ? "\n" : "") + line;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

async function sendTelegramMessage(message: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("❌ 텔레그램 환경 변수가 없습니다.");
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  // 텔레그램 단일 메시지 한도는 4096자 → 줄 경계로 안전하게 나눠 여러 번 발송(데이터 손실 없음)
  for (const chunk of splitForTelegram(message)) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: chunk,
          parse_mode: "HTML", // HTML 태그를 사용하여 예쁘게 꾸미기 위함
        }),
      });
      // fetch는 네트워크 오류만 throw → 텔레그램의 400/403({ok:false})은 여기서 직접 확인해야 함
      const body: any = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        console.error(
          `❌ 텔레그램 발송 실패 (HTTP ${res.status}): ${
            body.description ?? "(no description)"
          }`
        );
        return;
      }
    } catch (error) {
      console.error("❌ 텔레그램 발송 실패:", error);
      return;
    }
  }
  console.log("✅ 텔레그램 메시지 발송 완료!");
}

async function runMorningReport() {
  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
  });
  // 저장용 ISO 날짜 (YYYY-MM-DD, Asia/Seoul)
  const isoDate = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Seoul",
  });

  const targets = Object.entries(TARGET_TICKERS).filter(([, sym]) =>
    inMarket(sym)
  );

  // 리포트 헤더 생성
  const marketLabel = MARKET === "KR" ? "🇰🇷 한국장" : MARKET === "US" ? "🇺🇸 미국장" : "전체";
  let finalReport = `🌅 <b>[Morning Report Alpha] 오늘의 투자 브리핑 (${marketLabel})</b>\n🗓 Date: ${today}\n\n`;

  console.log(
    `🚀 다중 종목 분석 파이프라인 시작... (대상: ${targets
      .map(([t]) => t)
      .join(", ")})`
  );

  for (const [ticker, symbol] of targets) {
    // 1. 데이터 수집
    const news = await fetchDailyNews(ticker);

    // 2. AI 분석
    const analysis = await analyzeNews(ticker, news);

    // 3. 주가 수집 (Phase 2) — 분석 성공 여부와 무관하게 시계열을 끊지 않도록 항상 시도
    const price = await fetchClosePrice(symbol);
    if (price) appendPrice(isoDate, ticker, symbol, price);
    const priceLine = price
      ? `  💰 종가: ${price.price.toLocaleString()} ${price.currency} (${price.priceDate})\n`
      : "";

    if (analysis) {
      // 데이터 누적 저장 (Phase 1)
      appendScore(isoDate, ticker, analysis);

      // 이모지 선택 로직 (점수 기반)
      const icon =
        analysis.score >= 70 ? "🔥" : analysis.score <= 30 ? "❄️" : "📊";

      // 4. 리포트 본문 조합 (점수·종가·insight만; summary 3줄은 scores.csv에만 저장)
      finalReport += `<b>[${ticker}]</b> ${icon} 투심: <b>${analysis.score}점 (${analysis.trend})</b>\n`;
      finalReport += priceLine;
      finalReport += `  💡 <i>${analysis.insight}</i>\n\n`;
    } else {
      finalReport += `<b>[${ticker}]</b> ❌ 분석 데이터를 가져오지 못했습니다.\n${priceLine}\n`;
    }

    // API Rate Limit 방지를 위해 종목당 2초 대기
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // 4. 텔레그램 발송
  console.log("\n최종 리포트 생성 완료. 텔레그램으로 전송합니다.");
  await sendTelegramMessage(finalReport);
}

// 메인 함수 실행
runMorningReport();
