/**
 * Fetches artist context (artist.md) from GitHub.
 * Returns placeholder if not found.
 */
export async function fetchArtistContext(
  githubRepo: string,
  artistSlug: string,
  fetchFile: (repo: string, path: string) => Promise<Buffer | null>,
): Promise<string> {
  const buffer = await fetchFile(
    githubRepo,
    `artists/${artistSlug}/context/artist.md`,
  );
  if (!buffer) return "(no artist identity available)";
  const content = buffer.toString("utf-8");
  // Strip frontmatter if present
  return content.replace(/^---[\s\S]*?---\s*/, "").trim();
}
