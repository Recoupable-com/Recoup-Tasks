import { logger } from "@trigger.dev/sdk/v3";
import type { UIMessage } from "ai";
import { NEW_API_BASE_URL, RECOUP_API_KEY } from "../consts";

type ChatGenerateParams = {
  prompt: string;
  accountId: string;
  roomId: string;
  artistId?: string;
  model?: string;
};

/**
 * `POST /api/chat/runs` is asynchronous (recoupable/chat#1813): it starts a
 * durable workflow run and returns `{ runId }` with 202. Generation, message
 * persistence, and side effects (email) all happen server-side after the
 * response — so this task only kicks the run off.
 */
type ChatGenerateAccepted = {
  runId?: string;
};

/**
 * Fire-and-forget kickoff of an async chat-generation run via the Recoup Chat
 * Generate API. Returns `{ runId }` (for logging/observability only) once the
 * run has started, or `undefined` if the kickoff itself failed.
 *
 * @param params - Chat generation parameters
 * @returns Promise resolving to `{ runId }`, or undefined on error
 */
export async function generateChat(
  params: ChatGenerateParams
): Promise<ChatGenerateAccepted | undefined> {
  if (!RECOUP_API_KEY) {
    logger.error("Missing RECOUP_API_KEY environment variable");
    return undefined;
  }

  const apiUrl = `${NEW_API_BASE_URL}/api/chat/runs`;

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
    accountId: params.accountId,
  };

  if (params.artistId) {
    body.artistId = params.artistId;
  }

  if (params.model) {
    body.model = params.model;
  }

  logger.log("Kicking off Recoup Chat generation run", {
    url: apiUrl,
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
        errorText: errorText.slice(0, 500),
      });
      return undefined;
    }

    // 202 Accepted → { runId, chatId, sessionId }. We do NOT await generation:
    // persistence + email happen server-side inside the durable workflow.
    const json = (await response.json().catch(() => ({}))) as ChatGenerateAccepted;

    if (!json.runId) {
      logger.error("Recoup Chat run-start returned no runId", {
        status: response.status,
      });
      return undefined;
    }

    logger.log("Recoup Chat generation run started", {
      runId: json.runId,
      status: response.status,
    });

    return { runId: json.runId };
  } catch (error) {
    logger.error("Failed to kick off Recoup Chat generation run", { error });
    return undefined;
  }
}
