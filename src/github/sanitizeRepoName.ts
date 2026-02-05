/**
 * Sanitizes a string for use as a GitHub repository name.
 * Lowercases, replaces spaces and special characters with hyphens,
 * collapses multiple hyphens, and trims leading/trailing hyphens.
 *
 * @param name - The raw name to sanitize
 * @returns A valid GitHub repo name
 */
export function sanitizeRepoName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return sanitized || "account";
}
