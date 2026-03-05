import type { Sandbox } from "@vercel/sandbox";
import { installOpenClaw } from "./installOpenClaw";
import { setupOpenClaw } from "./setupOpenClaw";
import { ensureGithubRepo } from "./ensureGithubRepo";
import { writeReadme } from "./writeReadme";
import { ensureOrgRepos } from "./ensureOrgRepos";
import { ensureSetupSandbox } from "./ensureSetupSandbox";
import { pushSandboxToGithub } from "./pushSandboxToGithub";
import { logStep } from "./logStep";

interface ProvisionSandboxResult {
  githubRepo: string | undefined;
}

/**
 * Provisions a sandbox with the full Recoup environment:
 * OpenClaw CLI + gateway, GitHub repo, README, org repos, and folder structure.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param sandboxId - The sandbox identifier
 * @param accountId - The account ID that owns the sandbox
 * @returns The GitHub repo URL if configured
 */
export async function provisionSandbox(
  sandbox: Sandbox,
  sandboxId: string,
  accountId: string,
): Promise<ProvisionSandboxResult> {
  await installOpenClaw(sandbox);
  await setupOpenClaw(sandbox, accountId);
  logStep("OpenClaw onboard complete, starting gateway");

  const githubRepo = await ensureGithubRepo(sandbox, accountId);
  logStep("GitHub repo ready");

  await writeReadme(sandbox, sandboxId, accountId, githubRepo ?? undefined);
  logStep("README written", false);

  await ensureOrgRepos(sandbox, accountId);

  await ensureSetupSandbox(sandbox, accountId);

  logStep("Pushing to GitHub");
  await pushSandboxToGithub(sandbox);

  return { githubRepo: githubRepo ?? undefined };
}
