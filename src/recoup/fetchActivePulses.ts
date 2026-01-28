import { logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { NEW_API_BASE_URL, RECOUP_API_KEY } from "../consts";

const pulseSchema = z.object({
  id: z.string().nullable(),
  account_id: z.string(),
  active: z.boolean(),
});

const pulsesResponseSchema = z.object({
  status: z.literal("success"),
  pulses: z.array(pulseSchema),
});

export type Pulse = z.infer<typeof pulseSchema>;

/**
 * Fetches all active pulse accounts from the Recoup API.
 * Uses the RECOUP_API_KEY to access all pulse records.
 *
 * @returns Array of active pulse accounts, or empty array on error
 */
export async function fetchActivePulses(): Promise<Pulse[]> {
  if (!RECOUP_API_KEY) {
    logger.error("RECOUP_API_KEY is not set");
    return [];
  }

  const pulsesApiUrl = `${NEW_API_BASE_URL}/api/pulses?active=true`;

  try {
    const response = await fetch(pulsesApiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": RECOUP_API_KEY,
      },
    });

    if (!response.ok) {
      logger.error("Recoup Pulses API error", {
        status: response.status,
        statusText: response.statusText,
      });
      return [];
    }

    const json = (await response.json()) as unknown;
    const validationResult = pulsesResponseSchema.safeParse(json);

    if (!validationResult.success) {
      logger.error("Invalid pulses response from Recoup API", {
        errors: validationResult.error.issues,
      });
      return [];
    }

    const pulses = validationResult.data.pulses;

    logger.log("Fetched active pulses", {
      count: pulses.length,
      pulses: pulses.map((p) => ({
        id: p.id,
        account_id: p.account_id,
        active: p.active,
      })),
    });

    return pulses;
  } catch (error) {
    logger.error("Failed to fetch active pulses from Recoup API", { error });
    return [];
  }
}
