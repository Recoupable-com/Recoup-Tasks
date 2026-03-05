import { logger } from "@trigger.dev/sdk/v3";

/**
 * Lists mp3 files available in an artist's GitHub repo.
 * Returns the file paths relative to the repo root.
 */
export async function listArtistSongs(
  githubRepoUrl: string,
  artistSlug: string,
): Promise<string[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required to list artist songs");
  }

  const match = githubRepoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    throw new Error(`Invalid GitHub repo URL: ${githubRepoUrl}`);
  }
  const [, owner, repo] = match;

  // Get the full recursive file tree
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

  if (!response.ok) {
    throw new Error(`GitHub API error listing files: ${response.status}`);
  }

  const data = (await response.json()) as {
    tree: Array<{ path: string; type: string }>;
  };

  // Find mp3 files under the artist's directory
  const artistPrefix = `artists/${artistSlug}/`;
  const mp3Files = data.tree
    .filter(
      entry =>
        entry.type === "blob" &&
        entry.path.startsWith(artistPrefix) &&
        entry.path.toLowerCase().endsWith(".mp3"),
    )
    .map(entry => entry.path);

  logger.log("Found artist songs", {
    artistSlug,
    songCount: mp3Files.length,
    songs: mp3Files.map(p => p.split("/").pop()),
  });

  return mp3Files;
}
