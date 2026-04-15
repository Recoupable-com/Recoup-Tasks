import type { Sandbox } from "@vercel/sandbox";
import { installSkills } from "./installSkills";
import { runSetupSandboxSkill } from "./runSetupSandboxSkill";
import { logStep } from "./logStep";
import { getSandboxHomeDir } from "./getSandboxHomeDir";

/**
 * Ensures the sandbox has the org/artist folder structure set up.
 * Installs skills from recoupable/skills, then runs setup-sandbox.
 * Skips entirely if artist RECOUP.md files already exist (setup already ran).
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID for the sandbox owner
 */
export async function ensureSetupSandbox(
  sandbox: Sandbox,
  accountId: string
): Promise<void> {
  const homeDir = await getSandboxHomeDir(sandbox);
  const orgsPath = `${homeDir}/.openclaw/workspace/orgs`;

  const check = await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", `ls ${orgsPath}/*/artists/*/RECOUP.md 2>/dev/null | head -1`],
  });

  if (check.exitCode === 0 && ((await check.stdout()) || "").trim()) {
    logStep("Sandbox already set up, skipping", false);
    return;
  }

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
}
