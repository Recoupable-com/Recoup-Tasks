import { SUBMODULE_CONFIG } from "./submoduleConfig";

export interface ParsedPR {
  repo: string;
  number: number;
  url: string;
  baseBranch: string;
}

/**
 * Parses `PR_CREATED: <url>` sentinel lines from agent stdout.
 * Uses SUBMODULE_CONFIG to look up baseBranch from the repo slug.
 *
 * @param stdout - Raw stdout from the OpenClaw agent
 * @returns Array of parsed PR objects
 */
export function parsePRUrls(stdout: string): ParsedPR[] {
  const lines = stdout.split("\n");
  const prs: ParsedPR[] = [];

  for (const line of lines) {
    const match = line.match(
      /^PR_CREATED:\s*(https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+))\s*$/,
    );
    if (!match) continue;

    const url = match[1];
    const repo = match[2];
    const number = parseInt(match[3], 10);

    // Look up baseBranch from SUBMODULE_CONFIG by matching the repo
    const configEntry = Object.values(SUBMODULE_CONFIG).find(c => c.repo === repo);
    const baseBranch = configEntry?.baseBranch ?? "main";

    prs.push({ repo, number, url, baseBranch });
  }

  return prs;
}
