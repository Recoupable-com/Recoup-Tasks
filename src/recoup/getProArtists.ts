import { logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";

const proArtistsResponseSchema = z.object({
  status: z.literal("success"),
  artists: z.array(z.string()),
});

const PRO_ARTISTS_API_URL = "https://api.recoupable.com/api/artists/pro";

export async function getProArtists(): Promise<string[] | undefined> {
  try {
    const response = await fetch(PRO_ARTISTS_API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
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
