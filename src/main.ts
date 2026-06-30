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

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(message: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("❌ 텔레그램 환경 변수가 없습니다.");
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML", // HTML 태그를 사용하여 예쁘게 꾸미기 위함
      }),
    });
    console.log("✅ 텔레그램 메시지 발송 완료!");
  } catch (error) {
    console.error("❌ 텔레그램 발송 실패:", error);
  }
}

async function runMorningReport() {
  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
  });
  // 저장용 ISO 날짜 (YYYY-MM-DD, Asia/Seoul)
  const isoDate = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Seoul",
  });

  // 리포트 헤더 생성
  let finalReport = `🌅 <b>[Morning Report Alpha] 오늘의 투자 브리핑</b>\n🗓 Date: ${today}\n\n`;

  console.log(
    `🚀 다중 종목 분석 파이프라인 시작... (대상: ${Object.keys(
      TARGET_TICKERS
    ).join(", ")})`
  );

  for (const [ticker, symbol] of Object.entries(TARGET_TICKERS)) {
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

      // 4. 리포트 본문 조합
      finalReport += `<b>[${ticker}]</b> ${icon} 투심: <b>${analysis.score}점 (${analysis.trend})</b>\n`;
      finalReport += priceLine;
      analysis.summary.forEach((line, idx) => {
        finalReport += `  ${idx + 1}. ${line}\n`;
      });
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
