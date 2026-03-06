/**
 * Returns the GitHub HTTPS URL prefix with embedded auth token,
 * or null if GITHUB_TOKEN is not set.
 *
 * Used for git URL rewriting (insteadOf) and authenticated clones.
 */
export function getGitHubAuthPrefix(): string | null {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  return `https://x-access-token:${token}@github.com/`;
}
