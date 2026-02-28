import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { runGitCommand } from "./runGitCommand";

const SUBMODULE_CONFIG: Record<string, { repo: string; baseBranch: string }> = {
  api: { repo: "recoupable/recoup-api", baseBranch: "test" },
  chat: { repo: "recoupable/chat", baseBranch: "test" },
  tasks: { repo: "recoupable/tasks", baseBranch: "main" },
  docs: { repo: "recoupable/docs", baseBranch: "main" },
  database: { repo: "recoupable/database", baseBranch: "main" },
  remotion: { repo: "recoupable/remotion", baseBranch: "main" },
  bash: { repo: "recoupable/bash", baseBranch: "main" },
  skills: { repo: "recoupable/skills", baseBranch: "main" },
  cli: { repo: "recoupable/cli", baseBranch: "main" },
};

interface CreateSubmodulePROptions {
  submodule: string;
  branch: string;
  prompt: string;
  monorepoDir: string;
}

interface SubmodulePR {
  repo: string;
  number: number;
  url: string;
  baseBranch: string;
}

/**
 * Creates a feature branch, commits changes, pushes, and opens a PR
 * for a single submodule. Uses the correct base branch per CLAUDE.md rules.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param options - Submodule name, branch, prompt, and monorepo directory
 * @returns PR info or null if creation failed
 */
export async function createSubmodulePR(
  sandbox: Sandbox,
  options: CreateSubmodulePROptions,
): Promise<SubmodulePR | null> {
  const { submodule, branch, prompt, monorepoDir } = options;
  const config = SUBMODULE_CONFIG[submodule];

  if (!config) {
    logger.error(`Unknown submodule: ${submodule}`);
    return null;
  }

  const subDir = `${monorepoDir}/${submodule}`;
  const { repo, baseBranch } = config;

  logger.log(`Creating PR for ${submodule}`, { branch, baseBranch, repo });

  // Create branch, stage, commit, push
  await runGitCommand(sandbox, ["-C", subDir, "checkout", "-b", branch], "create branch", subDir);
  await runGitCommand(sandbox, ["-C", subDir, "add", "-A"], "stage changes", subDir);
  await runGitCommand(
    sandbox,
    ["-C", subDir, "commit", "-m", `agent: ${prompt.slice(0, 72)}`],
    "commit changes",
    subDir,
  );
  await runGitCommand(
    sandbox,
    ["-C", subDir, "push", "-u", "origin", branch],
    "push branch",
    subDir,
  );

  // Create PR via gh CLI
  const prResult = await sandbox.runCommand({
    cmd: "gh",
    args: [
      "pr", "create",
      "--repo", repo,
      "--base", baseBranch,
      "--head", branch,
      "--title", `agent: ${prompt.slice(0, 72)}`,
      "--body", `Automated PR from coding agent.\n\nPrompt: ${prompt}`,
    ],
    env: { GH_TOKEN: process.env.GITHUB_TOKEN || "" },
  });

  if (prResult.exitCode !== 0) {
    const stderr = (await prResult.stderr()) || "";
    logger.error(`Failed to create PR for ${submodule}`, { stderr });
    return null;
  }

  const prUrl = ((await prResult.stdout()) || "").trim();
  const prNumber = parseInt(prUrl.split("/").pop() || "0", 10);

  logger.log(`PR created for ${submodule}`, { url: prUrl, number: prNumber });

  return { repo, number: prNumber, url: prUrl, baseBranch };
}
