import { logger, schedules } from "@trigger.dev/sdk/v3";
import { fetchTask } from "../recoup/fetchTask";
import { generateChat } from "../recoup/generateChat";
import {
  chatSchema,
  type ChatConfig,
  DEFAULT_ROOM_ID,
} from "../schemas/chatSchema";

type TaskPayload = {
  // Provided automatically by Trigger.dev schedules
  timestamp: Date;
  lastTimestamp?: Date | null;
  timezone: string;
  // For dynamic schedules, the externalId is set via schedules.create
  externalId?: string;
};

export const customerPromptTask = schedules.task({
  id: "customer-prompt-task",
  run: async (payload: TaskPayload) => {
    const rawTask = await fetchTask(payload.externalId);

    // Validate task config if it exists
    let taskConfig: ChatConfig | undefined;
    if (rawTask) {
      const validationResult = chatSchema.safeParse(rawTask);
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
    const roomId = taskConfig?.roomId ?? DEFAULT_ROOM_ID;
    const artistId = taskConfig?.artistId;
    const prompt =
      taskConfig?.prompt ??
      "Draft a friendly check-in message for our customers.";

    if (!accountId) {
      logger.error("Missing required accountId from task");
      return;
    }

    await generateChat({
      prompt,
      accountId,
      roomId,
      artistId,
    });
  },
});
