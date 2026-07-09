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

// 파일이 없으면 헤더부터 만들고 한 줄 append.
// 같은 날 재실행(백필) 시 같은 (date,ticker) 중복 방지 — 이미 있으면 조용히 skip.
// ponytail: 첫 두 필드(date,ticker)가 CSV 이스케이프 대상이 아니라 raw 접두 매칭으로 충분. 종목명에 쉼표 생기면 정식 CSV 파싱으로.
function appendRow(file: string, header: string, fields: (string | number)[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, header);
  const key = `${fields[0]},${fields[1]},`;
  if (fs.readFileSync(file, "utf8").split("\n").some((l) => l.startsWith(key))) {
    console.log(`↩︎ [${fields[1]}] ${fields[0]} 이미 존재 — 저장 skip`);
    return;
  }
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

// 직접 실행 시 자체 점검 (임시 파일에만 기록 — 실제 data/scores.csv 오염 방지)
const isMain = process.argv[1] && process.argv[1].endsWith("storage.ts");
if (isMain) {
  const tmp = path.join(DATA_DIR, "_selfcheck.csv");
  fs.rmSync(tmp, { force: true });
  const row = (d: string) => appendRow(tmp, HEADER, [d, "테스트", 77, "분할 매수", '쉼표, "따옴표" 포함 인사이트', "첫 줄\n둘째 줄"]);
  row("2026-06-30");
  const after1 = fs.readFileSync(tmp, "utf8");
  console.assert(after1.includes('"쉼표, ""따옴표"" 포함 인사이트"'), "이스케이프 실패");
  console.assert(after1.includes('"첫 줄\n둘째 줄"'), "summary 저장 실패");
  console.assert(after1.startsWith(HEADER), "헤더 누락");
  // 같은 (date,ticker) 재기록 → dedup으로 skip (줄 수 불변)
  row("2026-06-30");
  console.assert(fs.readFileSync(tmp, "utf8") === after1, "dedup 실패: 중복 append됨");
  // 다른 날짜는 정상 추가 (summary에 \n이 있어 줄 수 대신 접두 매칭으로 확인)
  row("2026-07-01");
  const after2 = fs.readFileSync(tmp, "utf8");
  console.assert(after2.includes("\n2026-07-01,테스트,"), "새 날짜 추가 실패");
  fs.rmSync(tmp, { force: true });
  console.log("self-check OK (escape + dedup)");
}
