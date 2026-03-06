import type { Sandbox } from "@vercel/sandbox";
import { runOpenClawAgent } from "./runOpenClawAgent";
import { parsePRUrls, type ParsedPR } from "./parsePRUrls";
import { SUBMODULE_CONFIG } from "./submoduleConfig";

interface PushAndCreatePRsOptions {
  prompt: string;
  branch: string;
  env?: Record<string, string>;
}

/**
 * Delegates push + PR creation to the OpenClaw agent.
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
  const { prompt, branch, env } = options;

  const submoduleInstructions = Object.entries(SUBMODULE_CONFIG)
    .map(([name, { repo, baseBranch }]) => `  - ${name}: repo=${repo}, base branch=${baseBranch}`)
    .join("\n");

  const result = await runOpenClawAgent(sandbox, {
    label: "Push and create PRs via agent",
    env,
    message: [
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
