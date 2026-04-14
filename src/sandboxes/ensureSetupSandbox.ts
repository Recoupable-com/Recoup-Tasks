import type { Sandbox } from "@vercel/sandbox";
import { installSkills } from "./installSkills";
import { runSetupSandboxSkill } from "./runSetupSandboxSkill";
import { runSetupArtistSkill } from "./runSetupArtistSkill";
import { logStep } from "./logStep";
/**
 * Ensures the sandbox has the org/artist folder structure set up.
 * Installs skills from recoupable/skills, runs setup-sandbox, then artist-workspace.
 * Idempotent — skips if `orgs/` directory already exists.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID for the sandbox owner
 */
export async function ensureSetupSandbox(
  sandbox: Sandbox,
  accountId: string
): Promise<void> {
  logStep("Installing skills");

  await installSkills(sandbox, "recoupable/skills");

  if (!process.env.RECOUP_API_KEY) {
    throw new Error("Missing RECOUP_API_KEY environment variable");
  }

  const env = {
    RECOUP_API_KEY: process.env.RECOUP_API_KEY,
    RECOUP_ACCOUNT_ID: accountId,
  };

  logStep("Running setup-sandbox skill");
  await runSetupSandboxSkill(sandbox, env);
  logStep("Setup-sandbox complete", false);

  logStep("Running artist-workspace skill");
  await runSetupArtistSkill(sandbox, env);
  logStep("Artist-workspace complete", false);
}
