import { logger } from "@trigger.dev/sdk/v3";
import { NEW_API_BASE_URL } from "../consts";
import type { Database } from "../../types/database.types";

type Room = Database["public"]["Tables"]["rooms"]["Row"];

type CreateChatParams = {
  apiKey: string;
  artistId?: string;
  chatId?: string;
};

type CreateChatResponse = {
  status: "success" | "error";
  chat?: Room;
  message?: string;
};

/**
 * Creates a new chat room using the Recoup API.
 *
 * @param params - Chat creation parameters
 * @returns Promise that resolves to the created chat, or undefined on error
 */
export async function createChat(
  params: CreateChatParams
): Promise<Room | undefined> {
  const apiUrl = `${NEW_API_BASE_URL}/api/chats`;

  const body: Record<string, unknown> = {};

  if (params.artistId) {
    body.artistId = params.artistId;
  }

  if (params.chatId) {
    body.chatId = params.chatId;
  }

  logger.log("Creating new chat via Recoup API", {
    artistId: params.artistId,
  });

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": params.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "<no body>");
      logger.error("Recoup Create Chat API error", {
        status: response.status,
        errorText,
      });
      return undefined;
    }

    const json = (await response.json()) as CreateChatResponse;

    if (json.status === "error" || !json.chat) {
      logger.error("Recoup Create Chat API returned error", {
        message: json.message,
      });
      return undefined;
    }

    logger.log("Created new chat", {
      chatId: json.chat.id,
      artistId: json.chat.artist_id,
    });

    return json.chat;
  } catch (error) {
    logger.error("Failed to call Recoup Create Chat API", { error });
    return undefined;
  }
}
