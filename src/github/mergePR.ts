import { logger } from "@trigger.dev/sdk/v3";

/**
 * Merges a GitHub PR using the squash merge strategy.
 * Returns true if the merge was successful, false otherwise.
 *
 * @param repo - GitHub repo in "owner/repo" format
 * @param prNumber - The PR number to merge
 */
export async function mergePR(repo: string, prNumber: number): Promise<boolean> {
  const token = process.env.GITHUB_TOKEN;

  const response = await fetch(
    `https://api.github.com/repos/${repo}/pulls/${prNumber}/merge`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        merge_method: "squash",
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`Failed to merge PR #${prNumber} in ${repo}`, {
      status: response.status,
      error: errorText,
    });
    return false;
  }

  logger.log(`Successfully merged PR #${prNumber} in ${repo}`);
  return true;
}
