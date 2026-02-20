import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Runs the /setup-sandbox skill via OpenClaw to create the
 * org and artist folder structure in the sandbox.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param env - Environment variables for the agent
 */
export async function runSetupSandboxSkill(
  sandbox: Sandbox,
  env: Record<string, string>
): Promise<void> {
  const result = await sandbox.runCommand({
    cmd: "openclaw",
    args: [
      "agent", "--agent", "main", "--message",
      "Install the Recoup CLI globally: npm install -g @recoupable/cli\n\nThen run the /setup-sandbox skill to create the org and artist folder structure.\n\nRECOUP_API_KEY and RECOUP_ACCOUNT_ID are available as environment variables.",
    ],
    env,
  });

  const stdout = (await result.stdout()) || "";
  const stderr = (await result.stderr()) || "";

  logger.log("Setup-sandbox result", {
    exitCode: result.exitCode,
    stdout,
    stderr,
  });

  if (result.exitCode !== 0) {
    throw new Error("Failed to set up sandbox via OpenClaw");
  }
}
