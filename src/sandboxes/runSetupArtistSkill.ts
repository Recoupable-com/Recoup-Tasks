import type { Sandbox } from "@vercel/sandbox";
import { runOpenClawAgent } from "./runOpenClawAgent";

/**
 * Runs the /setup-artist skill via OpenClaw for each artist
 * folder that exists under orgs/.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param env - Environment variables for the agent
 */
export async function runSetupArtistSkill(
  sandbox: Sandbox,
  env: Record<string, string>,
): Promise<void> {
  const result = await runOpenClawAgent(sandbox, {
    label: "Running setup-artist skill",
    message:
      "Run the /setup-artist skill for EACH artist folder that exists under orgs/.\n\nRECOUP_API_KEY and RECOUP_ACCOUNT_ID are available as environment variables.",
    env,
  });

  if (result.exitCode !== 0) {
    throw new Error("Failed to set up artists via OpenClaw");
  }
}
