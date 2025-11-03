import { logger, schedules } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { fetchJob, type CustomerConfig } from "./recoup/fetchJob";
import { generateChat } from "./recoup/generateChat";

type TaskPayload = {
  // Provided automatically by Trigger.dev schedules
  timestamp: Date;
  lastTimestamp?: Date | null;
  timezone: string;
  // For dynamic schedules, the externalId is set via schedules.create
  externalId?: string;
};

// Zod schema for validating customer config (for runtime validation after fetch)
const customerConfigSchema = z.object({
  prompt: z.string().min(1).optional(),
  accountId: z.string().min(1).optional(),
  roomId: z.string().min(1).optional(),
  artistId: z.string().optional(),
  model: z.string().optional(),
});

export const customerPromptTask = schedules.task({
  id: "customer-prompt-task",
  // No cron here — schedules are created dynamically with schedules.create()
  maxDuration: 300,
  run: async (payload: TaskPayload) => {
    const rawCustomer = await fetchJob(payload.externalId);

    // Validate customer config if it exists
    let customer: CustomerConfig | undefined;
    if (rawCustomer) {
      const validationResult = customerConfigSchema.safeParse(rawCustomer);
      if (!validationResult.success) {
        logger.error("Invalid customer config from Recoup Jobs API", {
          externalId: payload.externalId,
          errors: validationResult.error.issues,
          rawCustomer,
        });
        // Continue with fallback to env vars
      } else {
        customer = validationResult.data;
      }
    }

    const accountId = customer?.accountId;
    const roomId = "ceb9d9fc-7934-47d5-9021-124202cc1e70";
    const artistId = customer?.artistId;
    const prompt =
      customer?.prompt ??
      "Draft a friendly check-in message for our customers.";

    if (!accountId) {
      logger.error("Missing required accountId from job");
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
