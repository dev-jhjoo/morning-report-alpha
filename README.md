# 📈 Morning Report Alpha

한국·미국 시총 상위 20개 종목의 뉴스를 매일 수집해 Gemini AI로 **투자심리 점수**를 산출하고, CSV로 누적 저장·대시보드 시각화·텔레그램 발송까지 자동화하는 파이프라인입니다.

> 🔗 **라이브 대시보드 → [investing.twojh.com](https://investing.twojh.com/)** (Cloudflare 배포)

## ✨ 주요 기능

- **뉴스 수집** — Yahoo Finance RSS 기반 종목별 뉴스 크롤링
- **AI 투자심리 분석** — Gemini 2.5 Flash-Lite로 JSON Schema 강제 분석
  - `score` (0~100) 투자심리 점수
  - `trend` 강한 매수 / 분할 매수 / 관망 / 비중 축소 / 적극 매도
  - `summary` 핵심 팩트 3줄
  - `insight` 시니어 애널리스트 조언 1줄
- **일일 종가 수집** — Yahoo Finance 종가 누적 저장
- **CSV 누적 저장** — `data/scores.csv`, `data/prices.csv`
- **단일 페이지 대시보드** — 점수·종가 결합 표 + 종목별 차트
  - 반응형 카드 레이아웃, 다크모드, 모바일 표 접기
  - 종목 셀렉트 필터, 시장별(한국/미국) 필터·그룹화
  - 행별 `summary`+`insight` details 토글
- **텔레그램 발송** — 4096자 청크 분할 + 발송 실패 감지
- **안정성** — Gemini 쿼터 초과(429) 대비 flash-lite 전환 + 재시도 로직

## 🎯 대상 종목 (20)

| 시장 | 종목 |
|------|------|
| 🇰🇷 한국 (시총 top 10) | 삼성전자, SK하이닉스, LG에너지솔루션, 삼성바이오로직스, 현대자동차, 기아, 셀트리온, POSCO홀딩스, KB금융, 삼성SDI |
| 🇺🇸 미국 (시총 top 10) | Apple, NVIDIA, Microsoft, Amazon, Alphabet, Meta, Tesla, Broadcom, Berkshire Hathaway, JPMorgan |

## 🏗️ 아키텍처

TypeScript (ESM) + `tsx` 실행.

```
src/
├── main.ts       # 파이프라인 오케스트레이터 + 텔레그램 발송
├── scraper.ts    # Yahoo Finance RSS 뉴스 수집
├── analyzer.ts   # Gemini 2.5 Flash-Lite 투자심리 분석 (JSON Schema 강제)
├── price.ts      # Yahoo Finance 일일 종가 수집
├── storage.ts    # data/scores.csv, data/prices.csv 누적 저장
└── notifier.ts   # 텔레그램 발송 유틸

data/
├── scores.csv    # 투자심리 점수 누적 (score, trend, summary ...)
└── prices.csv    # 일일 종가 누적

index.html        # 단일 페이지 대시보드 (CSV 읽어 렌더링)
```

## 🚀 빠른 시작

### 1. 설치

```bash
npm install
```

### 2. 환경 변수 (`.env`)

```env
GEMINI_API_KEY=your_gemini_api_key
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### 3. 실행

```bash
npm run start   # 전체 파이프라인 실행 (수집 → 분석 → 저장 → 발송)
```

## 📊 대시보드 사용법

**라이브: [investing.twojh.com](https://investing.twojh.com/)** — 별도 설치 없이 바로 확인할 수 있습니다.

로컬에서는 `index.html`을 브라우저에서 직접 열면 됩니다. `data/scores.csv`, `data/prices.csv`를 읽어 렌더링합니다.

- 종목 셀렉트로 특정 종목 필터
- 시장별(한국/미국) 그룹화
- 라이트/다크 수동 토글
- 각 행의 `summary`+`insight`는 details 토글로 펼쳐보기

## 🗺️ Roadmap

- [ ] **GitHub Actions 자동화** — 매일 오전 7시 KST cron 스케줄 실행 *(계획 중)*
- [ ] **GitHub Pages 배포** — `index.html` 대시보드 자동 배포 *(계획 중)*
- [ ] **히스토리 차트 개선** — 날짜 범위 필터, 이동평균선 *(계획 중)*
- [ ] **알림 고도화** — 점수 급등/급락 임계치 초과 시 즉시 알림 *(계획 중)*
- [ ] **종목 확장** — 섹터별 종목 추가 옵션 *(계획 중)*
