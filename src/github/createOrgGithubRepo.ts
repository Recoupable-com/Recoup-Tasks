import { logger } from "@trigger.dev/sdk/v3";
import { sanitizeRepoName } from "./sanitizeRepoName";
import { getExistingGithubRepo } from "./getExistingGithubRepo";

const GITHUB_ORG = "recoupable";

/**
 * Creates a private GitHub repository for an organization in the
 * {@link GITHUB_ORG} GitHub organization.
 *
 * Repo naming: `org-{sanitizedName}-{orgId}`
 *
 * @param orgName - The organization display name
 * @param orgId - The organization UUID
 * @returns The repository HTML URL, or undefined on error
 */
export async function createOrgGithubRepo(
  orgName: string,
  orgId: string,
): Promise<string | undefined> {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    logger.error("Missing GITHUB_TOKEN environment variable");
    return undefined;
  }

  const sanitizedName = sanitizeRepoName(orgName);
  const repoName = `org-${sanitizedName}-${orgId}`;

  logger.log("Creating org GitHub repository", {
    org: GITHUB_ORG,
    repoName,
    visibility: "private",
  });

  try {
    const response = await fetch(`https://api.github.com/orgs/${GITHUB_ORG}/repos`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        name: repoName,
        private: true,
        auto_init: true,
      }),
    });

    if (!response.ok) {
      // 422 means repo already exists — fetch existing URL
      if (response.status === 422) {
        return getExistingGithubRepo(repoName);
      }

      const errorText = await response.text();
      logger.error("Failed to create org GitHub repo", {
        status: response.status,
        error: errorText,
      });
      return undefined;
    }

    const data = (await response.json()) as { html_url: string };

    logger.log("Org GitHub repository created", {
      repoName,
      url: data.html_url,
    });

    return data.html_url;
  } catch (error) {
    logger.error("Error creating org GitHub repo", {
      repoName,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
