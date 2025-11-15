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

  for (const artistId of artistIds) {
    const socials = artistSocialsMap.get(artistId);
    if (!socials) continue;

    for (const social of socials) {
      // Filter out non-scrapable socials (e.g., Spotify)
      if (!isScrapableSocial(social)) {
        logger.log("Skipping non-scrapable social", {
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

  return scrapableSocials;
}
