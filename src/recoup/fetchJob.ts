import { logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";

// Zod schema for validating job response from Recoup Jobs API
const jobResponseSchema = z.object({
  status: z.literal("success"),
  jobs: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      prompt: z.string(),
      schedule: z.string(),
      account_id: z.string(),
      artist_account_id: z.string(),
      enabled: z.boolean().nullable(),
    })
  ),
});

// Zod schema for validating customer config
const customerConfigSchema = z.object({
  prompt: z.string().min(1).optional(),
  accountId: z.string().min(1).optional(),
  roomId: z.string().min(1).optional(),
  artistId: z.string().optional(),
  model: z.string().optional(),
});

export type CustomerConfig = z.infer<typeof customerConfigSchema>;

/**
 * Fetches a job from the Recoup Jobs API using the externalId (job ID).
 * Returns the job data mapped to CustomerConfig format, or undefined if:
 * - No externalId provided
 * - Job not found
 * - Job is disabled
 * - API error occurs
 */
export async function fetchJob(
  externalId?: string
): Promise<CustomerConfig | undefined> {
  if (!externalId) {
    return undefined;
  }

  const jobsApiUrl =
    process.env.RECOUP_JOBS_API_URL ?? "https://api.recoupable.com/api/jobs";

  try {
    const response = await fetch(`${jobsApiUrl}?id=${externalId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      logger.error("Recoup Jobs API error", {
        externalId,
        status: response.status,
        statusText: response.statusText,
      });
      return undefined;
    }

    const json = (await response.json()) as unknown;
    const validationResult = jobResponseSchema.safeParse(json);

    if (!validationResult.success) {
      logger.error("Invalid job response from Recoup Jobs API", {
        externalId,
        errors: validationResult.error.issues,
      });
      return undefined;
    }

    const jobData = validationResult.data;
    const job = jobData.jobs[0];

    if (!job) {
      logger.error("No job found for externalId", { externalId });
      return undefined;
    }

    if (job.enabled === false) {
      logger.log("Job is disabled, skipping", { externalId, jobId: job.id });
      return undefined;
    }

    // Map job data to customer config format
    return {
      prompt: job.prompt,
      accountId: job.account_id,
      artistId: job.artist_account_id,
    };
  } catch (error) {
    logger.error("Failed to fetch job from Recoup Jobs API", {
      externalId,
      error,
    });
    return undefined;
  }
}
