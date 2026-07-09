import {
  GoogleGenerativeAI,
  SchemaType,
  type Schema,
} from "@google/generative-ai";
import type { NewsItem } from "./scraper.js";
import * as dotenv from "dotenv";

dotenv.config();

// 1. 제미나이 API 초기화 (이 부분이 누락되어 genAI 에러가 발생했습니다)
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
}
const genAI = new GoogleGenerativeAI(apiKey);

// 2. 반환받을 JSON 구조(Schema) 정의 (type Schema로 임포트 에러 해결)
const analysisSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    score: {
      type: SchemaType.INTEGER,
      description:
        "뉴스의 전반적인 뉘앙스를 분석하여 0(극단적 공포/매도) ~ 100(극단적 탐욕/매수) 사이의 정수로 평가",
    },
    trend: {
      type: SchemaType.STRING,
      description:
        "score에 따라 '강한 매수', '분할 매수', '관망', '비중 축소', '적극 매도' 중 하나로 표현",
    },
    summary: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description:
        "노이즈를 제거하고 실제 주가에 영향을 미칠 핵심 호재/악재 팩트만 3줄로 요약",
    },
    insight: {
      type: SchemaType.STRING,
      description:
        "시니어 애널리스트로서 오늘 장에 임하는 투자자에게 건네는 날카로운 한 줄 조언",
    },
  },
  required: ["score", "trend", "summary", "insight"],
};

// 3. 모델 사용 및 JSON 출력(Schema) 강제 설정
// flash-lite는 무료 티어 일일 요청 한도가 flash보다 훨씬 높아 20개 종목 일괄 분석에 적합.
// (flash 무료 티어는 20req/day라 종목 수와 동률 → 첫 종목 외 전부 429 발생했음)
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: analysisSchema,
  },
});

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

  // Schema를 적용했으므로 프롬프트가 훨씬 간결해집니다.
  const prompt = `
    당신은 20년 경력의 월스트리트 시니어 퀀트 애널리스트입니다. 
    거시 경제의 흐름을 읽는 통찰력과 노이즈를 걸러내는 냉철한 판단력을 가지고 있습니다.
    
    다음은 오늘 [${ticker}] 종목에 대한 최근 24시간 뉴스 헤드라인 목록입니다.
    이 뉴스들을 분석하여 정확하게 답변해 주세요.
    
    [뉴스 데이터]
    ${newsList.map((n, i) => `${i + 1}. ${n.title}`).join("\n")}
    `;

  // 4. 재시도(Retry) 로직. 503(과부하)이 3초 간격 3회로는 짧은 스파이크를 못 넘겨
  // 단일 종목이 조용히 누락됐음(2026-07-09/10 NVIDIA) → 횟수↑ + 지수 백오프로 대기 창을 늘림.
  const maxRetries = 5;
  let retries = maxRetries;
  let attempt = 0;
  while (retries > 0) {
    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      const cleanJsonStr = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      const analysisData: AnalysisResult = JSON.parse(cleanJsonStr);

      return analysisData;
    } catch (error: any) {
      // 429(rate limit/quota), 503(과부하)은 재시도. 그 외는 즉시 포기.
      if (error.status === 429 || error.status === 503) {
        // 서버가 RetryInfo.retryDelay("36s")를 주면 그만큼 우선. 없으면 지수 백오프(3,6,12,24…초).
        // 503은 대개 RetryInfo가 없어 이전엔 3초 고정 → 스파이크를 못 넘겼음. 상한 60초.
        const retryInfo = error?.errorDetails?.find((d: any) =>
          String(d?.["@type"]).includes("RetryInfo")
        );
        const delaySec = Math.min(
          parseInt(retryInfo?.retryDelay, 10) || 3 * 2 ** attempt,
          60
        );
        attempt++;
        console.log(
          `⏳ [${ticker}] ${error.status} 응답. ${delaySec}초 대기 후 재시도... (남은 시도: ${
            retries - 1
          })`
        );
        await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
        retries--;
      } else {
        console.error(`❌ [${ticker}] AI 분석 중 에러 발생:`, error);
        return null;
      }
    }
  }

  console.error(`❌ [${ticker}] ${maxRetries}회 재시도 실패. 분석을 건너뜁니다.`);
  return null;
}
