import { logger, schedules } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { fetchTask, type TaskConfig } from "./recoup/fetchTask";
import { generateChat } from "./recoup/generateChat";

type TaskPayload = {
  // Provided automatically by Trigger.dev schedules
  timestamp: Date;
  lastTimestamp?: Date | null;
  timezone: string;
  // For dynamic schedules, the externalId is set via schedules.create
  externalId?: string;
};

// Zod schema for validating task config (for runtime validation after fetch)
const taskConfigSchema = z.object({
  prompt: z.string().min(1).optional(),
  accountId: z.string().min(1).optional(),
  roomId: z.string().min(1).optional(),
  artistId: z.string().optional(),
  model: z.string().optional(),
});

export const customerPromptTask = schedules.task({
  id: "customer-prompt-task",
  run: async (payload: TaskPayload, { ctx }) => {
    const rawTask = await fetchTask(payload.externalId);

    // Validate task config if it exists
    let taskConfig: TaskConfig | undefined;
    if (rawTask) {
      const validationResult = taskConfigSchema.safeParse(rawTask);
      if (!validationResult.success) {
        logger.error("Invalid task config from Recoup Tasks API", {
          externalId: payload.externalId,
          errors: validationResult.error.issues,
          rawTask,
        });
        // Continue with fallback to env vars
      } else {
        taskConfig = validationResult.data;
      }
    }

    const accountId = taskConfig?.accountId;
    const roomId = "ceb9d9fc-7934-47d5-9021-124202cc1e70";
    const artistId = taskConfig?.artistId;
    const prompt =
      taskConfig?.prompt ??
      "Draft a friendly check-in message for our customers.";

    if (!accountId) {
      logger.error("Missing required accountId from task");
      return;
    }

    await generateChat(
      {
        prompt,
        accountId,
        roomId,
        artistId,
      },
      payload.externalId
    );
  },
});
