import Parser from "rss-parser";

// 뉴스 기사 타입 정의
export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
}

/**
 * 특정 키워드(종목명)의 최근 24시간 뉴스를 수집합니다.
 * @param keyword 검색할 종목명 (예: '삼성전자')
 * @returns NewsItem 배열
 */
export async function fetchDailyNews(keyword: string): Promise<NewsItem[]> {
  // rss-parser 인스턴스 생성
  const parser = new Parser();

  // 키워드와 함께 최근 1일(when:1d) 옵션을 주어 인코딩합니다.
  const searchParam = encodeURIComponent(`${keyword} when:1d`);
  const rssUrl = `https://news.google.com/rss/search?q=${searchParam}&hl=ko&gl=KR&ceid=KR:ko`;

  try {
    console.log(`📡 [${keyword}] 관련 최신 뉴스를 수집합니다...`);
    const feed = await parser.parseURL(rssUrl);

    console.log(`✅ 총 ${feed.items.length}건의 뉴스를 가져왔습니다.`);

    // 필요한 데이터만 추출하여 배열로 반환
    const newsItems: NewsItem[] = feed.items.map((item) => ({
      title: item.title || "제목 없음",
      link: item.link || "",
      pubDate: item.pubDate || new Date().toISOString(),
    }));

    return newsItems;
  } catch (error) {
    console.error("❌ RSS 수집 중 에러 발생:", error);
    return [];
  }
}

// ESM 환경에서 이 파일을 직접 실행할 경우 테스트 코드가 동작합니다.
const isMain = process.argv[1] && process.argv[1].endsWith("scraper.ts");

if (isMain) {
  const targetTicker = "삼성전자"; // 테스트용 종목

  fetchDailyNews(targetTicker).then((news) => {
    console.log("\n--- 📝 수집된 뉴스 샘플 (상위 3건) ---");
    news.slice(0, 3).forEach((item, index) => {
      console.log(`${index + 1}. ${item.title}`);
      console.log(`   - 발행일: ${item.pubDate}`);
    });
  });
}
