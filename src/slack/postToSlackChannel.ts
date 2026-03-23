import { logger } from "@trigger.dev/sdk/v3";

/**
 * Posts a plain-text message to a Slack channel using the bot token.
 * Returns true if the message was sent successfully.
 *
 * @param channelId - The Slack channel ID (e.g. "C08HN8RKJHZ")
 * @param text - The message text (supports Slack mrkdwn formatting)
 */
export async function postToSlackChannel(channelId: string, text: string): Promise<boolean> {
  const token = process.env.SLACK_BOT_TOKEN;

  if (!token) {
    logger.error("Missing SLACK_BOT_TOKEN — cannot post to Slack");
    return false;
  }

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel: channelId, text }),
  });

  const data = (await response.json()) as { ok: boolean; error?: string };

  if (!data.ok) {
    logger.error("Failed to post message to Slack", { channel: channelId, error: data.error });
    return false;
  }

  logger.log("Posted message to Slack", { channel: channelId });
  return true;
}
