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

export type Job = z.infer<typeof jobResponseSchema>["jobs"][number];

/**
 * Fetches all jobs from the Recoup Jobs API.
 * Returns an array of job objects, or undefined on error.
 */
export async function fetchAllJobs(): Promise<Job[] | undefined> {
  const jobsApiUrl = "https://api.recoupable.com/api/jobs";

  try {
    const response = await fetch(jobsApiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      logger.error("Recoup Jobs API error", {
        status: response.status,
        statusText: response.statusText,
      });
      return undefined;
    }

    const json = (await response.json()) as unknown;
    const validationResult = jobResponseSchema.safeParse(json);

    if (!validationResult.success) {
      logger.error("Invalid job response from Recoup Jobs API", {
        errors: validationResult.error.issues,
      });
      return undefined;
    }

    return validationResult.data.jobs;
  } catch (error) {
    logger.error("Failed to fetch jobs from Recoup Jobs API", {
      error,
    });
    return undefined;
  }
}
