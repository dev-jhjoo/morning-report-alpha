import { fetchDailyNews } from "./scraper.js";
import { analyzeNews, type InsightReport } from "./analyzer.js";
import { sendTelegramMessage } from "./notifier.js";

// 타겟 종목 설정
const TARGET_TICKER = "삼성전자";

/**
 * AI 분석 결과를 텔레그램 전송용 HTML 문자열로 예쁘게 포맷팅합니다.
 */
function formatReportToHTML(report: InsightReport): string {
  let html = `🤖 <b>[AI 주식 인사이트 - ${new Date().toLocaleDateString(
    "ko-KR"
  )}]</b>\n\n`;
  html += `📈 <b>분석 종목:</b> ${report.target}\n`;
  html += `📊 <b>투자 심리 점수:</b> <b>${report.score}점</b> (${report.sentiment})\n\n`;

  html += `<b>🔍 뉴스 핵심 요약</b>\n`;
  report.summary.forEach((line, i) => {
    html += `${i + 1}. ${line}\n`;
  });

  html += `\n<b>💡 AI 한줄 인사이트</b>\n`;
  html += `<i>"${report.insight}"</i>`;

  return html;
}

/**
 * [수집 -> 분석 -> 알림]의 전체 파이프라인을 실행합니다.
 */
async function runPipeline() {
  console.log(
    `\n🚀 [${TARGET_TICKER}] 모닝 알파 MVP 파이프라인을 시작합니다...\n`
  );

  // 1. 뉴스 데이터 수집
  const news = await fetchDailyNews(TARGET_TICKER);
  if (news.length === 0) {
    console.log("수집된 뉴스가 없어 파이프라인을 종료합니다.");
    return;
  }

  // 상위 10개의 뉴스만 AI에게 전달
  const targetNews = news.slice(0, 10);

  // 2. AI 분석 진행
  const report = await analyzeNews(TARGET_TICKER, targetNews);

  // 3. 텔레그램 알림 전송
  if (report) {
    const message = formatReportToHTML(report);
    await sendTelegramMessage(message);
    console.log("\n✅ 모든 파이프라인이 성공적으로 완료되었습니다!");
  } else {
    console.log("\n❌ 리포트 생성에 실패하여 알림을 전송하지 않습니다.");
  }
}

// 메인 함수 실행
runPipeline();
