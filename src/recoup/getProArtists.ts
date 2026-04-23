import { logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { NEW_API_BASE_URL, RECOUP_API_KEY } from "../consts";

const proArtistsResponseSchema = z.object({
  status: z.literal("success"),
  artists: z.array(z.string()),
});

export async function getProArtists(): Promise<string[] | undefined> {
  if (!RECOUP_API_KEY) {
    logger.error("RECOUP_API_KEY not configured");
    return undefined;
  }

  const url = `${NEW_API_BASE_URL}/api/artists/pro`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": RECOUP_API_KEY,
      },
    });

    if (!response.ok) {
      logger.error("Recoup Pro Artists API error", {
        status: response.status,
        statusText: response.statusText,
      });
      return undefined;
    }

    const json = (await response.json()) as unknown;
    const validation = proArtistsResponseSchema.safeParse(json);

    if (!validation.success) {
      logger.error("Invalid response from Recoup Pro Artists API", {
        errors: validation.error.issues,
      });
      return undefined;
    }

    return validation.data.artists;
  } catch (error) {
    logger.error("Failed to fetch pro artists from Recoup API", {
      error,
    });
    return undefined;
  }
}
