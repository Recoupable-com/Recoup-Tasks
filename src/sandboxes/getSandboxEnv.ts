/**
 * Builds the environment variables to inject into sandbox commands.
 * Shared by runSandboxCommandTask and codingAgentTask.
 */
export function getSandboxEnv(
  accountId: string
): Record<string, string> {
  const apiKey = process.env.RECOUP_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RECOUP_API_KEY environment variable");
  }

  const env: Record<string, string> = {
    RECOUP_API_KEY: apiKey,
    RECOUP_ACCOUNT_ID: accountId,
  };

  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken) {
    env.GITHUB_TOKEN = githubToken;
  }

  const chartmetricRefreshToken = process.env.CHARTMETRIC_REFRESH_TOKEN;
  if (chartmetricRefreshToken) {
    env.CHARTMETRIC_REFRESH_TOKEN = chartmetricRefreshToken;
  }

  return env;
}
