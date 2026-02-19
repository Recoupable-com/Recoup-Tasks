import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Writes RECOUP_API_KEY and RECOUP_ACCOUNT_ID to /etc/environment in the
 * sandbox so they persist across all processes and subshells.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID for the sandbox owner
 * @throws Error if RECOUP_API_KEY is not set or write fails
 */
export async function writeSandboxEnv(
  sandbox: Sandbox,
  accountId: string
): Promise<void> {
  if (!process.env.RECOUP_API_KEY) {
    throw new Error("Missing RECOUP_API_KEY environment variable");
  }

  const apiKey = process.env.RECOUP_API_KEY;

  logger.log("Writing sandbox env vars to /etc/environment", {
    RECOUP_API_KEY: `${apiKey.slice(0, 4)}...`,
    RECOUP_ACCOUNT_ID: accountId || "MISSING",
  });

  const result = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `printf 'RECOUP_API_KEY=%s\\nRECOUP_ACCOUNT_ID=%s\\n' '${apiKey}' '${accountId}' | sudo tee -a /etc/environment > /dev/null`,
    ],
  });

  if (result.exitCode !== 0) {
    const stderr = (await result.stderr()) || "";
    logger.error("Failed to write sandbox env vars", {
      exitCode: result.exitCode,
      stderr,
    });
    throw new Error("Failed to write env vars to /etc/environment");
  }

  // Verify the write
  const verify = await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "grep -c RECOUP /etc/environment"],
  });
  logger.log("Verified /etc/environment", {
    matchingLines: (await verify.stdout())?.trim() || "0",
  });
}
