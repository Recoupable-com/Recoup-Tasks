import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Runs the /setup-artist skill via OpenClaw for each artist
 * folder that exists under orgs/.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param env - Environment variables for the agent
 */
export async function runSetupArtistSkill(
  sandbox: Sandbox,
  env: Record<string, string>
): Promise<void> {
  const result = await sandbox.runCommand({
    cmd: "openclaw",
    args: [
      "agent", "--agent", "main", "--message",
      "Run the /setup-artist skill for EACH artist folder that exists under orgs/.\n\nRECOUP_API_KEY and RECOUP_ACCOUNT_ID are available as environment variables.",
    ],
    env,
  });

  const stdout = (await result.stdout()) || "";
  const stderr = (await result.stderr()) || "";

  logger.log("Setup-artist result", {
    exitCode: result.exitCode,
    stdout,
    stderr,
  });

  if (result.exitCode !== 0) {
    throw new Error("Failed to set up artists via OpenClaw");
  }
}
