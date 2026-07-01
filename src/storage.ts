import * as fs from "fs";
import * as path from "path";
import type { AnalysisResult } from "./analyzer.js";
import type { PriceData } from "./price.js";

const DATA_DIR = "data";
const CSV_PATH = path.join(DATA_DIR, "scores.csv");
const HEADER = "date,ticker,score,trend,insight,summary\n";
const PRICE_PATH = path.join(DATA_DIR, "prices.csv");
const PRICE_HEADER = "date,ticker,symbol,price,priceDate,currency\n";

// CSV 필드 이스케이프: 쉼표/따옴표/줄바꿈이 있으면 따옴표로 감싸고 내부 따옴표는 2개로
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// 파일이 없으면 헤더부터 만들고 한 줄 append
function appendRow(file: string, header: string, fields: (string | number)[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, header);
  fs.appendFileSync(file, fields.map(csvField).join(",") + "\n");
}

/**
 * 분석 결과 한 건을 data/scores.csv에 append.
 * @param date YYYY-MM-DD (Asia/Seoul 기준)
 */
export function appendScore(date: string, ticker: string, a: AnalysisResult) {
  // summary(string[])는 줄바꿈으로 합쳐 한 셀에 저장 → 추후 문장 단위 NLP 분석에 그대로 활용
  appendRow(CSV_PATH, HEADER, [
    date,
    ticker,
    a.score,
    a.trend,
    a.insight,
    a.summary.join("\n"),
  ]);
}

/**
 * 주가 한 건을 data/prices.csv에 append.
 * @param date 수집일 YYYY-MM-DD (Asia/Seoul). p.priceDate는 종가의 실제 날짜.
 */
export function appendPrice(
  date: string,
  ticker: string,
  symbol: string,
  p: PriceData
) {
  appendRow(PRICE_PATH, PRICE_HEADER, [
    date,
    ticker,
    symbol,
    p.price,
    p.priceDate,
    p.currency,
  ]);
}

// 직접 실행 시 자체 점검
const isMain = process.argv[1] && process.argv[1].endsWith("storage.ts");
if (isMain) {
  const tmp = path.join(DATA_DIR, "scores.csv");
  const before = fs.existsSync(tmp) ? fs.readFileSync(tmp, "utf8") : "";
  appendScore("2026-06-30", "테스트", {
    score: 77,
    trend: "분할 매수",
    summary: ["첫 줄", "둘째 줄"],
    insight: '쉼표, "따옴표" 포함 인사이트',
  });
  const after = fs.readFileSync(tmp, "utf8");
  const added = after.slice(before.length);
  console.assert(added.includes('"쉼표, ""따옴표"" 포함 인사이트"'), "이스케이프 실패");
  console.assert(added.includes('"첫 줄\n둘째 줄"'), "summary 저장 실패");
  console.assert(after.startsWith(HEADER), "헤더 누락");
  console.log("self-check OK:", JSON.stringify(added));
}
