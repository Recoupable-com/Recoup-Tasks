import { logger, schedules, task } from "@trigger.dev/sdk/v3";
import { fetchAllJobs } from "../lib/recoup/fetchAllJobs";

/**
 * Task to sync all customer schedules from the Recoup Jobs API.
 * Fetches all jobs and creates schedules for each enabled job.
 * Can be run manually to sync schedules.
 */
export const syncCustomerSchedules = task({
  id: "sync-customer-schedules",
  run: async () => {
    logger.log("Fetching all jobs from Recoup Jobs API...");

    const jobs = await fetchAllJobs();

    if (!jobs) {
      logger.error("Failed to fetch jobs, aborting sync");
      return;
    }

    logger.log(`Found ${jobs.length} jobs`);

    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const job of jobs) {
      // Skip disabled jobs
      if (job.enabled === false) {
        logger.log(`Skipping disabled job: ${job.id} - ${job.title}`);
        skippedCount++;
        continue;
      }

      try {
        await schedules.create({
          task: "customer-prompt-task",
          cron: job.schedule,
          externalId: job.id,
          deduplicationKey: job.id,
        });

        logger.log(`Created schedule for job: ${job.id} - ${job.title}`, {
          schedule: job.schedule,
          deduplicationKey: job.id,
        });

        createdCount++;
      } catch (error) {
        logger.error(`Failed to create schedule for job: ${job.id}`, {
          error,
          jobTitle: job.title,
        });
        errorCount++;
      }
    }

    logger.log("Sync completed", {
      totalJobs: jobs.length,
      created: createdCount,
      skipped: skippedCount,
      errors: errorCount,
    });
  },
});
