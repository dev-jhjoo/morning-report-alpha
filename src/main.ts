import { fetchDailyNews } from "./scraper.js";
import { analyzeNews } from "./analyzer.js";
import * as dotenv from "dotenv";

dotenv.config();

// 💡 분석할 관심 종목 배열 (원하시는 종목으로 자유롭게 커스텀하세요)
const TARGET_TICKERS = ["삼성전자", "SK하이닉스", "테슬라"];

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

  // 리포트 헤더 생성
  let finalReport = `🌅 <b>[Morning Report Alpha] 오늘의 투자 브리핑</b>\n🗓 Date: ${today}\n\n`;

  console.log(
    `🚀 다중 종목 분석 파이프라인 시작... (대상: ${TARGET_TICKERS.join(", ")})`
  );

  for (const ticker of TARGET_TICKERS) {
    // 1. 데이터 수집
    const news = await fetchDailyNews(ticker);

    // 2. AI 분석
    const analysis = await analyzeNews(ticker, news);

    if (analysis) {
      // 이모지 선택 로직 (점수 기반)
      const icon =
        analysis.score >= 70 ? "🔥" : analysis.score <= 30 ? "❄️" : "📊";

      // 3. 리포트 본문 조합
      finalReport += `<b>[${ticker}]</b> ${icon} 투심: <b>${analysis.score}점 (${analysis.trend})</b>\n`;
      analysis.summary.forEach((line, idx) => {
        finalReport += `  ${idx + 1}. ${line}\n`;
      });
      finalReport += `  💡 <i>${analysis.insight}</i>\n\n`;
    } else {
      finalReport += `<b>[${ticker}]</b> ❌ 분석 데이터를 가져오지 못했습니다.\n\n`;
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
