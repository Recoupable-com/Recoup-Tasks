import type { Sandbox } from "@vercel/sandbox";
import { runOpenClawAgent } from "./runOpenClawAgent";

/**
 * Delegates monorepo clone to the OpenClaw agent.
 * The agent clones the Recoup monorepo into its workspace and inits
 * top-level submodules (no --recursive).
 *
 * @param sandbox - The Vercel Sandbox instance
 */
export async function cloneMonorepoViaAgent(sandbox: Sandbox): Promise<void> {
  await runOpenClawAgent(sandbox, {
    label: "Clone monorepo via agent",
    message: [
      "Clone the Recoup monorepo and init its submodules:",
      "1. Run: git clone https://github.com/recoupable/Recoup-Monorepo.git",
      "2. cd into the cloned directory",
      "3. Run: git submodule update --init (do NOT use --recursive)",
      "4. Configure git user: git config user.email agent@recoupable.com && git config user.name 'Recoup Agent'",
    ].join("\n"),
  });
}
