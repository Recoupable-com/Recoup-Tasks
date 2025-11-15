import type { ArtistSocialProfile } from "../recoup/getArtistSocials";

/**
 * Checks if a social profile can be scraped based on its profile_url.
 * Scrapable platforms:
 * - x.com or twitter.com
 * - instagram.com
 * - tiktok.com
 * - threads.com
 * - facebook.com
 * - youtube.com
 *
 * Non-scrapable platforms:
 * - open.spotify.com
 */
export function isScrapableSocial(social: ArtistSocialProfile): boolean {
  const profileUrl = social.profile_url.toLowerCase();

  // Filter out non-scrapable platforms
  if (profileUrl.includes("open.spotify.com")) {
    return false;
  }

  // Check for scrapable platforms
  const scrapableDomains = [
    // X
    "x.com",
    "twitter.com",
    // Instagram
    "instagram.com",
    // TikTok
    "tiktok.com",
    // Threads
    "threads.com",
    "threads.net",
    // Facebook
    "facebook.com",
    // YouTube
    "youtube.com",
  ];

  return scrapableDomains.some((domain) => profileUrl.includes(domain));
}
