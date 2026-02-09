import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { Sandbox } from "@vercel/sandbox";
import { ensureGithubRepo } from "../sandboxes/ensureGithubRepo";
import { setupSandboxPayloadSchema } from "../schemas/setupSandboxSchema";

/**
 * Background task that connects to an existing Vercel Sandbox and ensures
 * a GitHub repository is created and cloned. Idempotent — safe to retry.
 *
 * Requires VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID, and
 * GITHUB_TOKEN environment variables.
 */
export const setupSandboxTask = schemaTask({
  id: "setup-sandbox",
  schema: setupSandboxPayloadSchema,
  maxDuration: 60 * 5, // 5 minutes max
  retry: {
    maxAttempts: 3, // Idempotent — safe to retry
  },
  run: async (payload) => {
    const { sandboxId, accountId } = payload;

    const token = process.env.VERCEL_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID;
    const projectId = process.env.VERCEL_PROJECT_ID;

    if (!token || !teamId || !projectId) {
      throw new Error(
        "Missing Vercel credentials. Set VERCEL_TOKEN, VERCEL_TEAM_ID, and VERCEL_PROJECT_ID."
      );
    }

    logger.log("Starting sandbox setup", { sandboxId, accountId });

    const sandbox = await Sandbox.get({ sandboxId, token, teamId, projectId });

    logger.log("Connected to sandbox", {
      sandboxId: sandbox.sandboxId,
      status: sandbox.status,
    });

    const githubRepo = await ensureGithubRepo(sandbox, accountId);

    logger.log("Sandbox setup complete", {
      sandboxId: sandbox.sandboxId,
      githubRepo: githubRepo ?? null,
    });

    return { githubRepo: githubRepo ?? null };
  },
});
