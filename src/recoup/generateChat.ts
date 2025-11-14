import { logger } from "@trigger.dev/sdk/v3";
import type { UIMessage } from "ai";

type ChatGenerateParams = {
  prompt: string;
  accountId: string;
  roomId: string;
  artistId?: string;
};

type ChatGenerateResponse = {
  text?: Array<{ type: string; text?: string }>;
  reasoningText?: string;
  finishReason?: string;
  usage?: Record<string, unknown>;
};

/**
 * Generates a chat response using the Recoup Chat Generate API.
 *
 * @param params - Chat generation parameters
 * @returns Promise that resolves to the parsed response, or undefined on error
 */
export async function generateChat(
  params: ChatGenerateParams
): Promise<ChatGenerateResponse | undefined> {
  const apiUrl = "https://chat.recoupable.com/api/chat/generate";

  const messages: UIMessage[] = [
    {
      id: `msg-${Date.now()}`,
      role: "user",
      parts: [
        {
          type: "text",
          text: params.prompt,
        },
      ],
    },
  ];

  const body: Record<string, unknown> = {
    messages,
    roomId: params.roomId,
    accountId: params.accountId,
    excludeTools: ["create_task"],
  };

  if (params.artistId) {
    body.artistId = params.artistId;
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "<no body>");
      logger.error("Recoup Chat API error", {
        status: response.status,
        errorText,
      });
      return undefined;
    }

    const json = (await response.json()) as ChatGenerateResponse;

    const combinedText = (json.text ?? [])
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string)
      .join("\n\n");

    logger.log("Recoup Chat API response", {
      finishReason: json.finishReason,
      usage: json.usage,
      reasoningText: json.reasoningText,
      textPreview: combinedText.slice(0, 500),
    });

    return json;
  } catch (error) {
    logger.error("Failed to call Recoup Chat API", { error });
    return undefined;
  }
}
