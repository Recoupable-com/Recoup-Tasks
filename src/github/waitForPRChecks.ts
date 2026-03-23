import { logger, wait } from "@trigger.dev/sdk/v3";

export interface PRCheckResult {
  allPassed: boolean;
  failedChecks: string[];
  pendingChecks: string[];
}

/**
 * Polls the GitHub API until all check runs on a PR complete or the timeout is reached.
 * Returns whether all checks passed and a list of any failed check names.
 *
 * @param repo - GitHub repo in "owner/repo" format
 * @param prNumber - The PR number
 * @param maxWaitMs - How long to wait before giving up (default 15 minutes)
 */
export async function waitForPRChecks(
  repo: string,
  prNumber: number,
  maxWaitMs: number = 15 * 60 * 1000,
): Promise<PRCheckResult> {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
  };
  const startTime = Date.now();

  // Get the head SHA from the PR
  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
    headers,
  });

  if (!prRes.ok) {
    logger.warn(`Failed to fetch PR #${prNumber} from ${repo}`, { status: prRes.status });
    return { allPassed: false, failedChecks: [], pendingChecks: ["fetch-failed"] };
  }

  const pr = (await prRes.json()) as { head: { sha: string } };
  const headSha = pr.head.sha;

  while (Date.now() - startTime < maxWaitMs) {
    const checksRes = await fetch(
      `https://api.github.com/repos/${repo}/commits/${headSha}/check-runs`,
      { headers },
    );

    if (!checksRes.ok) {
      logger.warn(`Failed to fetch check runs for ${repo}/${headSha}`);
      return { allPassed: false, failedChecks: [], pendingChecks: ["fetch-failed"] };
    }

    const checksData = (await checksRes.json()) as {
      check_runs: Array<{ name: string; status: string; conclusion: string | null }>;
    };

    const checks = checksData.check_runs;

    if (checks.length > 0) {
      const pending = checks.filter((c) => c.status !== "completed");
      const failed = checks.filter(
        (c) =>
          c.status === "completed" &&
          c.conclusion !== "success" &&
          c.conclusion !== "skipped" &&
          c.conclusion !== "neutral",
      );

      if (pending.length === 0) {
        logger.log(`All checks complete for PR #${prNumber}`, {
          total: checks.length,
          failed: failed.length,
        });
        return {
          allPassed: failed.length === 0,
          failedChecks: failed.map((c) => c.name),
          pendingChecks: [],
        };
      }

      logger.log(`Waiting for ${pending.length} checks on PR #${prNumber}`, {
        pending: pending.map((c) => c.name),
      });
    }

    await wait.for({ seconds: 30 });
  }

  return { allPassed: false, failedChecks: [], pendingChecks: ["timeout"] };
}
