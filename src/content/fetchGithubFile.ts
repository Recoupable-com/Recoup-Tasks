import { logger } from "@trigger.dev/sdk/v3";

/**
 * Fetches a raw file from a GitHub repo via the API.
 * If the file isn't found in the main repo, checks submodule org repos.
 *
 * @param githubRepoUrl
 * @param filePath
 * @returns The file as a Buffer, or null if not found anywhere.
 */
export async function fetchGithubFile(
  githubRepoUrl: string,
  filePath: string,
): Promise<Buffer | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required to fetch artist files from GitHub");
  }

  // Try the main repo first
  const result = await fetchFileFromRepo(githubRepoUrl, filePath, token);
  if (result) return result;

  // Not found — try submodule org repos
  logger.log("File not in main repo, checking submodules", { filePath });
  const orgRepos = await getOrgRepoUrls(githubRepoUrl, token);

  for (const orgRepoUrl of orgRepos) {
    const orgResult = await fetchFileFromRepo(orgRepoUrl, filePath, token);
    if (orgResult) {
      logger.log("Found file in org repo", {
        filePath,
        orgRepo: orgRepoUrl.split("/").pop(),
      });
      return orgResult;
    }
  }

  return null;
}

/**
 * Fetches a file from a specific GitHub repo.
 *
 * @param githubRepoUrl
 * @param filePath
 * @param token
 */
async function fetchFileFromRepo(
  githubRepoUrl: string,
  filePath: string,
  token: string,
): Promise<Buffer | null> {
  const { owner, repo } = parseRepoUrl(githubRepoUrl);

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

/**
 * Reads .gitmodules from the main repo and extracts org submodule URLs.
 *
 * @param githubRepoUrl
 * @param token
 */
async function getOrgRepoUrls(githubRepoUrl: string, token: string): Promise<string[]> {
  const gitmodules = await fetchFileFromRepo(githubRepoUrl, ".gitmodules", token);
  if (!gitmodules) return [];

  const content = gitmodules.toString("utf-8");
  const urls: string[] = [];

  // Parse [submodule "..."] entries with url = https://github.com/...
  const urlMatches = content.matchAll(/url\s*=\s*(https:\/\/github\.com\/[^\s]+)/g);
  for (const match of urlMatches) {
    urls.push(match[1]);
  }

  return urls;
}

/**
 *
 * @param githubRepoUrl
 */
function parseRepoUrl(githubRepoUrl: string): { owner: string; repo: string } {
  const match = githubRepoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    throw new Error(`Invalid GitHub repo URL: ${githubRepoUrl}`);
  }
  return { owner: match[1], repo: match[2] };
}
