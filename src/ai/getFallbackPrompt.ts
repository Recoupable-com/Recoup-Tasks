/**
 * Returns a generic feature implementation prompt used as a fallback
 * when Claude Code fails to generate a specific one from recent commits.
 */
export function getFallbackPrompt(): string {
  return [
    "Read PROGRESS_USAGE.md and PROGRESS.md in the mono repo codebase first.",
    "",
    "Review the last 10 commits across the api, chat, admin, and tasks submodules.",
    "Identify the single most impactful small improvement that builds on recent work",
    "— a bug fix, a missing endpoint, a UI polish, or a small new feature.",
    "",
    "Implement it end-to-end (API route + frontend if needed), write any relevant tests,",
    "then update PROGRESS.md with what you built.",
  ].join("\n");
}
