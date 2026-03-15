/**
 * Fetches audience context (audience.md) from GitHub.
 * Returns placeholder if not found.
 *
 * @param githubRepo
 * @param artistSlug
 * @param fetchFile
 */
export async function fetchAudienceContext(
  githubRepo: string,
  artistSlug: string,
  fetchFile: (repo: string, path: string) => Promise<Buffer | null>,
): Promise<string> {
  const buffer = await fetchFile(githubRepo, `artists/${artistSlug}/context/audience.md`);
  if (!buffer) return "(no audience context available)";
  return buffer
    .toString("utf-8")
    .replace(/^---[\s\S]*?---\s*/, "")
    .trim();
}
