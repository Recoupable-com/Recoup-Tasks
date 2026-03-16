import type { Sandbox } from "@vercel/sandbox";
import { runClaudeCodeAgent } from "./runClaudeCodeAgent";
import { parsePRUrls, type ParsedPR } from "./parsePRUrls";
import { SUBMODULE_CONFIG } from "./submoduleConfig";

interface PushAndCreatePRsOptions {
  prompt: string;
  branch: string;
}

/**
 * Delegates push + PR creation to the Claude Code agent.
 * Instructs the agent to create branches, commit, push, and open PRs
 * for each changed submodule. Parses PR_CREATED sentinel lines from stdout.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param options - The prompt and branch name
 * @returns Array of parsed PR objects
 */
export async function pushAndCreatePRsViaAgent(
  sandbox: Sandbox,
  options: PushAndCreatePRsOptions,
): Promise<ParsedPR[]> {
  const { prompt, branch } = options;

  const submoduleInstructions = Object.entries(SUBMODULE_CONFIG)
    .map(([name, { repo, baseBranch }]) => `  - ${name}: repo=${repo}, base branch=${baseBranch}`)
    .join("\n");

  const result = await runClaudeCodeAgent(sandbox, {
    label: "Push and create PRs via agent",
    message: [
      `There are two steps: first handle mono repo root changes, then handle submodule changes.`,
      ``,
      `## Step 1: Push mono repo root changes directly to main`,
      ``,
      `Check for any changed or untracked files in the mono repo root (outside submodule directories).`,
      `This includes progress files like progress.md, progress.txt, PROGRESS_USAGE.md, etc.`,
      `If there are changes in the mono repo root:`,
      `1. git add any changed/untracked files in the root`,
      `2. git commit -m "agent: ${prompt.slice(0, 72)}"`,
      `3. push directly to main: git push origin main`,
      ``,
      `If there are no mono repo root changes, skip this step.`,
      ``,
      `## Step 2: Create PRs for each changed submodule`,
      ``,
      `For each submodule that has uncommitted changes, create a branch, commit, push, and open a PR.`,
      ``,
      `Branch name: ${branch}`,
      `PR title: agent: ${prompt.slice(0, 72)}`,
      `PR body: Automated PR from coding agent.\n\nPrompt: ${prompt}`,
      ``,
      `Submodule config (name: repo, base branch to target):`,
      submoduleInstructions,
      ``,
      `Steps for each changed submodule:`,
      `1. cd into the submodule directory`,
      `2. git checkout -b ${branch}`,
      `3. git add -A`,
      `4. git commit -m "agent: ${prompt.slice(0, 72)}"`,
      `5. git push -u origin ${branch}`,
      `6. gh pr create --repo <repo> --base <baseBranch> --head ${branch} --title "agent: ${prompt.slice(0, 72)}" --body "Automated PR from coding agent."`,
      ``,
      `IMPORTANT: After each PR is created, output exactly this line:`,
      `PR_CREATED: <the full PR URL>`,
      ``,
      `If a submodule has no changes, skip it.`,
    ].join("\n"),
  });

  return parsePRUrls(result.stdout);
}
