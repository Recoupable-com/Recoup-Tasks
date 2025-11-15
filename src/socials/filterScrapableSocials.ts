import { logger } from "@trigger.dev/sdk/v3";
import { getArtistSocials } from "../recoup/getArtistSocials";
import { isScrapableSocial } from "../artists/isScrapableSocial";

export type ScrapableSocial = {
  artistId: string;
  socialId: string;
  username: string;
  profile_url: string;
};

/**
 * Filters and collects all scrapable socials from the artist socials map.
 * Returns an array of scrapable socials with their associated artist IDs.
 */
export function filterScrapableSocials(
  artistIds: string[],
  artistSocialsMap: Map<
    string,
    Awaited<ReturnType<typeof getArtistSocials>> | undefined
  >
): ScrapableSocial[] {
  const scrapableSocials: ScrapableSocial[] = [];
  const nonScrapableSocials: Array<{
    artistId: string;
    socialId: string;
    username: string;
    profile_url: string;
  }> = [];

  for (const artistId of artistIds) {
    const socials = artistSocialsMap.get(artistId);
    if (!socials) continue;

    for (const social of socials) {
      // Filter out non-scrapable socials (e.g., Spotify)
      if (!isScrapableSocial(social)) {
        nonScrapableSocials.push({
          artistId,
          socialId: social.social_id,
          username: social.username,
          profile_url: social.profile_url,
        });
        continue;
      }

      scrapableSocials.push({
        artistId,
        socialId: social.social_id,
        username: social.username,
        profile_url: social.profile_url,
      });
    }
  }

  // Log all non-scrapable socials in a single log
  if (nonScrapableSocials.length > 0) {
    logger.log("Skipping non-scrapable socials", {
      count: nonScrapableSocials.length,
      socials: nonScrapableSocials,
    });
  }

  return scrapableSocials;
}
