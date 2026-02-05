import { logger } from "@trigger.dev/sdk/v3";
import { sanitizeRepoName } from "./sanitizeRepoName";

const GITHUB_ORG = "Recoupable-Com";

/**
 * Creates a private GitHub repository in the Recoupable-Com organization.
 *
 * @param accountName - The account display name
 * @param accountId - The account UUID
 * @returns The repository HTML URL, or undefined on error
 */
export async function createGithubRepo(
  accountName: string,
  accountId: string
): Promise<string | undefined> {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    logger.error("Missing GITHUB_TOKEN environment variable");
    return undefined;
  }

  const sanitizedName = sanitizeRepoName(accountName);
  const repoName = `${sanitizedName}-${accountId}`;

  logger.log("Creating GitHub repository", {
    org: GITHUB_ORG,
    repoName,
    visibility: "private",
  });

  try {
    const response = await fetch(
      `https://api.github.com/orgs/${GITHUB_ORG}/repos`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          name: repoName,
          private: true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Failed to create GitHub repo", {
        status: response.status,
        error: errorText,
      });
      return undefined;
    }

    const data = (await response.json()) as { html_url: string };

    logger.log("GitHub repository created", {
      repoName,
      url: data.html_url,
    });

    return data.html_url;
  } catch (error) {
    logger.error("Error creating GitHub repo", {
      repoName,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
