import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { getGitHubAuthPrefix } from "./getGitHubAuthPrefix";

/**
 * Configures git authentication and user identity globally in the sandbox.
 *
 * Sets url.insteadOf so all HTTPS GitHub URLs automatically use the token,
 * and configures the Recoup Agent git identity.
 */
export async function configureGitAuth(sandbox: Sandbox): Promise<void> {
  const authPrefix = getGitHubAuthPrefix();

  if (authPrefix) {
    await sandbox.runCommand({
      cmd: "git",
      args: [
        "config",
        "--global",
        `url.${authPrefix}.insteadOf`,
        "https://github.com/",
      ],
    });
    logger.log("Git auth configured with GITHUB_TOKEN");
  } else {
    logger.log("No GITHUB_TOKEN, skipping git auth configuration");
  }

  await sandbox.runCommand({
    cmd: "git",
    args: ["config", "--global", "user.email", "agent@recoupable.com"],
  });

  await sandbox.runCommand({
    cmd: "git",
    args: ["config", "--global", "user.name", "Recoup Agent"],
  });
}
