import type { Sandbox } from "@vercel/sandbox";
import { runOpenClawAgent } from "./runOpenClawAgent";

/**
 * Runs the /artist-workspace skill via OpenClaw to set up context
 * files for artists under orgs/.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param env - Environment variables for the agent
 */
export async function runArtistWorkspaceSkill(
  sandbox: Sandbox,
  env: Record<string, string>
): Promise<void> {
  const result = await runOpenClawAgent(sandbox, {
    label: "Running artist-workspace skill",
    message:
      "Read the /artist-workspace skill and follow it when working across your roster's artist workspaces.\n\nRECOUP_API_KEY and RECOUP_ACCOUNT_ID are available as environment variables.",
    env,
  });

  if (result.exitCode !== 0) {
    throw new Error("Failed to run artist-workspace skill via OpenClaw");
  }
}
