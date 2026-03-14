import { logger } from "@trigger.dev/sdk/v3";

/**
 * Lists mp3 files available in an artist's GitHub repo.
 * Checks main repo first, then submodule org repos.
 *
 * @param githubRepoUrl
 * @param artistSlug
 * @returns Array of file paths relative to the repo root.
 */
export async function listArtistSongs(
  githubRepoUrl: string,
  artistSlug: string,
): Promise<string[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required to list artist songs");
  }

  // Try main repo first
  const mainSongs = await listMp3sInRepo(githubRepoUrl, artistSlug, token);
  if (mainSongs.length > 0) return mainSongs;

  // Check submodule org repos
  logger.log("No songs in main repo, checking org submodules");
  const orgRepos = await getOrgRepoUrls(githubRepoUrl, token);
  for (const orgRepoUrl of orgRepos) {
    const orgSongs = await listMp3sInRepo(orgRepoUrl, artistSlug, token);
    if (orgSongs.length > 0) {
      logger.log("Found songs in org repo", {
        orgRepo: orgRepoUrl.split("/").pop(),
        count: orgSongs.length,
      });
      // Store the org repo URL so fetchGithubFile can use it later
      return orgSongs.map(path => `__ORG_REPO__${orgRepoUrl}__${path}`);
    }
  }

  return [];
}

/**
 * Parses an encoded song path to extract the actual repo URL and file path.
 * Song paths from org repos are encoded as: __ORG_REPO__{url}__{path}
 *
 * @param encodedPath
 */
export function parseSongPath(encodedPath: string): {
  repoUrl: string | null;
  filePath: string;
} {
  if (encodedPath.startsWith("__ORG_REPO__")) {
    const parts = encodedPath.replace("__ORG_REPO__", "").split("__");
    return { repoUrl: parts[0], filePath: parts.slice(1).join("__") };
  }
  return { repoUrl: null, filePath: encodedPath };
}

/**
 *
 * @param githubRepoUrl
 * @param artistSlug
 * @param token
 */
async function listMp3sInRepo(
  githubRepoUrl: string,
  artistSlug: string,
  token: string,
): Promise<string[]> {
  const match = githubRepoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return [];
  const [, owner, repo] = match;

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Recoup-Tasks",
      },
    },
  );

  if (!response.ok) return [];

  const data = (await response.json()) as {
    tree: Array<{ path: string; type: string }>;
  };

  const artistPrefix = `artists/${artistSlug}/`;
  return data.tree
    .filter(
      entry =>
        entry.type === "blob" &&
        entry.path.startsWith(artistPrefix) &&
        entry.path.toLowerCase().endsWith(".mp3"),
    )
    .map(entry => entry.path);
}

/**
 *
 * @param githubRepoUrl
 * @param token
 */
async function getOrgRepoUrls(githubRepoUrl: string, token: string): Promise<string[]> {
  const match = githubRepoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return [];
  const [, owner, repo] = match;

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/.gitmodules`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3.raw",
        "User-Agent": "Recoup-Tasks",
      },
    },
  );

  if (!response.ok) return [];

  const content = await response.text();
  const urls: string[] = [];
  const urlMatches = content.matchAll(/url\s*=\s*(https:\/\/github\.com\/[^\s]+)/g);
  for (const m of urlMatches) {
    urls.push(m[1]);
  }
  return urls;
}
