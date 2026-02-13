import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { installOpenCode } from "./installOpenCode";
import { writeOpenCodeConfig } from "./writeOpenCodeConfig";

/**
 * Ensures OpenCode is installed and configured in the sandbox.
 *
 * Combines the install + config steps that are always called together.
 *
 * @param sandbox - The Vercel Sandbox instance
 */
export async function ensureOpenCode(sandbox: Sandbox): Promise<void> {
  logger.log("Ensuring OpenCode is installed and configured");
  await installOpenCode(sandbox);
  await writeOpenCodeConfig(sandbox);
  logger.log("OpenCode ready");
}
