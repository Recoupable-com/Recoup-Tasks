/**
 * Returns Vercel Sandbox credentials from environment variables.
 *
 * @throws Error if any required variable is missing
 */
export function getVercelSandboxCredentials() {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!token || !teamId || !projectId) {
    throw new Error(
      "Missing Vercel credentials. Set VERCEL_TOKEN, VERCEL_TEAM_ID, and VERCEL_PROJECT_ID."
    );
  }

  return { token, teamId, projectId };
}
