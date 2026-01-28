import { logger, schedules } from "@trigger.dev/sdk/v3";
import { fetchActivePulses } from "../recoup/fetchActivePulses";
import { getTaskRoomId } from "../chats/getTaskRoomId";
import { generateChat } from "../recoup/generateChat";

const DEFAULT_PULSE_PROMPT =
  "send me an email with the text 'this is a pulse hello world'";

/**
 * Scheduled task that sends pulses to all accounts with active pulse subscriptions.
 * Runs daily and generates personalized pulse content for each active account.
 */
export const sendPulsesTask = schedules.task({
  id: "send-pulses-task",
  cron: "0 9 * * *", // Run daily at 9 AM UTC
  run: async (payload) => {
    logger.log("Starting send pulses task", {
      timestamp: payload.timestamp,
      timezone: payload.timezone,
    });

    const activePulses = await fetchActivePulses();

    if (activePulses.length === 0) {
      logger.log("No active pulses found, skipping");
      return { sent: 0, failed: 0 };
    }

    logger.log("Processing active pulses", { count: activePulses.length });

    let sent = 0;
    let failed = 0;

    for (const pulse of activePulses) {
      const accountId = pulse.account_id;

      logger.log("Processing pulse for account", {
        accountId,
        pulseId: pulse.id,
        active: pulse.active,
      });

      try {
        const roomId = await getTaskRoomId({ accountId });

        if (!roomId) {
          logger.error("Failed to get roomId for pulse", { accountId });
          failed++;
          continue;
        }

        logger.log("Got roomId, calling generateChat", { accountId, roomId });

        const result = await generateChat({
          prompt: DEFAULT_PULSE_PROMPT,
          accountId,
          roomId,
        });

        if (result) {
          logger.log("Pulse sent successfully", {
            accountId,
            roomId,
            finishReason: result.finishReason,
          });
          sent++;
        } else {
          logger.error("Failed to send pulse - generateChat returned undefined", { accountId, roomId });
          failed++;
        }
      } catch (error) {
        logger.error("Exception while processing pulse", {
          accountId,
          error: error instanceof Error ? error.message : String(error),
        });
        failed++;
      }
    }

    logger.log("Send pulses task completed", { sent, failed });

    return { sent, failed };
  },
});
