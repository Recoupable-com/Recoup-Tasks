/**
 * Fetches a raw file from a GitHub repo via the API.
 * Returns the file as a Buffer, or null if not found.
 */
export async function fetchGithubFile(
  githubRepoUrl: string,
  filePath: string,
): Promise<Buffer | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required to fetch artist files from GitHub");
  }

  // Parse "https://github.com/owner/repo" → owner, repo
  const match = githubRepoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    throw new Error(`Invalid GitHub repo URL: ${githubRepoUrl}`);
  }
  const [, owner, repo] = match;

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3.raw",
      "User-Agent": "Recoup-Tasks",
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`GitHub API error fetching ${filePath}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
