import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
// NewsItem 앞에 'type' 키워드 추가!
import { fetchDailyNews, type NewsItem } from "./scraper.js";

dotenv.config();

// 응답받을 데이터의 타입 정의
export interface InsightReport {
  target: string;
  score: number;
  sentiment: "긍정" | "중립" | "부정";
  summary: string[];
  insight: string;
}

// API 키 확인
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ GEMINI_API_KEY가 .env 파일에 설정되지 않았습니다.");
  process.exit(1);
}

// Gemini 인스턴스 초기화 (1.5 Flash 모델이 속도/비용 면에서 MVP에 가장 적합합니다)
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

/**
 * 수집된 뉴스를 바탕으로 AI 투자 심리 분석을 수행합니다.
 * @param ticker 종목명
 * @param news 뉴스를 담은 배열
 * @returns JSON 파싱된 InsightReport 객체
 */
export async function analyzeNews(
  ticker: string,
  news: NewsItem[]
): Promise<InsightReport | null> {
  if (news.length === 0) {
    console.log("분석할 뉴스가 없습니다.");
    return null;
  }

  // AI에게 전달할 수 있도록 뉴스 데이터를 하나의 텍스트로 묶습니다.
  const newsText = news
    .map((n, i) => `[${i + 1}] 제목: ${n.title} (발행일: ${n.pubDate})`)
    .join("\n");

  // 시스템 프롬프트 (JSON 형식으로만 답하도록 강력하게 지시)
  const prompt = `
    너는 20년 경력의 날카로운 시니어 주식 애널리스트야.
    아래 제공된 [${ticker}]의 오늘자 뉴스 헤드라인들을 분석해서 단기 투자 심리와 모멘텀을 평가해줘.
    
    [뉴스 데이터]
    ${newsText}

    [출력 조건]
    반드시 아래의 순수 JSON 포맷으로만 응답할 것. 마크다운(\`\`\`json 등)이나 다른 설명은 절대 포함하지 마.
    {
        "target": "${ticker}",
        "score": 0~100 사이의 정수 (높을수록 호재, 탐욕, 매수 우위),
        "sentiment": "긍정", "중립", "부정" 중 택 1,
        "summary": [
            "가장 중요한 핵심 뉴스 요약 1",
            "가장 중요한 핵심 뉴스 요약 2",
            "가장 중요한 핵심 뉴스 요약 3"
        ],
        "insight": "이 뉴스들을 종합했을 때 내일 장 초반 대응을 위한 애널리스트의 날카로운 한줄 코멘트"
    }
    `;

  try {
    console.log(
      `🤖 [${ticker}] AI 분석을 시작합니다 (뉴스 ${news.length}건)...`
    );

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // 간혹 AI가 마크다운 코드블럭(```json)을 붙여서 주는 경우를 대비해 텍스트 클렌징
    const cleanedText = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const report: InsightReport = JSON.parse(cleanedText);
    return report;
  } catch (error) {
    console.error("❌ AI 분석 중 에러 발생:", error);
    return null;
  }
}

// ESM 환경에서 이 파일을 직접 실행할 경우 테스트 코드가 동작합니다.
const isMain = process.argv[1] && process.argv[1].endsWith("analyzer.ts");

if (isMain) {
  const testTicker = "삼성전자";

  // 1. Scraper 모듈을 이용해 최신 뉴스 수집
  fetchDailyNews(testTicker).then(async (news) => {
    // 상위 10개의 뉴스만 AI에게 전달 (비용 및 컨텍스트 최적화)
    const targetNews = news.slice(0, 10);

    // 2. 수집된 뉴스를 AI 모듈에 전달
    const report = await analyzeNews(testTicker, targetNews);

    if (report) {
      console.log("\n=======================================");
      console.log(` 📊 [${report.target}] AI 투자 심리 리포트`);
      console.log("=======================================");
      console.log(`🌡️ 심리 점수: ${report.score}점 (${report.sentiment})`);
      console.log("\n📝 [핵심 요약]");
      report.summary.forEach((line, i) => console.log(`${i + 1}. ${line}`));
      console.log("\n💡 [AI 인사이트]");
      console.log(`"${report.insight}"`);
      console.log("=======================================\n");
    }
  });
}
