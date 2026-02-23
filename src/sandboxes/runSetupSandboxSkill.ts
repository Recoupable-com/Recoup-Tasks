import type { Sandbox } from "@vercel/sandbox";
import { runOpenClawAgent } from "./runOpenClawAgent";

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
  const result = await runOpenClawAgent(sandbox, {
    label: "Running setup-sandbox skill",
    message:
      "Install the Recoup CLI globally: npm install -g @recoupable/cli\n\nThen run the /setup-sandbox skill to create the org and artist folder structure.\n\nRECOUP_API_KEY and RECOUP_ACCOUNT_ID are available as environment variables.",
    env,
  });

  if (result.exitCode !== 0) {
    throw new Error("Failed to set up sandbox via OpenClaw");
  }
}
