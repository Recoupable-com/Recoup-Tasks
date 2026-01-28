import { logger } from "@trigger.dev/sdk/v3";
import type { UIMessage } from "ai";
import { RECOUP_API_KEY } from "../consts";

type ChatGenerateParams = {
  prompt: string;
  accountId: string;
  roomId: string;
  artistId?: string;
  model?: string;
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
  if (!RECOUP_API_KEY) {
    logger.error("Missing RECOUP_API_KEY environment variable");
    return undefined;
  }

  const apiUrl = "https://chat.recoupable.com/api/chat/generate";

  const messages: UIMessage[] = [
    {
      id: crypto.randomUUID(),
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

  if (params.model) {
    body.model = params.model;
  }

  logger.log("Calling Recoup Chat API", {
    url: apiUrl,
    roomId: params.roomId,
    accountId: params.accountId,
    artistId: params.artistId,
    model: params.model,
    prompt: params.prompt,
  });

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": RECOUP_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "<no body>");
      logger.error("Recoup Chat API error", {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.slice(0, 1000),
        url: apiUrl,
        accountId: params.accountId,
        roomId: params.roomId,
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
