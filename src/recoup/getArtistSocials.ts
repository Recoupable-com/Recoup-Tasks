import { logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";

const artistSocialsResponseSchema = z.object({
  status: z.literal("success"),
  socials: z.array(
    z.object({
      id: z.string(),
      social_id: z.string(),
      username: z.string(),
      profile_url: z.string().min(1),
      avatar: z.url().nullable(),
      bio: z.string().nullable(),
      follower_count: z.number().nullable(),
      following_count: z.number().nullable(),
      region: z.string().nullable(),
      updated_at: z.string(),
    })
  ),
  pagination: z
    .object({
      total_count: z.number(),
      page: z.number(),
      limit: z.number(),
      total_pages: z.number(),
    })
    .optional(),
});

export type ArtistSocialProfile = z.infer<
  typeof artistSocialsResponseSchema
>["socials"][number];

const ARTIST_SOCIALS_API_URL = "https://api.recoupable.com/api/artist/socials";

export async function getArtistSocials(
  artistAccountId: string
): Promise<ArtistSocialProfile[] | undefined> {
  if (!artistAccountId) {
    logger.error("getArtistSocials called without artistAccountId");
    return undefined;
  }

  try {
    const url = new URL(ARTIST_SOCIALS_API_URL);
    url.searchParams.set("artist_account_id", artistAccountId);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      logger.error("Recoup Artist Socials API error", {
        artistAccountId,
        status: response.status,
        statusText: response.statusText,
      });
      return undefined;
    }

    const json = (await response.json()) as unknown;
    const validation = artistSocialsResponseSchema.safeParse(json);

    if (!validation.success) {
      logger.error("Invalid response from Recoup Artist Socials API", {
        artistAccountId,
        errors: validation.error.issues,
      });
      return undefined;
    }

    return validation.data.socials;
  } catch (error) {
    logger.error("Failed to fetch artist socials from Recoup API", {
      artistAccountId,
      error,
    });
    return undefined;
  }
}
