import { GoogleGenerativeAI } from "@google/generative-ai";
import type { NewsItem } from "./scraper.js";
import * as dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
}

const genAI = new GoogleGenerativeAI(apiKey);
// 최신 2.5-flash 모델 사용
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export interface AnalysisResult {
  score: number;
  trend: string;
  summary: string[];
  insight: string;
}

/**
 * 수집된 뉴스를 바탕으로 시니어 애널리스트 페르소나를 적용하여 투자 심리를 분석합니다.
 */
export async function analyzeNews(
  ticker: string,
  newsList: NewsItem[]
): Promise<AnalysisResult | null> {
  if (newsList.length === 0) return null;

  console.log(
    `🤖 [${ticker}] 시니어 애널리스트 AI가 분석을 시작합니다 (뉴스 ${newsList.length}건)...`
  );

  // AI에게 부여할 강력한 페르소나와 프롬프트
  const prompt = `
    당신은 20년 경력의 월스트리트 시니어 퀀트 애널리스트입니다. 
    거시 경제의 흐름을 읽는 통찰력과 노이즈를 걸러내는 냉철한 판단력을 가지고 있습니다.
    
    다음은 오늘 [${ticker}] 종목에 대한 최근 24시간 뉴스 헤드라인 목록입니다.
    이 뉴스들을 분석하여 다음 JSON 양식에 맞춰 정확하게 답변해 주세요.
    
    [분석 조건]
    1. score: 뉴스의 전반적인 뉘앙스를 분석하여 0(극단적 공포/매도) ~ 100(극단적 탐욕/매수) 사이의 정수로 평가.
    2. trend: score에 따라 '강한 매수', '분할 매수', '관망', '비중 축소', '적극 매도' 중 하나로 표현.
    3. summary: 노이즈를 제거하고 실제 주가에 영향을 미칠 핵심 호재/악재 팩트만 3줄로 요약 (배열).
    4. insight: 시니어 애널리스트로서 오늘 장에 임하는 투자자에게 건네는 날카로운 한 줄 조언.

    [뉴스 데이터]
    ${newsList.map((n, i) => `${i + 1}. ${n.title}`).join("\n")}

    [출력 형식 (반드시 유효한 JSON만 출력할 것)]
    {
        "score": 85,
        "trend": "분할 매수",
        "summary": ["핵심 요약 1", "핵심 요약 2", "핵심 요약 3"],
        "insight": "전문가의 날카로운 한 줄 조언"
    }
    `;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Markdown JSON 블록(```json ... ```)이 섞여 나올 경우를 대비한 정제 로직
    const cleanJsonStr = responseText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const analysisData: AnalysisResult = JSON.parse(cleanJsonStr);

    return analysisData;
  } catch (error) {
    console.error(`❌ [${ticker}] AI 분석 중 에러 발생:`, error);
    return null;
  }
}
