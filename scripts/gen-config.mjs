import { writeFileSync } from "fs";
import { config } from "dotenv";

config();
const token = process.env.FINNHUB_TOKEN || "";
writeFileSync("data/config.js", `window.FINNHUB_TOKEN="${token}";\n`);
console.log(token ? "data/config.js 생성 완료" : "경고: FINNHUB_TOKEN 없음 — 실시간 시세 비활성");
