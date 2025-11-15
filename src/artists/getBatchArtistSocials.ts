import { logger } from "@trigger.dev/sdk/v3";
import { getArtistSocials } from "../recoup/getArtistSocials";

/**
 * Fetches socials for all artists in parallel.
 * Returns a Map of artistId -> socials array.
 */
export async function getBatchArtistSocials(
  artistIds: string[]
): Promise<Map<string, Awaited<ReturnType<typeof getArtistSocials>>>> {
  logger.log("Fetching socials for all artists", {
    totalArtists: artistIds.length,
  });

  const socialsResponses = await Promise.all(
    artistIds.map((artistId) => getArtistSocials(artistId))
  );

  // Store socials in map
  const artistSocialsMap = new Map<
    string,
    Awaited<ReturnType<typeof getArtistSocials>>
  >();

  for (let i = 0; i < artistIds.length; i++) {
    artistSocialsMap.set(artistIds[i], socialsResponses[i]);
  }

  return artistSocialsMap;
}
