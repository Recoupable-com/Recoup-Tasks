import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Strips x-access-token auth from .gitmodules so tokens are not committed.
 *
 * Replaces `https://x-access-token:TOKEN@github.com/` with `https://github.com/`
 * and re-stages the file.
 *
 * @param sandbox - The Vercel Sandbox instance
 */
export async function stripGitmodulesTokens(sandbox: Sandbox): Promise<void> {
  logger.log("Stripping auth tokens from .gitmodules");

  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      "sed -i 's|https://x-access-token:[^@]*@github.com/|https://github.com/|g' .gitmodules 2>/dev/null || true; " +
        "git add .gitmodules 2>/dev/null || true",
    ],
  });
}
