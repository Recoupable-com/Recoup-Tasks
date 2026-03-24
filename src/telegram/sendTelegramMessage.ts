import { logger } from "@trigger.dev/sdk/v3";
import { logStep } from "../sandboxes/logStep";

/**
 * Sends a message to a Telegram chat using the Bot API.
 * Returns true if the message was sent successfully.
 *
 * @param text - The message text (supports Telegram MarkdownV2 or HTML)
 * @param parseMode - Optional parse mode ("MarkdownV2" or "HTML")
 */
export async function sendTelegramMessage(
  text: string,
  parseMode: "MarkdownV2" | "HTML" = "HTML",
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    logger.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    return false;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  });

  const data = (await response.json()) as { ok: boolean; description?: string };

  if (!data.ok) {
    logger.error("Failed to send Telegram message", { error: data.description });
    return false;
  }

  logStep("Sent Telegram notification", false);
  return true;
}
