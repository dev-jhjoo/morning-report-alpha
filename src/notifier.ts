import * as dotenv from "dotenv";
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

/**
 * 텔레그램으로 메시지를 전송합니다.
 * @param message 전송할 텍스트 (HTML 포맷)
 */
export async function sendTelegramMessage(message: string) {
  if (!token || !chatId) {
    console.error("❌ .env 파일에 텔레그램 토큰 또는 CHAT_ID가 없습니다.");
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML", // 텍스트를 굵게/기울임체로 꾸미기 위해 HTML 모드 사용
      }),
    });

    if (!response.ok) {
      throw new Error(`Telegram API Error: ${response.statusText}`);
    }
    console.log("📱 텔레그램 메시지 전송 성공!");
  } catch (error) {
    console.error("❌ 텔레그램 전송 실패:", error);
  }
}
