import { logger } from "@trigger.dev/sdk/v3";
import { SUBMODULE_CONFIG } from "../sandboxes/submoduleConfig";

export interface SubmoduleCommit {
  submodule: string;
  repo: string;
  commits: { sha: string; message: string; author: string; date: string }[];
}

/**
 * Fetches the 5 most recent commits from each submodule repo via the GitHub REST API.
 * Skips repos where the request fails (e.g. missing token or rate limit).
 */
export async function fetchRecentSubmoduleCommits(): Promise<SubmoduleCommit[]> {
  const token = process.env.GITHUB_TOKEN;
  const results: SubmoduleCommit[] = [];

  for (const [submodule, { repo }] of Object.entries(SUBMODULE_CONFIG)) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repo}/commits?per_page=5`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
      );

      if (!response.ok) {
        logger.warn(`Failed to fetch commits for ${repo}`, { status: response.status });
        continue;
      }

      const data = (await response.json()) as Array<{
        sha: string;
        commit: { message: string; author: { name: string; date: string } };
      }>;

      results.push({
        submodule,
        repo,
        commits: data.map((c) => ({
          sha: c.sha.slice(0, 7),
          message: c.commit.message.split("\n")[0],
          author: c.commit.author.name,
          date: c.commit.author.date,
        })),
      });
    } catch (error) {
      logger.warn(`Error fetching commits for ${repo}`, { error });
    }
  }

  return results;
}
