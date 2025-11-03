import { logger, schedules } from "@trigger.dev/sdk/v3";
import { z } from "zod";

type UIMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Array<{
    type: "text";
    text: string;
  }>;
};

type TaskPayload = {
  // Provided automatically by Trigger.dev schedules
  timestamp: Date;
  lastTimestamp?: Date | null;
  timezone: string;
  // For dynamic schedules, the externalId is set via schedules.create
  externalId?: string;
};

// Zod schema for validating customer config from Supabase
const customerConfigSchema = z.object({
  prompt: z.string().min(1).optional(),
  accountId: z.string().min(1).optional(),
  roomId: z.string().min(1).optional(),
  artistId: z.string().optional(),
  model: z.string().optional(),
});

type CustomerConfig = z.infer<typeof customerConfigSchema>;

async function fetchCustomerConfigByExternalId(
  externalId?: string
): Promise<CustomerConfig | undefined> {
  // Plug in your Supabase fetch here using the externalId.
  // Example shape expected from your table: { prompt, accountId, roomId, artistId, model }
  // Return undefined to fall back to env vars configured at deploy time.
  return undefined;
}

export const customerPromptTask = schedules.task({
  id: "customer-prompt-task",
  // No cron here — schedules are created dynamically with schedules.create()
  maxDuration: 300,
  run: async (payload: TaskPayload) => {
    const apiUrl =
      process.env.RECOUP_CHAT_API_URL ??
      "https://chat.recoupable.com/api/chat/generate";
    const rawCustomer = await fetchCustomerConfigByExternalId(
      payload.externalId
    );

    // Validate customer config if it exists
    let customer: CustomerConfig | undefined;
    if (rawCustomer) {
      const validationResult = customerConfigSchema.safeParse(rawCustomer);
      if (!validationResult.success) {
        logger.error("Invalid customer config from Supabase", {
          externalId: payload.externalId,
          errors: validationResult.error.issues,
          rawCustomer,
        });
        // Continue with fallback to env vars
      } else {
        customer = validationResult.data;
      }
    }

    const accountId = customer?.accountId ?? process.env.RECOUP_ACCOUNT_ID;
    const roomId = customer?.roomId ?? process.env.RECOUP_ROOM_ID;
    const artistId = customer?.artistId ?? process.env.RECOUP_ARTIST_ID; // optional
    const model = customer?.model ?? process.env.RECOUP_MODEL; // optional
    const prompt =
      customer?.prompt ??
      process.env.RECOUP_PROMPT ??
      "Draft a friendly check-in message for our customers.";

    if (!accountId || !roomId) {
      logger.error(
        "Missing required env vars RECOUP_ACCOUNT_ID or RECOUP_ROOM_ID"
      );
      return;
    }

    const messages: UIMessage[] = [
      {
        id: `msg-${Date.now()}`,
        role: "user",
        parts: [
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ];

    const body: Record<string, unknown> = {
      messages,
      roomId,
      accountId,
    };

    if (artistId) body.artistId = artistId;
    if (model) body.model = model;

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
        return;
      }

      const json = (await response.json()) as {
        text?: Array<{ type: string; text?: string }>;
        reasoningText?: string;
        finishReason?: string;
        usage?: Record<string, unknown>;
      };

      const combinedText = (json.text ?? [])
        .filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text as string)
        .join("\n\n");

      logger.log("Recoup Chat API response", {
        finishReason: json.finishReason,
        usage: json.usage,
        reasoningText: json.reasoningText,
        textPreview: combinedText.slice(0, 500),
        externalId: payload.externalId,
      });
    } catch (error) {
      logger.error("Failed to call Recoup Chat API", { error });
    }
  },
});
