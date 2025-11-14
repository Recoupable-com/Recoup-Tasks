import { logger, wait } from "@trigger.dev/sdk/v3";
import { getArtistSocials } from "../recoup/getArtistSocials";

/**
 * Fetches socials for all artists in batches to avoid overwhelming the API.
 * Returns a Map of artistId -> socials array.
 */
export async function getBatchArtistSocials(
  artistIds: string[],
  batchSize: number = 10
): Promise<Map<string, Awaited<ReturnType<typeof getArtistSocials>>>> {
  const artistSocialsMap = new Map<
    string,
    Awaited<ReturnType<typeof getArtistSocials>>
  >();

  // Get all socials for all artists (in batches)
  for (let i = 0; i < artistIds.length; i += batchSize) {
    const artistBatch = artistIds.slice(i, i + batchSize);
    logger.log(
      `Fetching socials batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(
        artistIds.length / batchSize
      )}`,
      {
        batchStart: i + 1,
        batchEnd: Math.min(i + batchSize, artistIds.length),
        batchSize: artistBatch.length,
      }
    );

    const socialsResponses = await Promise.all(
      artistBatch.map((artistId) => getArtistSocials(artistId))
    );

    // Store socials in map
    for (let j = 0; j < artistBatch.length; j++) {
      artistSocialsMap.set(artistBatch[j], socialsResponses[j]);
    }

    await wait.for({ seconds: 1 });
  }

  return artistSocialsMap;
}
