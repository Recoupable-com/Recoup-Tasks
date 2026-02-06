import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Writes the opencode.json config file into the sandbox, configuring
 * the Vercel AI Gateway provider with the specified model.
 *
 * @param sandbox - The Vercel Sandbox instance
 */
export async function writeOpenCodeConfig(sandbox: Sandbox): Promise<void> {
  const config = {
    $schema: "https://opencode.ai/config.json",
    provider: {
      vercel: {
        options: {
          apiKey: process.env.VERCEL_AI_GATEWAY_API_KEY,
        },
        models: {
          "google/gemini-3-pro-preview": {},
        },
      },
    },
    model: "vercel/google/gemini-3-pro-preview",
  };

  logger.log("Writing opencode.json config to sandbox");

  await sandbox.writeFiles([
    {
      path: "/vercel/sandbox/opencode.json",
      content: Buffer.from(JSON.stringify(config, null, 2)),
    },
  ]);

  logger.log("OpenCode config written");
}
