import { logger } from "@trigger.dev/sdk/v3";

/**
 * Finds the Vercel preview deployment URL for a PR by inspecting
 * check runs created by the Vercel GitHub integration.
 * Returns null if no Vercel deployment is found.
 *
 * @param repo - GitHub repo in "owner/repo" format
 * @param prNumber - The PR number
 */
export async function getVercelPreviewUrl(
  repo: string,
  prNumber: number,
): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
  };

  const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
    headers,
  });

  if (!prRes.ok) return null;

  const pr = (await prRes.json()) as { head: { sha: string } };

  const checksRes = await fetch(
    `https://api.github.com/repos/${repo}/commits/${pr.head.sha}/check-runs`,
    { headers },
  );

  if (!checksRes.ok) return null;

  const checksData = (await checksRes.json()) as {
    check_runs: Array<{ name: string; details_url: string | null; conclusion: string | null }>;
  };

  const vercelCheck = checksData.check_runs.find(
    (c) => c.name.toLowerCase().includes("vercel") && c.details_url?.includes("vercel.app"),
  );

  if (!vercelCheck?.details_url) return null;

  // Vercel details_url is the inspect URL: https://vercel.com/...
  // Extract the preview deployment URL from the deployment status instead
  const statusRes = await fetch(
    `https://api.github.com/repos/${repo}/commits/${pr.head.sha}/statuses`,
    { headers },
  );

  if (!statusRes.ok) return null;

  const statuses = (await statusRes.json()) as Array<{
    context: string;
    target_url: string;
    state: string;
  }>;

  const vercelStatus = statuses.find(
    (s) =>
      s.context.toLowerCase().includes("vercel") &&
      s.state === "success" &&
      s.target_url?.includes("vercel.app"),
  );

  if (vercelStatus?.target_url) {
    logger.log(`Found Vercel preview URL for PR #${prNumber}`, { url: vercelStatus.target_url });
    return vercelStatus.target_url;
  }

  return null;
}
