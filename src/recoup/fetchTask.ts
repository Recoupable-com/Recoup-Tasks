import { logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { NEW_API_BASE_URL } from "../consts";
import { type ChatConfig } from "../schemas/chatSchema";

// Zod schema for validating task response from Recoup Tasks API
const taskResponseSchema = z.object({
  status: z.literal("success"),
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      prompt: z.string(),
      schedule: z.string(),
      account_id: z.string(),
      artist_account_id: z.string(),
      enabled: z.boolean().nullable(),
      model: z.string().nullish(),
    })
  ),
});

/**
 * Fetches a task from the Recoup Tasks API using the externalId (task ID).
 * Returns the task data mapped to ChatConfig format, or undefined if:
 * - No externalId provided
 * - Task not found
 * - Task is disabled
 * - API error occurs
 */
export async function fetchTask(
  externalId?: string
): Promise<ChatConfig | undefined> {
  if (!externalId) {
    logger.warn("No externalId provided, skipping task fetch");
    return undefined;
  }

  const tasksApiUrl = `${NEW_API_BASE_URL}/api/tasks`;

  try {
    const response = await fetch(`${tasksApiUrl}?id=${externalId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      logger.error("Recoup Tasks API error", {
        externalId,
        status: response.status,
        statusText: response.statusText,
      });
      return undefined;
    }

    const json = (await response.json()) as unknown;
    const validationResult = taskResponseSchema.safeParse(json);

    if (!validationResult.success) {
      logger.error("Invalid task response from Recoup Tasks API", {
        externalId,
        errors: validationResult.error.issues,
      });
      return undefined;
    }

    const taskData = validationResult.data;
    const task = taskData.tasks[0];

    if (!task) {
      logger.error("No task found for externalId", { externalId });
      return undefined;
    }

    if (task.enabled === false) {
      logger.warn("Task is disabled, skipping execution", {
        externalId,
        title: task.title,
      });
      return undefined;
    }

    // Map task data to task config format
    return {
      prompt: task.prompt,
      accountId: task.account_id,
      artistId: task.artist_account_id,
      model: task.model ?? undefined,
    };
  } catch (error) {
    logger.error("Failed to fetch task from Recoup Tasks API", {
      externalId,
      error,
    });
    return undefined;
  }
}
