import * as fs from "fs";
import * as path from "path";
import type { AnalysisResult } from "./analyzer.js";

const DATA_DIR = "data";
const CSV_PATH = path.join(DATA_DIR, "scores.csv");
const HEADER = "date,ticker,score,trend,insight\n";

// CSV 필드 이스케이프: 쉼표/따옴표/줄바꿈이 있으면 따옴표로 감싸고 내부 따옴표는 2개로
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * 분석 결과 한 건을 data/scores.csv에 append. 파일이 없으면 헤더부터 생성.
 * @param date YYYY-MM-DD (Asia/Seoul 기준)
 */
export function appendScore(date: string, ticker: string, a: AnalysisResult) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CSV_PATH)) fs.writeFileSync(CSV_PATH, HEADER);

  const row =
    [date, ticker, a.score, a.trend, a.insight].map(csvField).join(",") + "\n";
  fs.appendFileSync(CSV_PATH, row);
}

// 직접 실행 시 자체 점검
const isMain = process.argv[1] && process.argv[1].endsWith("storage.ts");
if (isMain) {
  const tmp = path.join(DATA_DIR, "scores.csv");
  const before = fs.existsSync(tmp) ? fs.readFileSync(tmp, "utf8") : "";
  appendScore("2026-06-30", "테스트", {
    score: 77,
    trend: "분할 매수",
    summary: ["a"],
    insight: '쉼표, "따옴표" 포함 인사이트',
  });
  const after = fs.readFileSync(tmp, "utf8");
  const added = after.slice(before.length);
  console.assert(added.includes('"쉼표, ""따옴표"" 포함 인사이트"'), "이스케이프 실패");
  console.assert(after.startsWith(HEADER), "헤더 누락");
  console.log("self-check OK:", JSON.stringify(added));
}
